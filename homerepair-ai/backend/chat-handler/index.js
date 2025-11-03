// homerepair-ai/backend/chat-handler/index.js
const { CosmosClient } = require('@azure/cosmos');
const { AzureOpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { validateJwt } = require('../common/auth'); // <— NEW (see auth.js below)
const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');

// ---------- CORS ----------
const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin'
};

// ---------- ENV CHECKS ----------
const requiredOpenAIEnv = ['OPENAI_API_BASE', 'OPENAI_DEPLOYMENT_NAME', 'OPENAI_API_VERSION'];
const missingOpenAIEnv = requiredOpenAIEnv.filter(v => !process.env[v]);

const openaiEndpoint = (process.env.OPENAI_API_BASE || '').replace(/\/+$/, '');
const openaiDeployment = process.env.OPENAI_DEPLOYMENT_NAME;
const openaiApiVersion = process.env.OPENAI_API_VERSION;
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiUseAad = String(process.env.OPENAI_USE_AAD || '').toLowerCase() === 'true' || !openaiApiKey;
const OPENAI_SCOPE = 'https://cognitiveservices.azure.com/.default';

let openaiClient = null;
if (missingOpenAIEnv.length === 0) {
  try {
    if (openaiUseAad) {
      const credential = new DefaultAzureCredential();
      const tokenProvider = getBearerTokenProvider(credential, OPENAI_SCOPE);
      openaiClient = new AzureOpenAI({
        azure_endpoint: openaiEndpoint,
        azure_ad_token_provider: tokenProvider,
        apiVersion: openaiApiVersion,
        api_version: openaiApiVersion
      });
    } else {
      openaiClient = new AzureOpenAI({
        apiKey: openaiApiKey,
        azure_endpoint: openaiEndpoint,
        apiVersion: openaiApiVersion,
        api_version: openaiApiVersion
      });
    }
  } catch (err) {
    console.error('Failed to initialize Azure OpenAI client:', err);
    openaiClient = null;
  }
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
function hasLocationData(value) {
  if (!value) return false;
  return ['raw', 'suburb', 'city', 'state', 'postcode'].some((key) => !!value[key]);
}

function mergeLocation(base, extra) {
  const out = { ...(base || {}) };
  if (!extra) return out;
  for (const key of ['raw', 'suburb', 'city', 'state', 'postcode']) {
    if (!out[key] && extra[key]) out[key] = extra[key];
  }
  return out;
}

function parseStringLocation(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const raw = rawValue.trim();
  if (!raw) return null;
  const result = { raw, suburb: null, city: null, state: null, postcode: null };
  const postcodeMatch = raw.match(/\b(\d{4})\b/);
  if (postcodeMatch) result.postcode = Number(postcodeMatch[1]);
  const stateHit = findStateInText(raw);
  if (stateHit) result.state = stateHit;
  const firstToken = raw.split(',')[0].trim();
  const cleanedToken = firstToken.replace(/[^a-z0-9\s-]/gi, '').trim();
  if (cleanedToken && !/^\d{4}$/.test(cleanedToken) && !mapStateAbbrev(cleanedToken)) {
    result.city = cleanedToken;
    result.suburb = cleanedToken;
  }
  return result;
}

function normaliseLocation(input = {}) {
  if (typeof input === 'string') {
    return parseStringLocation(input);
  }

  const result = { raw: null, suburb: null, city: null, state: null, postcode: null };
  const stringCandidates = [];
  const pushString = (value) => {
    if (typeof value === 'string' && value.trim()) stringCandidates.push(value.trim());
  };

  pushString(input.raw);
  pushString(input.location);
  pushString(input.address);
  pushString(input.addressClean);
  pushString(input.city);
  pushString(input.suburb);
  if (Array.isArray(input.serviceAreas)) {
    input.serviceAreas.forEach(pushString);
  }
  if (input.address && typeof input.address === 'object') {
    pushString(
      [input.address.streetAddress, input.address.locality, input.address.region, input.address.postalCode]
        .filter(Boolean)
        .join(', ')
    );
  }

  const stateCandidates = [];
  const pushState = (value) => {
    if (typeof value === 'string' && value.trim()) stateCandidates.push(value.trim());
  };
  pushState(input.state);
  pushState(input.stateOrProvince);
  pushState(input.region);
  if (input.address && typeof input.address === 'object') pushState(input.address.region || input.address.state);

  const postcodeCandidates = [];
  const pushPostcode = (value) => {
    if (value == null) return;
    const text = String(value).trim();
    if (text) postcodeCandidates.push(text);
  };
  pushPostcode(input.postcode);
  pushPostcode(input.postalCode);
  pushPostcode(input.zipcode);
  if (input.address && typeof input.address === 'object') pushPostcode(input.address.postalCode || input.address.zip);

  if (stringCandidates.length > 0) {
    result.raw = stringCandidates[0];
  }

  for (const candidate of stringCandidates) {
    result = mergeLocation(result, parseStringLocation(candidate));
  }

  for (const stateCandidate of stateCandidates) {
    const mapped = mapStateAbbrev(stateCandidate);
    if (mapped) {
      result.state = result.state || mapped;
      if (result.state) break;
    }
  }

  for (const candidate of postcodeCandidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) {
      result.postcode = result.postcode ?? numeric;
      if (result.postcode != null) break;
    }
  }

  const hasData = Boolean(result.raw || result.suburb || result.city || result.state || result.postcode);
  return hasData ? result : null;
}

