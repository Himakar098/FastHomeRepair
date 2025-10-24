// Azure AI Vision Image Analysis 4.0 (REST) — JS SDK
// npm i @azure-rest/ai-vision-image-analysis @azure/core-auth @azure/storage-blob

const { BlobServiceClient } = require("@azure/storage-blob");
const { AzureKeyCredential } = require("@azure/core-auth");
const createImageAnalysisClient = require("@azure-rest/ai-vision-image-analysis").default;
const { isUnexpected } = require("@azure-rest/ai-vision-image-analysis");

// ---- CORS ----
const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  'Vary': 'Origin'
};

// ---- Env + clients ----
const VISION_KEY =
  process.env.COMPUTER_VISION_KEY || process.env.VISION_KEY || process.env.AZURE_VISION_KEY;
const VISION_ENDPOINT =
  process.env.COMPUTER_VISION_ENDPOINT ||
  process.env.VISION_ENDPOINT ||
  process.env.AZURE_VISION_ENDPOINT;
// NOTE: Prefer the Cognitive Services endpoint form:
// https://<your-resource-name>.cognitiveservices.azure.com
// The regional form like https://australiaeast.api.cognitive.microsoft.com also works if it targets your resource.

const missingVisionEnv = [];
if (!VISION_KEY) missingVisionEnv.push("COMPUTER_VISION_KEY (or VISION_KEY)");
if (!VISION_ENDPOINT) missingVisionEnv.push("COMPUTER_VISION_ENDPOINT (or VISION_ENDPOINT)");

let imageClient = null;
if (missingVisionEnv.length === 0) {
  imageClient = createImageAnalysisClient(VISION_ENDPOINT, new AzureKeyCredential(VISION_KEY));
}

let blobServiceClient = null;
if (process.env.BLOB_STORAGE_CONNECTION_STRING) {
  blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.BLOB_STORAGE_CONNECTION_STRING
  );
}

// ---------- Region-aware feature handling ----------
function pickRegionFromEndpoint(endpoint) {
  // Tries to infer region from host; returns lowercase region or null
  try {
    const u = new URL(endpoint);
    const host = u.hostname.toLowerCase();
    // forms:
    // 1) <resource>.cognitiveservices.azure.com  -> region not in host; unknown
    // 2) <region>.api.cognitive.microsoft.com   -> region is first label
    const parts = host.split(".");
    if (parts[1] === "api" && parts[2] === "cognitive" && parts[3] === "microsoft" && parts[4] === "com") {
      return parts[0]; // e.g., 'australiaeast'
    }
    return null;
  } catch {
    return null;
  }
}

// Conservative, known-safe defaults when region is unknown
const SAFE_DEFAULT_FEATURES = ["Tags", "Objects"]; // widely available

// Map regions -> supported features (keep minimal; expand as you confirm availability)
// If your resource is in a region that supports Caption/DenseCaptions, add them here.
const SUPPORTED_BY_REGION = {
  // example richer regions:
  eastus: ["Caption", "Tags", "Objects", "People", "Read", "DenseCaptions", "SmartCrops"],
  westeurope: ["Caption", "Tags", "Objects", "People", "Read", "DenseCaptions", "SmartCrops"],
  // conservative regions:
  australiaeast: ["Tags", "Objects", "Read"] // Caption not supported per your error
};

function supportedFeaturesForRegion(endpoint) {
  const r = pickRegionFromEndpoint(endpoint);
  if (r && SUPPORTED_BY_REGION[r]) return SUPPORTED_BY_REGION[r];
  // If endpoint is the cognitiveservices form (no region in host), we can't infer;
  // fall back to safe defaults.
  return SAFE_DEFAULT_FEATURES;
}

function sanitizeFeatures(requested, endpoint) {
  const supported = new Set(supportedFeaturesForRegion(endpoint));
  const req = Array.isArray(requested) && requested.length ? requested : SAFE_DEFAULT_FEATURES;
  const ok = req.filter(f => supported.has(f));
  return ok.length ? ok : SAFE_DEFAULT_FEATURES;
}

// ---------- Azure Function ----------
module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  try {
    if (!imageClient) {
      const details = `Missing required environment variables: ${missingVisionEnv.join(", ")}`;
      context.log.error(details);
      context.res = { status: 500, headers: corsHeaders, body: { error: "Image analysis not configured", details } };
      return;
    }
    if (!blobServiceClient) {
      const details = "Missing required environment variable: BLOB_STORAGE_CONNECTION_STRING";
      context.log.error(details);
      context.res = { status: 500, headers: corsHeaders, body: { error: "Image analysis not configured", details } };
      return;
    }

    const { imageData, imageUrl, problemContext, features } = req.body || {};
    let analyzableUrl = imageUrl;

    // Upload base64 to Blob to get a reachable URL (public blob access)
    if (imageData && !imageUrl) {
      analyzableUrl = await uploadImageToBlob(imageData, context);
    }
    if (!analyzableUrl) {
      context.res = { status: 400, headers: corsHeaders, body: { error: "Image URL or image data required" } };
      return;
    }

    // 1) First attempt with sanitized features for this region
    let requested = sanitizeFeatures(features, VISION_ENDPOINT);
    let result;
    try {
      result = await analyzeOnce(analyzableUrl, requested);
    } catch (e) {
      // 2) If InvalidRequest/BadArgument mentions unsupported features, retry with SAFE_DEFAULT_FEATURES
      const msg = String(e.message || "").toLowerCase();
      if (msg.includes("not supported") || msg.includes("invalidrequest") || msg.includes("badargument")) {
        context.log.warn(`Retrying analysis with safe defaults due to error: ${e.message}`);
        requested = SAFE_DEFAULT_FEATURES;
        result = await analyzeOnce(analyzableUrl, requested);
      } else {
        throw e;
      }
    }

    const analysis = result.body; // ImageAnalysisResultOutput
    const repairAnalysis = processImageForRepairs(analysis, problemContext);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: {
        imageUrl: analyzableUrl,
        usedFeatures: requested,
        analysis: repairAnalysis,
        rawAnalysis: analysis
      }
    };
  } catch (error) {
    context.log.error("Image analysis error:", error);
    context.res = { status: 500, headers: corsHeaders, body: { error: "Image analysis failed", details: error.message } };
  }
};

