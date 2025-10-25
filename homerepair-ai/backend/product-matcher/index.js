// Modified product matcher to include productUrl and price ranges
const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');
const { CosmosClient } = require('@azure/cosmos');
const axios = require('axios');

const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin'
};

const missingSearchEnv = ['SEARCH_ENDPOINT', 'SEARCH_API_KEY'].filter((n) => !process.env[n]);

// Allow the index name to be configured
const INDEX_NAME = process.env.SEARCH_INDEX || 'products-index';

let searchClient = null;
if (missingSearchEnv.length === 0) {
  searchClient = new SearchClient(
    process.env.SEARCH_ENDPOINT,
    INDEX_NAME,
    new AzureKeyCredential(process.env.SEARCH_API_KEY)
  );
}

let database = null;
if (process.env.COSMOS_CONNECTION_STRING) {
  const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
  database = cosmosClient.database('homerepair-db');
}

// ---------------------- Location Normaliser ----------------------
// Accepts free text (e.g., "Sydney", "Perth WA 6000") or structured fields.
// Returns { suburb, city, state, postcode, raw } with best-effort parsing.
function normaliseLocation(input = {}) {
  // input can be { location, state, postcode } or a string
  const raw = typeof input === 'string' ? input.trim() : (input.location || '').trim();
  const out = { suburb: null, city: null, state: null, postcode: null, raw: raw || null };

  // If explicit structured values provided, prefer them
  if (typeof input.state === 'string' && input.state.trim()) {
    out.state = mapStateAbbrev(input.state.trim());
  }
  if (input.postcode != null && String(input.postcode).trim()) {
    const pc = Number(String(input.postcode).trim());
    if (Number.isFinite(pc)) out.postcode = pc;
  }

  // Very light heuristics for raw
  if (raw) {
    // Try postcode
    const mPost = raw.match(/\b(\d{4})\b/);
    if (mPost) out.postcode = out.postcode ?? Number(mPost[1]);

    // Try state abbreviations/names
    const stateHit = findStateInText(raw);
    if (stateHit) out.state = out.state ?? stateHit;

    // Crude split on commas, pick first token as suburb/city
    const first = raw.split(',')[0].trim();
    if (first && !/^\d{4}$/.test(first) && !isStateToken(first)) {
      // We don’t distinguish suburb vs city rigorously here
      out.city = first;
      out.suburb = first;
    }
  }

  return out;
}

function mapStateAbbrev(s) {
  const t = s.toUpperCase();
  const map = {
    NSW: 'NSW',
    'NEW SOUTH WALES': 'NSW',
    VIC: 'VIC',
    VICTORIA: 'VIC',
    QLD: 'QLD',
    QUEENSLAND: 'QLD',
    WA: 'WA',
    'WESTERN AUSTRALIA': 'WA',
    SA: 'SA',
    'SOUTH AUSTRALIA': 'SA',
    TAS: 'TAS',
    TASMANIA: 'TAS',
    NT: 'NT',
    'NORTHERN TERRITORY': 'NT',
    ACT: 'ACT',
    'AUSTRALIAN CAPITAL TERRITORY': 'ACT'
  };
  return map[t] || null;
}
function findStateInText(txt) {
  const u = txt.toUpperCase();
  const tokens = [
    'NSW',
    'VIC',
    'QLD',
    'WA',
    'SA',
    'TAS',
    'NT',
    'ACT',
    'NEW SOUTH WALES',
    'VICTORIA',
    'QUEENSLAND',
    'WESTERN AUSTRALIA',
    'SOUTH AUSTRALIA',
    'TASMANIA',
    'NORTHERN TERRITORY',
    'AUSTRALIAN CAPITAL TERRITORY'
  ];
  for (const tok of tokens) {
    if (u.includes(tok)) return mapStateAbbrev(tok);
  }
  return null;
}
function isStateToken(s) {
  return !!mapStateAbbrev(s);
}