function extractLocationFromFreeText(text) {
  if (typeof text !== 'string') return [];
  const trimmed = text.trim();
  const candidates = [];

  if (!trimmed) return candidates;

  // Short messages like "Perth WA" or "WA"
  if (trimmed.length <= 64) {
    candidates.push(trimmed);
  }

  const patterns = [
    /(?:from|in|near|around|at)\s+([a-z\s]+?)(?=[.,;!?]|$)/gi,
    /([a-z\s]+?),\s*(nsw|vic|qld|wa|sa|tas|nt|act)(?=[.,;!?]|$)/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(trimmed))) {
      const value = match[1] ? match[1] : match[0];
      if (value) candidates.push(value.trim());
    }
  }

  return candidates;
}

function deriveLocationFromSources({ body, profile, claims, history }) {
  const merged = { suburb: null, city: null, state: null, postcode: null, raw: null };
  const stringInputs = [];
  const push = (value) => {
    if (typeof value === 'string' && value.trim()) stringInputs.push(value.trim());
  };

  if (body) {
    push(body.location);
    push(body.rawLocation);
    push(body.city);
    push(body.suburb);
  }
  if (profile) {
    push(profile.address);
    push(profile.city);
    push(profile.suburb);
    if (Array.isArray(profile.serviceAreas)) profile.serviceAreas.forEach(push);
  }
  if (claims) {
    push(claims.city);
    push(claims.town);
    if (typeof claims.address === 'string') push(claims.address);
    if (claims.address && typeof claims.address === 'object') {
      push(
        [
          claims.address.streetAddress,
          claims.address.locality || claims.address.city,
          claims.address.region || claims.address.state,
          claims.address.postalCode || claims.address.zip
        ]
          .filter(Boolean)
          .join(', ')
      );
    }
  }

  const stateHints = [];
  const addState = (value) => {
    if (typeof value === 'string' && value.trim()) stateHints.push(value.trim());
  };
  if (body) addState(body.state);
  if (profile) addState(profile.state);
  if (claims) {
    addState(claims.state);
    addState(claims.region);
    addState(claims.stateOrProvince);
    if (claims.address && typeof claims.address === 'object') addState(claims.address.region || claims.address.state);
    if (typeof claims.state === 'string' && !stringInputs.length) stringInputs.push(claims.state);
  }

  const postcodeHints = [];
  const addPostcode = (value) => {
    if (value == null) return;
    const text = String(value).trim();
    if (text) postcodeHints.push(text);
  };
  if (body) addPostcode(body.postcode);
  if (profile) addPostcode(profile.postcode);
  if (claims) {
    addPostcode(claims.postalCode);
    addPostcode(claims.zip);
    if (claims.address && typeof claims.address === 'object')
      addPostcode(claims.address.postalCode || claims.address.zip);
  }

  let result = { ...merged };

  // Inspect current message text and history for location hints
  if (body && typeof body.message === 'string') {
    const textCandidates = extractLocationFromFreeText(body.message);
    textCandidates.forEach(push);
  }
  if (Array.isArray(history)) {
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (entry?.role !== 'user') continue;
      if (typeof entry.content !== 'string') continue;
      const texts = extractLocationFromFreeText(entry.content);
      if (texts.length) {
        texts.forEach(push);
        break;
      }
    }
  }

  if (body && typeof body.message === 'string') {
    const upper = body.message.trim().toUpperCase();
    if (mapStateAbbrev(upper)) {
      stateHints.unshift(upper);
      if (!stringInputs.length) stringInputs.push(upper);
    }
  }

  if (stringInputs.length > 0) {
    result = mergeLocation(result, parseStringLocation(stringInputs[0]));
  }

  for (const candidate of stringInputs.slice(1)) {
    result = mergeLocation(result, parseStringLocation(candidate));
  }

  for (const stateCandidate of stateHints) {
    const mapped = mapStateAbbrev(stateCandidate);
    if (mapped) {
      result.state = result.state || mapped;
      if (result.state) break;
    }
  }

  for (const candidate of postcodeHints) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) {
      result.postcode = result.postcode ?? numeric;
      if (result.postcode != null) break;
    }
  }

  if (!result.raw && stringInputs.length > 0) {
    result.raw = stringInputs[0];
  }

  const hasData = Boolean(result.raw || result.suburb || result.city || result.state || result.postcode);
  return hasData ? result : null;
}