// ---------- Single analyze call ----------
async function analyzeOnce(url, features) {
  const response = await imageClient.path("/imageanalysis:analyze").post({
    body: { url },
    queryParameters: {
      features,
      language: "en",
      "model-version": "latest",
      "gender-neutral-caption": true
    },
    contentType: "application/json"
  });
  if (isUnexpected(response)) {
    const err = response.body?.error || response.body;
    throw new Error(
      typeof err === "string" ? err : `${err?.code || "AnalyzeFailed"}: ${err?.message || "Unknown error"}`
    );
  }
  return response;
}

// ---------- Blob helper ----------
async function uploadImageToBlob(base64Data, context) {
  const containerName = "repair-images";
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists({ access: "blob" });

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}.jpg`;
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);

  const commaIdx = base64Data.indexOf(",");
  const base64Payload = commaIdx >= 0 ? base64Data.slice(commaIdx + 1) : base64Data;
  const imageBuffer = Buffer.from(base64Payload, "base64");

  await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
    blobHTTPHeaders: { blobContentType: "image/jpeg" }
  });

  return blockBlobClient.url;
}

// ---------- Domain-specific normalization ----------
function processImageForRepairs(iaResult, problemContext) {
  const repairKeywords = [
    "damage","crack","hole","stain","leak","broken","rust","mold","paint","wall","ceiling",
    "floor","door","window","kitchen","bathroom","tile","pipe","water"
  ];

  const captionText = iaResult.captionResult?.text || "";
  const captionConfidence = iaResult.captionResult?.confidence ?? 0;

  const tags = iaResult.tagsResult?.values || [];
  const relevantTags = tags.filter((t) => {
    const name = String(t.name || "").toLowerCase();
    return repairKeywords.some((kw) => name.includes(kw) || kw.includes(name));
  });

  const objects = (iaResult.objectsResult?.values || []).map((o) => ({
    object: o.name || o.tagName || "object",
    confidence: o.confidence,
    rectangle: o.boundingBox
      ? { x: o.boundingBox.x, y: o.boundingBox.y, w: o.boundingBox.w, h: o.boundingBox.h }
      : undefined
  }));

  return {
    description: captionText || null,
    confidence: captionConfidence || null,
    relevantTags: relevantTags.map((t) => ({ name: t.name, confidence: t.confidence ?? null })),
    detectedObjects: objects,
    ocr: (iaResult.readResult?.blocks || []).map((b) => ({
      text: (b.lines || []).map((l) => l.text).join(" ")
    })),
    repairSuggestions: generateRepairSuggestions(relevantTags, captionText, problemContext)
  };
}

function generateRepairSuggestions(tags, description, context) {
  const suggestions = [];
  const haystack = `${description || ""} ${(context || "")}`.toLowerCase();
  const has = (needle) =>
    tags.some((t) => String(t.name || "").toLowerCase().includes(needle)) || haystack.includes(needle);

  if (has("crack")) {
    suggestions.push({
      issue: "Visible cracks detected",
      urgency: "medium",
      action: "Measure width; hairline cracks can be patched; structural cracks need pro assessment."
    });
  }
  if (has("stain") || has("mold") || has("leak") || has("water")) {
    suggestions.push({
      issue: "Staining / moisture indicator",
      urgency: "high",
      action: "Check for active leaks; dry thoroughly; treat mold; fix source (roof/pipe/caulk) before repainting."
    });
  }
  if (has("rust")) {
    suggestions.push({
      issue: "Rust visible",
      urgency: "medium",
      action: "Remove rust, apply rust-inhibiting primer, repaint or replace corroded hardware."
    });
  }
  if (has("hole")) {
    suggestions.push({
      issue: "Hole in surface",
      urgency: "low",
      action: "Patch with appropriate filler (spackle/drywall compound); sand and repaint."
    });
  }
  if (suggestions.length === 0) {
    suggestions.push({
      issue: "General inspection",
      urgency: "low",
      action: "No specific repair patterns detected. Share more context or a closer photo for tailored advice."
    });
  }
  return suggestions;
}