// ---------------------- Azure Function ----------------------
module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  try {
    if (missingSearchEnv.length > 0) {
      const details = `Missing required environment variables: ${missingSearchEnv.join(', ')}`;
      context.log.error(details);
      context.res = {
        status: 500,
        headers: corsHeaders,
        body: { error: 'Product search not configured', details }
      };
      return;
    }
    if (!database) {
      const details = 'Missing required environment variable: COSMOS_CONNECTION_STRING';
      context.log.error(details);
      context.res = {
        status: 500,
        headers: corsHeaders,
        body: { error: 'Product search not configured', details }
      };
      return;
    }

    const { problem, category, maxPrice } = req.body || {};
    const userLoc = normaliseLocation(req.body || {}); // parse location/state/postcode if any

    if (!problem) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: { error: 'Problem description required' }
      };
      return;
    }

    // 1) Search AI Search
    let searchResults;
    try {
      searchResults = await searchProducts(searchClient, problem, category, maxPrice, userLoc);
    } catch (e) {
      context.log.error('searchProducts failed:', e?.message, e?.response?.status, e?.response?.data);
      throw e;
    }

    // 2) Hydrate with Cosmos details when possible
    const detailedProducts = await getProductDetails(database, searchResults);

    // 3) Find professionals (simple)
    const professionals = await findProfessionals(database, problem, userLoc);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: {
        products: detailedProducts.map(toProductSchema),
        professionals: professionals.map(toProfessionalSchema),
        location: userLoc,
        searchQuery: problem,
        totalResults: searchResults.length
      }
    };
  } catch (error) {
    context.log.error('Product matching error:', error);
    context.res = { status: 500, headers: corsHeaders, body: { error: 'Product search failed' } };
  }
};

// ---------------------- Search ----------------------
async function searchProducts(searchClient, problem, category, maxPrice, userLoc) {
  const filters = [];
  if (category) filters.push(`category eq '${escapeOData(category)}'`);
  if (maxPrice) filters.push(`price le ${Number(maxPrice)}`);
  if (userLoc?.state) filters.push(`state eq '${escapeOData(userLoc.state)}'`);
  if (userLoc?.postcode) filters.push(`postcode eq ${Number(userLoc.postcode)}`);
  if (userLoc?.city) filters.push(`location eq '${escapeOData(userLoc.city)}'`);
  const filter = filters.length ? filters.join(' and ') : undefined;

  // Try SDK first (works on @azure/search-documents v12+)
  try {
    const options = {
      searchFields: ['name', 'description', 'problems'],
      top: 10,
      ...(filter ? { filter } : {})
    };
    const res = await searchClient.search(problem || '', options);

    const out = [];
    if (res && typeof res[Symbol.asyncIterator] === 'function') {
      // v12 iterator
      for await (const r of res) {
        const d = r.document || {};
        out.push(toResultRow(d, r.score));
      }
      return out;
    }

    // Older shapes (be defensive and only use arrays)
    const candidates = [];
    if (Array.isArray(res?.results)) candidates.push(res.results);
    if (Array.isArray(res?.value)) candidates.push(res.value);
    if (Array.isArray(res?.documents)) candidates.push(res.documents);
    if (Array.isArray(res)) candidates.push(res);

    for (const arr of candidates) {
      for (const r of arr) {
        const doc = r?.document ?? r;
        const score = r?.score ?? null;
        out.push(toResultRow(doc, score));
      }
      if (out.length) return out;
    }

    // If we reach here, fall back to REST
    throw new Error('SDK response shape unsupported; using REST fallback');
  } catch (e) {
    return await restSearchProducts(problem, filter);
  }
}

// REST fallback helper (requires SEARCH_ENDPOINT, SEARCH_API_KEY, INDEX_NAME)
async function restSearchProducts(problem, filter) {
  const endpoint = process.env.SEARCH_ENDPOINT; // e.g. https://homerepair-search.search.windows.net
  const index = process.env.SEARCH_INDEX || 'products-index';
  const apiKey = process.env.SEARCH_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error('Missing SEARCH_ENDPOINT or SEARCH_API_KEY for REST fallback');
  }

  const url = `${endpoint.replace(/\/+$/, '')}/indexes/${encodeURIComponent(index)}/docs/search?api-version=2024-07-01`;

  const body = {
    search: problem || '',
    queryType: 'simple',
    top: 10,
    ...(filter ? { filter } : {}),
    searchFields: 'name,description,problems'
  };

  const { data } = await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    timeout: 8000
  });

  const values = Array.isArray(data?.value) ? data.value : [];
  return values.map((v) => {
    const d = v || {};
    const score = typeof d['@search.score'] === 'number' ? d['@search.score'] : null;
    return toResultRow(d, score);
  });
}

