// homerepair-ai/backend/chat-handler/index.js
const { CosmosClient } = require('@azure/cosmos');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { validateJwt } = require('../common/auth'); // <— NEW (see auth.js below)

// ---------- CORS ----------
const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// ---------- ENV CHECKS ----------
const requiredOpenAIEnv = [
  'OPENAI_API_KEY',
  'OPENAI_API_BASE',
  'OPENAI_DEPLOYMENT_NAME',
  'OPENAI_API_VERSION'
];
const missingOpenAIEnv = requiredOpenAIEnv.filter(v => !process.env[v]);

let openaiClient = null;
if (missingOpenAIEnv.length === 0) {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: `${process.env.OPENAI_API_BASE}/openai/deployments/${process.env.OPENAI_DEPLOYMENT_NAME}`,
    defaultQuery: { 'api-version': process.env.OPENAI_API_VERSION },
    defaultHeaders: { 'api-key': process.env.OPENAI_API_KEY }
  });
}

// Cosmos
let database = null;
if (process.env.COSMOS_CONNECTION_STRING) {
  const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
  database = cosmosClient.database('homerepair-db');
}

// product-matcher endpoint
const PRODUCT_MATCHER_URL = process.env.PRODUCT_MATCHER_URL || 'http://127.0.0.1:7071/api/product-matcher';

// image-analyzer endpoint (NEW)
const IMAGE_ANALYZER_URL = process.env.IMAGE_ANALYZER_URL || 'http://127.0.0.1:7071/api/image-analyzer';

// ---------- Location helpers ----------
function mapStateAbbrev(s) {
  const t = String(s || '').toUpperCase();
  const map = {
    NSW: 'NSW', 'NEW SOUTH WALES': 'NSW',
    VIC: 'VIC', 'VICTORIA': 'VIC',
    QLD: 'QLD', 'QUEENSLAND': 'QLD',
    WA: 'WA', 'WESTERN AUSTRALIA': 'WA',
    SA: 'SA', 'SOUTH AUSTRALIA': 'SA',
    TAS: 'TAS', 'TASMANIA': 'TAS',
    NT: 'NT', 'NORTHERN TERRITORY': 'NT',
    ACT: 'ACT', 'AUSTRALIAN CAPITAL TERRITORY': 'ACT'
  };
  return map[t] || null;
}
function findStateInText(txt = '') {
  const u = txt.toUpperCase();
  const tokens = ['NSW','VIC','QLD','WA','SA','TAS','NT','ACT',
    'NEW SOUTH WALES','VICTORIA','QUEENSLAND','WESTERN AUSTRALIA',
    'SOUTH AUSTRALIA','TASMANIA','NORTHERN TERRITORY','AUSTRALIAN CAPITAL TERRITORY'];
  for (const tok of tokens) {
    if (u.includes(tok)) return mapStateAbbrev(tok);
  }
  return null;
}
function normaliseLocation(input = {}) {
  const raw = typeof input === 'string' ? input.trim() : (input.location || '').trim();
  const out = { suburb: null, city: null, state: null, postcode: null, raw: raw || null };
  if (typeof input.state === 'string' && input.state.trim()) {
    out.state = mapStateAbbrev(input.state.trim());
  }
  if (input.postcode != null && String(input.postcode).trim()) {
    const pc = Number(String(input.postcode).trim());
    if (Number.isFinite(pc)) out.postcode = pc;
  }
  if (raw) {
    const mPost = raw.match(/\b(\d{4})\b/);
    if (mPost) out.postcode = out.postcode ?? Number(mPost[1]);
    const stateHit = findStateInText(raw);
    if (stateHit) out.state = out.state ?? stateHit;
    const first = raw.split(',')[0].trim();
    if (first && !/^\d{4}$/.test(first) && !mapStateAbbrev(first)) {
      out.city = first;
      out.suburb = first;
    }
  }
  return out;
}