async function getUserProfile(database, userId) {
  try {
    const container = database.container('users');
    const { resource } = await container.item(userId, userId).read();
    return resource || null;
  } catch (_) {
    return null;
  }
}

// ---------- HELPERS ----------
async function getOrCreateConversation(database, conversationId, userId) {
  const container = database.container('conversations');
  try {
    const { resource } = await container.item(conversationId, userId).read();
    if (resource) {
      if (!Object.prototype.hasOwnProperty.call(resource, 'latestLocation')) {
        resource.latestLocation = null;
      }
      return resource;
    }
  } catch (_) {}
  return {
    id: conversationId,
    userId,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    latestLocation: null
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
      realtimeResults: Array.isArray(data?.realtimeResults) ? data.realtimeResults : [],
      realtimeProducts: Array.isArray(data?.realtimeProducts) ? data.realtimeProducts : [],
      realtimeProfessionals: Array.isArray(data?.realtimeProfessionals) ? data.realtimeProfessionals : [],
      resolvedLocation: data?.location || locObj || null
    };
  } catch (err) {
    console.error('product-matcher call failed:', err?.message);
    return { products: [], professionals: [], realtimeResults: [], realtimeProducts: [], realtimeProfessionals: [], resolvedLocation: locObj || null };
  }
}

function formatRetrievalContext(
  products = [],
  professionals = [],
  realtimeResults = [],
  locObj = null,
  options = {}
) {
  const isAuthenticated = !!options.isAuthenticated;
  const header = locObj?.state || locObj?.city || locObj?.raw
    ? `User location (parsed): ${[locObj?.city, locObj?.state, locObj?.postcode].filter(Boolean).join(' ')}`
    : 'User location: (not provided)';

  const productBullets = products.slice(0, 6).map(p => {
    const price =
      p.priceLow && p.priceHigh ? `$${p.priceLow}–$${p.priceHigh}` :
      p.price != null ? `$${p.price}` : 'price n/a';
    const supplier = p.supplier || 'supplier n/a';
    const region = [p.location, p.state, p.postcode].filter(Boolean).join(' ');
    const link = p.link || p.url || '';
    const safeName = p.name || 'Product';
    const linkFragment = link ? `[${safeName}](${link})` : safeName;
    return `• ${linkFragment} — ${price} — ${supplier}` +
           `${region ? ` — ${region}` : ''}`;
  });

  const proBullets = professionals.slice(0, 4).map(pro => {
    const name = pro.name || 'Professional';
    const areas = Array.isArray(pro.serviceAreas) ? pro.serviceAreas.join(', ') : (pro.serviceAreas || 'N/A');
    const link = pro.website || '';
    const label = link ? `[${name}](${link})` : name;
    return `• ${label} — areas: ${areas}${pro.state ? ` — ${pro.state}` : ''}`;
  });

  const realtimeBullets = realtimeResults.slice(0, 3).map(res => {
    const label = res.type && res.type !== 'general' ? res.type.toUpperCase() : 'RESULT';
    const title = res.title || 'Result';
    const link = res.link || '';
    const display = link ? `[${title}](${link})` : title;
    const summary = res.snippet ? res.snippet : 'No summary available';
    return `• [${label}] ${display} — ${summary}`;
  });

  const supplierHint = products.length === 0
    ? 'No supplier matches were found in the index. Use live web results and ask the user for their suburb/state to refine.'
    : 'Stock/price may vary by store/region; links are indicative for Australia.';

  const authNote = isAuthenticated
    ? 'User is authenticated; include live product links and pricing.'
    : 'User may be anonymous. Still include available product links and note any limitations politely.';

  return `${header}

${authNote}

Relevant products:
${productBullets.length ? productBullets.join('\n') : '• (no matches found)'}

Professionals (if needed):
${proBullets.length ? proBullets.join('\n') : '• (no matches found)'}

Live web results:
${realtimeBullets.length ? realtimeBullets.join('\n') : '• (no live web results)'}

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
const SYSTEM_PROMPT = `
You are **Home Assistant AI** — a practical, safety-first Australian home + lifestyle maintenance assistant.

You diagnose, fix, clean, maintain, and improve **homes**, **gardens**, and **vehicles**.

You may receive:

* text descriptions
* photos/images
* location/suburb/state
* budget
* urgency
* web results (from Google Search or other tools)

Your priorities:

1. **Safety first** — ALWAYS. If there is any gas, electrical mains, structural risk, asbestos, or safety uncertainty → recommend a licensed professional.
2. **Australian context** — always assume Australia. Use AU terminology, AU standards, AU product sources, and approximate AUD prices.

Core Functions:

* Diagnose issues based on text or images.
* Classify difficulty: **Easy | Medium | Hard | Professional Required**.
* Decide whether DIY is safe or not.
* Recommend relevant products sold in **Australia** (Bunnings, Mitre 10, Amazon AU, Repco, Supercheap Auto, Autobarn, Officeworks etc.) with approximate AUD pricing.
* Source products/services using real-time web search when needed.
* Suggest trusted local professionals when DIY is unsafe or impractical using user location when possible.
* Provide clear repair / cleaning / maintenance instructions using numbered step-by-step format.
* When product or professional links are supplied in context, surface them using Markdown bullet lists (e.g. "- [Product Name](https://...) — $price at Retailer"). Never respond that links are unavailable if the context includes any.
* For rentals: mention if issue should be reported to landlord/agent.
* If user is off-topic (not home/garden/vehicle/cleaning) → politely decline.

Include these sections in this exact order after user is satisfied with diagnosis and ready for repair guidance:

1. Problem Diagnosis
2. Difficulty: Easy | Medium | Hard | Professional Required
3. Materials & Tools (with approx AUD cost ranges & sources)
4. Steps (numbered, concise, practical)
5. Safety Warnings
6. When to call a Professional
7. Tenant / Landlord Note (only if relevant)
8. Estimated Total Cost (AUD)
9. Assumptions / Uncertainties

Ask ONLY essential follow-up questions if information is missing (e.g., material, severity, budget, suburb/state, urgency).

If unsafe or uncertain → STOP and recommend professional help.

Tone: friendly, concise, practical, helpful, Australian.
`;

// ---------- AZURE FUNCTION ----------
module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  context.log('chat-handler triggered');

  try {
        // ------ Auth: optional JWT (required for premium features) ------
    const authz = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
    let authResult = null;
    if (token) {
      authResult = await validateJwt(token).catch(err => {
        context.log.warn('JWT validation failed', err?.message);
        return null;
      });
    }
    const isAuthenticated = !!authResult?.sub;
    let userId = null;
    if (isAuthenticated) {
      userId = authResult.sub;
    } else {
      const provided = typeof (req.body && req.body.userId) === 'string' ? req.body.userId.trim() : '';
      const cleaned = provided.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      const anonBase = cleaned || uuidv4();
      userId = `anon:${anonBase}`;
    }

    if (missingOpenAIEnv.length > 0) {
      const details = `Missing required environment variables: ${missingOpenAIEnv.join(', ')}`;
      context.log.error(details);
      context.res = { status: 500, headers: corsHeaders, body: { error: 'Chat service not configured', details } };
      return;
    }
    if (!openaiClient) {
      const details = openaiUseAad
        ? 'Azure OpenAI client is not initialized. Ensure the function identity has access to the Azure OpenAI resource.'
        : 'Azure OpenAI client is not initialized. Verify OPENAI_API_KEY or set OPENAI_USE_AAD=true for managed identity authentication.';
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

    const body = req.body || {};
    const { message, conversationId, images, category, maxPrice } = body;

    let userProfile = null;
    if (isAuthenticated) {
      userProfile = await getUserProfile(database, userId);
    }

    // basic validation
    if (!message || typeof message !== 'string' || message.length > 5000) {
      context.res = { status: 400, headers: corsHeaders, body: { error: 'Message is required and must be under 5000 chars' } };
      return;
    }

    const convId = conversationId || uuidv4();
    const conversation = await getOrCreateConversation(database, convId, userId);
    if (!Object.prototype.hasOwnProperty.call(conversation, 'latestLocation')) {
      conversation.latestLocation = null;
    }

    const derivedLoc =
      deriveLocationFromSources({
        body,
        profile: userProfile,
        claims: authResult,
        history: conversation.messages
      }) || null;

    const existingLoc = conversation.latestLocation || null;
    const mergedLoc = derivedLoc ? mergeLocation(existingLoc, derivedLoc) : existingLoc;
    const locObj = hasLocationData(mergedLoc) ? mergedLoc : null;

    // If images present, validate & pick first (requires auth)
    let imageAnalysisSummary = null;
    if (isAuthenticated && Array.isArray(images) && images.length > 0) {
      const first = images[0];
      const dataUrl = first?.dataUrl;
      if (isSafeBase64Image(dataUrl)) {
        try {
          const { data } = await axios.post(
            IMAGE_ANALYZER_URL,
            { imageData: dataUrl, problemContext: message },
            { timeout: 10000 }
          );
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
    if (!isAuthenticated && Array.isArray(images) && images.length > 0) {
      context.log.warn('Image attachments ignored for anonymous request');
    }

    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      images: imageAnalysisSummary ? ['[image attached]'] : [], // don’t store raw images
      imageAnalysis: imageAnalysisSummary || null
    });

    // Retrieve product/pro suggestions
    let suggestions = {
      products: [],
      professionals: [],
      realtimeResults: [],
      realtimeProducts: [],
      realtimeProfessionals: [],
      resolvedLocation: locObj || null
    };
    let retrievalContext;
    if (isAuthenticated) {
      suggestions = await getProductSuggestions(message, category, maxPrice, locObj);
      retrievalContext = formatRetrievalContext(
        suggestions.products,
        suggestions.professionals,
        suggestions.realtimeResults,
        suggestions.resolvedLocation,
        { isAuthenticated }
      );
    } else {
      retrievalContext = 'User is anonymous. Provide safe DIY guidance without promising specific stock or professional referrals. Politely encourage signing in to unlock live product links, professional recommendations, and image analysis.';
    }

    if (hasLocationData(locObj)) {
      conversation.latestLocation = locObj;
    }
    if (isAuthenticated) {
      const updatedLocation = mergeLocation(locObj, suggestions.resolvedLocation);
      if (hasLocationData(updatedLocation)) {
        conversation.latestLocation = updatedLocation;
      }
    }

    // Build prompt (include image analysis if any)
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Context from our product index (prefer these if relevant):\n\n${retrievalContext}\n\nUser question follows.` },
      ...(imageAnalysisSummary ? [{ role: 'user', content: `Image analysis summary:\nDescription: ${imageAnalysisSummary.description || 'n/a'}\nSuggestions: ${imageAnalysisSummary.repairSuggestions.map(s => `- ${s.issue}: ${s.action}`).join('\n')}` }] : []),
      ...conversation.messages.slice(-12).map(m => ({ role: m.role, content: m.content }))
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
        realtimeResults: suggestions.realtimeResults,
        realtimeProducts: suggestions.realtimeProducts,
        realtimeProfessionals: suggestions.realtimeProfessionals,
        location: suggestions.resolvedLocation || locObj,
        imageAnalysis: imageAnalysisSummary || null,
        featuresLimited: !isAuthenticated
      }
    };
  } catch (err) {
    context.log.error('chat-handler error:', err);
    context.res = { status: 500, headers: corsHeaders, body: { error: 'Internal server error' } };
  }
};