function toResultRow(d, score) {
  return {
    id: d?.id,
    name: d?.name ?? null,
    category: d?.category ?? null,
    price: toNum(d?.price),
    supplier: d?.supplier ?? null,
    location: d?.location ?? null,
    state: d?.state ?? null,
    postcode: toNum(d?.postcode),
    problems: Array.isArray(d?.problems) ? d.problems : d?.problems ? [d.problems] : [],
    rating: toNum(d?.rating),
    link: d?.link || d?.url || d?.productUrl || null,
    productUrl: d?.productUrl || d?.link || d?.url || null,
    imageUrl: d?.imageUrl ?? null,
    lastUpdated: d?.lastUpdated ?? null,
    score: score ?? null
  };
}
function toNum(x) {
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

// ---------------------- Cosmos Hydration ----------------------
async function getProductDetails(database, searchResults) {
  const container = database.container('products');
  const enriched = [];

  for (const r of searchResults) {
    try {
      if (!r.id || !r.category) throw new Error('missing id or category for detail read');
      const { resource } = await container.item(r.id, r.category).read();

      enriched.push({
        ...r,
        price: pickNumber(resource.price, r.price),
        priceLow: pickNumber(resource.priceLow, null),
        priceHigh: pickNumber(resource.priceHigh, null),
        link: resource.link || resource.productUrl || resource.url || r.link || null,
        productUrl: resource.productUrl || resource.link || resource.url || r.productUrl || null,
        problems: Array.isArray(resource.problems) ? resource.problems : r.problems,
        rating: pickNumber(resource.rating, r.rating),
        imageUrl: resource.imageUrl || r.imageUrl || null,
        lastUpdated: resource.lastUpdated || r.lastUpdated || null,
        state: resource.state || r.state || null,
        postcode: isNumber(resource.postcode) ? Number(resource.postcode) : r.postcode ?? null,
        searchScore: r.score
      });
    } catch {
      enriched.push({
        ...r,
        priceLow: null,
        priceHigh: null,
        searchScore: r.score
      });
    }
  }
  return enriched;
}

// ---------------------- Professionals ----------------------
async function findProfessionals(database, problem, userLoc) {
  const container = database.container('professionals');
  const service = extractServiceType(problem);

  // Prefer exact state match if provided; otherwise city/locality; fallback to no location filter
  let query = 'SELECT TOP 5 * FROM c WHERE CONTAINS(LOWER(c.servicesConcat), LOWER(@service))';
  const params = [{ name: '@service', value: service }];

  if (userLoc.state) {
    query += ' AND c.state = @state';
    params.push({ name: '@state', value: userLoc.state });
  } else if (userLoc.city) {
    query += ' AND ARRAY_CONTAINS(c.serviceAreas, @city)';
    params.push({ name: '@city', value: userLoc.city });
  }

  const { resources } = await container.items.query({ query, parameters: params }).fetchAll();
  return resources || [];
}

// ---------------------- Normalizers (Schemas) ----------------------
function toProductSchema(p) {
  return {
    id: String(p.id),
    name: p.name ?? null,
    category: p.category ?? null,
    price: isNumber(p.price) ? Number(p.price) : null,
    priceLow: isNumber(p.priceLow) ? Number(p.priceLow) : null,
    priceHigh: isNumber(p.priceHigh) ? Number(p.priceHigh) : null,
    supplier: p.supplier ?? null,
    location: p.location ?? null,
    state: p.state ?? null,
    postcode: isNumber(p.postcode) ? Number(p.postcode) : null,
    problems: Array.isArray(p.problems) ? p.problems : [],
    rating: isNumber(p.rating) ? Number(p.rating) : null,
    link: p.link ?? null,
    productUrl: p.productUrl ?? null,
    imageUrl: p.imageUrl ?? null,
    lastUpdated: p.lastUpdated ?? null,
    searchScore: isNumber(p.searchScore ?? p.score) ? Number(p.searchScore ?? p.score) : null
  };
}

function toProfessionalSchema(pro) {
  return {
    id: String(pro.id || pro._rid || cryptoRandomId()),
    name: pro.businessName || pro.name || null,
    services: Array.isArray(pro.services) ? pro.services : [],
    serviceAreas: Array.isArray(pro.serviceAreas) ? pro.serviceAreas : [],
    phone: pro.phone ?? null,
    website: pro.website ?? null,
    rating: isNumber(pro.rating) ? Number(pro.rating) : null,
    state: pro.state ?? null
  };
}

// ---------------------- Utils ----------------------
function extractServiceType(problem) {
  const serviceMap = {
    plumbing: ['leak', 'pipe', 'tap', 'water', 'drain'],
    electrical: ['wiring', 'power', 'light', 'switch', 'outlet'],
    carpentry: ['door', 'window', 'cabinet', 'shelf', 'wood'],
    painting: ['paint', 'wall', 'ceiling', 'color'],
    general_maintenance: ['repair', 'fix', 'maintenance', 'broken', 'crack', 'stain']
  };
  const t = (problem || '').toLowerCase();
  for (const [service, keywords] of Object.entries(serviceMap)) {
    if (keywords.some((k) => t.includes(k))) return service;
  }
  return 'general_maintenance';
}
function escapeOData(s = '') {
  return String(s).replace(/'/g, "''");
}
function isNumber(x) {
  return typeof x === 'number' && Number.isFinite(x);
}
function pickNumber(a, b) {
  return isNumber(a) ? a : isNumber(b) ? b : null;
}
function cryptoRandomId() {
  return Math.random().toString(36).slice(2);
}