// ---------- HELPERS ----------
async function getOrCreateConversation(database, conversationId, userId) {
  const container = database.container('conversations');
  try {
    const { resource } = await container.item(conversationId, userId).read();
    if (resource) return resource;
  } catch (_) {}
  return {
    id: conversationId,
    userId,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function saveConversation(database, conversation) {
  const container = database.container('conversations');
  conversation.updatedAt = new Date().toISOString();
  await container.items.upsert(conversation);
}

async function getProductSuggestions(problem, category, maxPrice, locObj) {
  try {
    const payload = {
      problem: problem || '',
      category: category || null,
      maxPrice: maxPrice || null,
      location: locObj?.raw || null,
      state: locObj?.state || null,
      postcode: locObj?.postcode || null
    };
    const { data } = await axios.post(PRODUCT_MATCHER_URL, payload, { timeout: 6000 });
    return {
      products: Array.isArray(data?.products) ? data.products : [],
      professionals: Array.isArray(data?.professionals) ? data.professionals : [],
      resolvedLocation: data?.location || locObj || null
    };
  } catch (err) {
    console.error('product-matcher call failed:', err?.message);
    return { products: [], professionals: [], resolvedLocation: locObj || null };
  }
}

function formatRetrievalContext(products = [], professionals = [], locObj = null) {
  const header = locObj?.state || locObj?.city || locObj?.raw
    ? `User location (parsed): ${[locObj?.city, locObj?.state, locObj?.postcode].filter(Boolean).join(' ')}`
    : 'User location: (not provided)';

  const productBullets = products.slice(0, 5).map(p => {
    const price =
      p.priceLow && p.priceHigh ? `$${p.priceLow}–$${p.priceHigh}` :
      p.price != null ? `$${p.price}` : 'price n/a';
    const supplier = p.supplier || 'supplier n/a';
    const region = [p.location, p.state, p.postcode].filter(Boolean).join(' ');
    const link = p.link || p.url || '';
    return `• ${p.name || 'Product'} — ${price} — ${supplier}` +
           `${region ? ` — ${region}` : ''}${link ? ` — ${link}` : ''}`;
  });

  const proBullets = professionals.slice(0, 3).map(pro => {
    const name = pro.name || 'Professional';
    const areas = Array.isArray(pro.serviceAreas) ? pro.serviceAreas.join(', ') : (pro.serviceAreas || 'N/A');
    return `• ${name} — areas: ${areas}${pro.state ? ` — ${pro.state}` : ''}`;
  });

  const supplierHint = products.length === 0
    ? 'No supplier matches were found in the index. Provide generic guidance and ask the user for their suburb/state to refine.'
    : 'Stock/price may vary by store/region; links are indicative for Australia.';

  return `${header}

Relevant products (from our index):
${productBullets.length ? productBullets.join('\n') : '• (no matches found)'}

Professionals (if needed):
${proBullets.length ? proBullets.join('\n') : '• (no matches found)'}

Supplier hint: ${supplierHint}`;
}

function extractStructuredJSON(text) {
  if (!text) return null;
  const m = text.match(/<structured_json>([\s\S]*?)<\/structured_json>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}
function extractCostEstimate(text) {
  const costRegex = /\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)/g;
  const costs = text.match(costRegex);
  return costs ? costs[0] : null;
}
function extractDifficulty(text) {
  const m = text.match(/\b(Easy|Medium|Hard|Professional Required)\b/i);
  return m ? m[0] : 'Unknown';
}

// ---------- Security/validation helpers ----------
function isSafeBase64Image(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 10 * 1024 * 1024) return false; // ~10MB max
  if (!dataUrl.startsWith('data:image/')) return false;
  // basic type allowlist
  if (!/data:image\/(jpeg|jpg|png|webp);base64,/.test(dataUrl)) return false;
  return true;
}

// ---------- SYSTEM PROMPT ----------
const SYSTEM_PROMPT = `You are “HomeRepair AI”, an Australia-aware home maintenance assistant.

Ask concise follow-up questions whenever the user hasn't provided key details you need (e.g., severity, materials, budget, rental vs owner, suburb/state/postcode, urgency, photos). Ask only what's necessary.

Goals:
1) Diagnose home repair issues from text and images.
2) Decide DIY vs Professional.
3) Recommend specific products commonly available in Australia (e.g., Bunnings) with rough costs in AUD.
4) Provide clear, step-by-step instructions and safety guidance.
5) Advise tenants when an issue should be reported to landlord/agent per common Australian rental practice (general, non-legal guidance).
6) When an image is provided, describe what you see and how it changes your advice.

Policies & Tone:
- Be practical, concise, and safety-first. If risk of injury, electrical, gas, structural, asbestos, or warranty issues: Professional Required.
- If uncertain, say so and give the safest next step.
- Prices are estimates in AUD and may change; provide a price range unless structured data is provided.
- Prefer non-invasive fixes for rentals; add a landlord/agent note when appropriate.
- Never claim to have live web access. If products are provided as context, prefer those; otherwise use generic product types.
- If outside home repair, politely decline.

Output format (exactly this order):
1) **Problem diagnosis**
2) **Difficulty**: Easy | Medium | Hard | Professional Required
3) **Materials & tools** (with rough AUD cost ranges)
4) **Steps** (numbered)
5) **Safety warnings**
6) **When to call a professional**
7) **Tenant/Landlord note** (only when relevant)
8) **Estimated total cost (AUD)**
9) **Assumptions/Uncertainties**

At the end, also output this machine-readable block. It MUST be valid JSON, MUST NOT include trailing commas, and MUST end with </structured_json>. Keep the JSON under 250 tokens.

<structured_json>
{
  "diagnosis": "string",
  "difficulty": "Easy|Medium|Hard|Professional Required",
  "materials": [
    {"name": "string", "type": "string", "qty": "string", "price_aud_low": number, "price_aud_high": number}
  ],
  "steps": ["string", "..."],
  "safety": ["string", "..."],
  "when_to_call_pro": ["string", "..."],
  "tenant_landlord_note": "string|null",
  "estimated_total_aud_low": number,
  "estimated_total_aud_high": number,
  "assumptions": ["string", "..."]
}
</structured_json>`;

// ---------- AZURE FUNCTION ----------
module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  context.log('chat-handler triggered');

  try {
    // ------ Auth (RECOMMENDED): require Bearer JWT ------
    const authz = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
    const authResult = await validateJwt(token).catch(() => null);
    if (!authResult || !authResult.sub) {
      context.res = { status: 401, headers: corsHeaders, body: { error: 'Unauthorized' } };
      return;
    }
    const userId = authResult.sub; // do not trust arbitrary userId from client

    if (missingOpenAIEnv.length > 0) {
      const details = `Missing required environment variables: ${missingOpenAIEnv.join(', ')}`;
      context.log.error(details);
      context.res = { status: 500, headers: corsHeaders, body: { error: 'Chat service not configured', details } };
      return;
    }
    if (!database) {
      const details = 'Missing required environment variable: COSMOS_CONNECTION_STRING';
      context.log.error(details);
      context.res = { status: 500, headers: corsHeaders, body: { error: 'Chat service not configured', details } };
      return;
    }

    const { message, conversationId, images, category, maxPrice } = req.body || {};
    const locObj = normaliseLocation(req.body || {}); // handles location/state/postcode

    // basic validation
    if (!message || typeof message !== 'string' || message.length > 5000) {
      context.res = { status: 400, headers: corsHeaders, body: { error: 'Message is required and must be under 5000 chars' } };
      return;
    }

    // If images present, validate & pick first
    let imageAnalysisSummary = null;
    if (Array.isArray(images) && images.length > 0) {
      const first = images[0];
      const dataUrl = first?.dataUrl;
      if (isSafeBase64Image(dataUrl)) {
        try {
          const { data } = await axios.post(
            IMAGE_ANALYZER_URL,
            { imageData: dataUrl, problemContext: message },
            { timeout: 10000 }
          );
          // keep only minimal, non-sensitive subset
          imageAnalysisSummary = {
            usedFeatures: data?.usedFeatures || [],
            description: data?.analysis?.description || null,
            repairSuggestions: data?.analysis?.repairSuggestions || []
          };
        } catch (e) {
          context.log.warn('image-analyzer call failed:', e?.message);
        }
      } else {
        context.log.warn('Rejected image: invalid format or too large');
      }
    }

    const convId = conversationId || uuidv4();
    const conversation = await getOrCreateConversation(database, convId, userId);

    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      images: imageAnalysisSummary ? ['[image attached]'] : [], // don’t store raw images
      imageAnalysis: imageAnalysisSummary || null
    });

    // Retrieve product/pro suggestions
    const suggestions = await getProductSuggestions(message, category, maxPrice, locObj);
    const retrievalContext = formatRetrievalContext(
      suggestions.products,
      suggestions.professionals,
      suggestions.resolvedLocation
    );

    // Build prompt (include image analysis if any)
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Context from our product index (prefer these if relevant):\n\n${retrievalContext}\n\nUser question follows.` },
      ...(imageAnalysisSummary ? [{ role: 'user', content: `Image analysis summary:\nDescription: ${imageAnalysisSummary.description || 'n/a'}\nSuggestions: ${imageAnalysisSummary.repairSuggestions.map(s => `- ${s.issue}: ${s.action}`).join('\n')}` }] : []),
      ...conversation.messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
    ];

    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_DEPLOYMENT_NAME,
      messages,
      max_tokens: 1200,
      temperature: 0.5,
      top_p: 1.0,
      presence_penalty: 0.0,
      frequency_penalty: 0.1
    });

    let aiResponse = completion?.choices?.[0]?.message?.content || '';
    conversation.messages.push({ role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() });

    let structured = extractStructuredJSON(aiResponse);

    if (!structured) {
      try {
        const followup = await openaiClient.chat.completions.create({
          model: process.env.OPENAI_DEPLOYMENT_NAME,
          messages: [
            { role: 'system', content: 'Return ONLY the <structured_json> block as valid JSON wrapped in <structured_json> tags. No prose.' },
            { role: 'user', content: 'Re-output the <structured_json> block from your last answer. No extra text.' }
          ],
          max_tokens: 300,
          temperature: 0
        });
        const onlyBlock = followup?.choices?.[0]?.message?.content || '';
        const retryStructured = extractStructuredJSON(onlyBlock);
        if (retryStructured) {
          structured = retryStructured;
          conversation.messages.push({ role: 'assistant', content: onlyBlock, timestamp: new Date().toISOString() });
        }
      } catch (e) {
        context.log.warn('structured_json follow-up failed:', e?.message);
      }
    }

    await saveConversation(database, conversation);

    const difficulty = structured?.difficulty || extractDifficulty(aiResponse);
    const costSample = extractCostEstimate(aiResponse);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: {
        response: aiResponse,
        conversationId: convId,
        structured: structured || null,
        difficulty,
        estimatedCostHint: costSample,
        products: suggestions.products,
        professionals: suggestions.professionals,
        location: suggestions.resolvedLocation || locObj,
        imageAnalysis: imageAnalysisSummary || null
      }
    };
  } catch (err) {
    context.log.error('chat-handler error:', err);
    context.res = { status: 500, headers: corsHeaders, body: { error: 'Internal server error' } };
  }
};
