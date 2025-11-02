// Modified product matcher to include productUrl and price ranges
const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');
const { CosmosClient } = require('@azure/cosmos');
const axios = require('axios');
const cheerio = require('cheerio');

const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;
const hasGoogleSearch = Boolean(GOOGLE_SEARCH_KEY && GOOGLE_SEARCH_CX);

const REALTIME_PRODUCT_HOSTS = [
  'bunnings',
  'mitre10',
  'ikea',
  'amazon',
  'ebay',
  'officeworks',
  'totaltools',
  'supercheapauto',
  'repcotrade',
  'repcobusiness',
  'toolmart',
  'autobarn'
];

const REALTIME_PRO_HOSTS = [
  'hipages',
  'airtasker',
  'jimsmowing',
  'jimscleaning',
  'jimsgroup',
  'serviceseeking',
  'oneflare',
  'localsearch',
  'service.com.au',
  'urbancompany',
  'fixitfaster'
];

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

    // 4) Try to enrich with on-demand web search / scraping for fresher stock.
    let fallbackProducts = [];
    let fallbackPros = [];
    try {
      const terms = deriveSearchTerms(problem, category);
      for (const term of terms) {
        // accumulate unique products from multiple queries
        const items = await fetchBunningsProducts(term);
        fallbackProducts.push(...items);
        if (fallbackProducts.length >= 8) break;
      }
      // Deduplicate by id
      const map = new Map();
      for (const p of fallbackProducts) {
        if (!map.has(p.id)) map.set(p.id, p);
      }
      fallbackProducts = Array.from(map.values());

      if (!professionals.length) {
        const svc = extractServiceType(problem);
        // Use city if provided, otherwise state
        const loc = userLoc.city || userLoc.state || '';
        fallbackPros = await fetchProfessionals(svc, loc);
      }
    } catch (err) {
      context.log.warn('Fallback search error:', err.message);
    }

    const realtimeResults = await fetchRealtimeResults(problem, userLoc, {
      serviceHint: extractServiceType(problem)
    });

    const realtimeProductSchemas = realtimeResults
      .filter((r) => r.type === 'product')
      .map((item) => toProductSchema(realtimeResultToProduct(item, userLoc)));

    const realtimeProfessionalSchemas = realtimeResults
      .filter((r) => r.type === 'professional')
      .map((item) => toProfessionalSchema(realtimeResultToProfessional(item, userLoc)));

    const productSchemas = [
      ...realtimeProductSchemas,
      ...detailedProducts.map(toProductSchema),
      ...fallbackProducts.map(toProductSchema)
    ];

    const professionalSchemas = [
      ...realtimeProfessionalSchemas,
      ...professionals.map(toProfessionalSchema),
      ...fallbackPros.map(toProfessionalSchema)
    ];

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: {
        products: dedupeProducts(productSchemas),
        professionals: dedupeProfessionals(professionalSchemas),
        location: userLoc,
        searchQuery: problem,
        totalResults: searchResults.length,
        realtimeResults,
        realtimeProducts: realtimeProductSchemas,
        realtimeProfessionals: realtimeProfessionalSchemas
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
  // Build a WHERE clause that matches either the derived servicesConcat string
  // or the original services array.  Some seeded data may not define
  // servicesConcat, so we fall back to ARRAY_CONTAINS on c.services.
  let query =
    'SELECT TOP 5 * FROM c WHERE ((IS_DEFINED(c.servicesConcat) AND CONTAINS(LOWER(c.servicesConcat), LOWER(@service))) OR ARRAY_CONTAINS(c.services, @service))';
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

// ---------------------- Google Custom Search ----------------------
async function fetchRealtimeResults(problem, userLoc, options = {}) {
  if (!hasGoogleSearch) return [];
  const queryParts = [];
  const userQuery = String(problem || '').trim();
  if (userQuery) queryParts.push(userQuery);

  const locationTokens = [];
  if (userLoc?.city) locationTokens.push(userLoc.city);
  if (userLoc?.state) locationTokens.push(userLoc.state);
  if (userLoc?.postcode) locationTokens.push(String(userLoc.postcode));
  if (locationTokens.length) {
    queryParts.push(locationTokens.join(' '));
  }

  const serviceHint = options.serviceHint;
  if (serviceHint && serviceHint !== 'general_maintenance' && !userQuery.includes(serviceHint)) {
    queryParts.push(serviceHint.replace(/_/g, ' '));
  }

  const query = queryParts.join(' ').trim();
  if (!query) return [];

  try {
    const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: GOOGLE_SEARCH_KEY,
        cx: GOOGLE_SEARCH_CX,
        q: query,
        num: 5,
        gl: 'au',
        lr: 'lang_en',
        cr: 'countryAU',
        safe: 'active'
      },
      timeout: 8000
    });

    const items = Array.isArray(data?.items) ? data.items : [];
    return items
      .map(normalizeRealtimeItem)
      .filter(Boolean)
      .slice(0, 3);
  } catch (err) {
    console.warn('Google Custom Search failed:', err?.message || err);
    return [];
  }
}

function normalizeRealtimeItem(item) {
  if (!item || !item.link || !item.title) return null;
  const snippet = stripHtml(item.snippet || item.htmlSnippet || '');
  const hostname = parseHostname(item.link);
  return {
    id: item.cacheId || item.link,
    title: item.title,
    link: item.link,
    displayLink: item.displayLink || hostname,
    snippet,
    type: classifyRealtimeResult(hostname, snippet),
    source: 'google'
  };
}

function classifyRealtimeResult(hostname, snippet) {
  const host = String(hostname || '').toLowerCase();
  const text = String(snippet || '').toLowerCase();
  if (REALTIME_PRODUCT_HOSTS.some((token) => host.includes(token))) return 'product';
  if (REALTIME_PRO_HOSTS.some((token) => host.includes(token))) return 'professional';
  if (/\b(buy|price|shop|product|kit|pack|store)\b/.test(text)) return 'product';
  if (/\b(hire|service|plumber|electrician|technician|contractor|repair|tradie)\b/.test(text)) return 'professional';
  return 'general';
}

function parseHostname(link) {
  try {
    return new URL(link).hostname;
  } catch {
    return '';
  }
}

function stripHtml(input = '') {
  return String(input).replace(/<[^>]+>/g, '');
}

function realtimeResultToProduct(item, userLoc) {
  return {
    id: `realtime-${item.id || item.link}`,
    name: item.title || item.displayLink || 'Product',
    category: null,
    price: null,
    priceLow: null,
    priceHigh: null,
    supplier: item.displayLink
      ? `Live web – ${item.displayLink}`
      : `Live web – ${parseHostname(item.link) || 'online'}`,
    location: userLoc?.city || null,
    state: userLoc?.state || null,
    postcode: userLoc?.postcode ?? null,
    problems: [],
    rating: null,
    link: item.link || null,
    productUrl: item.link || null,
    imageUrl: null,
    lastUpdated: new Date().toISOString(),
    searchScore: null
  };
}

function realtimeResultToProfessional(item, userLoc) {
  return {
    id: `realtime-pro-${item.id || item.link}`,
    name: item.title || item.displayLink || 'Professional',
    services: [],
    serviceAreas: userLoc?.city ? [userLoc.city] : [],
    phone: null,
    website: item.link || null,
    rating: null,
    state: userLoc?.state || null
  };
}

function dedupeProducts(products = []) {
  const seen = new Set();
  const result = [];
  for (const product of products) {
    if (!product) continue;
    const key = (product.link || product.productUrl || product.id || '').toLowerCase();
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(product);
  }
  return result;
}

function dedupeProfessionals(pros = []) {
  const seen = new Set();
  const result = [];
  for (const pro of pros) {
    if (!pro) continue;
    const key = (pro.website || pro.id || '').toLowerCase();
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(pro);
  }
  return result;
}

// ------------------------------------------------------------------------
// Fallback web search helpers
// These functions perform a simple scrape of the Bunnings website and
// DuckDuckGo search results to provide products and professionals when
// nothing is found in our Azure Search index or database.  They are
// intentionally lightweight and intended for occasional use.  For
// production use you should integrate official APIs.

/**
 * Scrape product listings from Bunnings for a given query.  Returns an
 * array of objects compatible with the product schema used elsewhere.
 * Note: network access may be restricted in some deployments; in that
 * case this function will return an empty array.
 *
 * @param {string} query
 * @returns {Promise<Array>}
 */
async function fetchBunningsProducts(query) {
  const products = [];
  const encoded = encodeURIComponent(query || '');
  const url = `https://www.bunnings.com.au/search/products?q=${encoded}`;
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36'
      },
      timeout: 15000
    });
    const $ = cheerio.load(data);
    $('.product-list__item').each((_, el) => {
      const $el = $(el);
      const id = $el.attr('data-sku') || null;
      const name = $el.find('.product-title').text().trim();
      const priceText = $el.find('.product-price__price').text().trim();
      let price = null;
      const match = priceText.match(/\$([\d,.]+)/);
      if (match) price = parseFloat(match[1].replace(/,/g, ''));
      const linkRel = $el.find('a.product-title-link').attr('href') || null;
      const link = linkRel ? `https://www.bunnings.com.au${linkRel}` : null;
      const imageUrl = $el.find('.product-image img').attr('src') || null;
      if (name) {
        products.push({
          id: id || name,
          name,
          category: null,
          price,
          priceLow: null,
          priceHigh: null,
          supplier: 'Bunnings',
          location: null,
          state: null,
          postcode: null,
          problems: [],
          rating: null,
          link,
          imageUrl,
          lastUpdated: new Date().toISOString()
        });
      }
    });
  } catch (err) {
    // Log and return empty; network may be unavailable
    console.warn('Failed to fetch Bunnings products:', err.message);
  }
  return products;
}

/**
 * Derive search keywords from a user problem description to improve
 * the likelihood of finding relevant products on Bunnings.  If the
 * input mentions glass, showers or hard water stains, return
 * appropriate cleaner keywords.  Extend this mapping as new use
 * cases are discovered.
 *
 * @param {string} problem
 * @returns {string[]}
 */
function deriveSearchTerms(problem, category) {
  const terms = new Set();
  const text = String(problem || '').toLowerCase();
  const cat = String(category || '').toLowerCase();

  // Mould / mildew in wet areas
  if (text.includes('mould') || text.includes('mold') || cat.includes('mould')) {
    terms.add('mould remover');
    terms.add('bathroom mould cleaner');
    if (/(shower|showerhead|shower head)/.test(text)) {
      terms.add('shower mould cleaner');
      terms.add('shower head cleaner');
    }
  }

  // Hard water / limescale on shower glass
  if (/(shower|glass|screen)/.test(text) && /(droplet|stain|deposit|scale|limescale|lime scale)/.test(text)) {
    terms.add('glass cleaner');
    terms.add('hard water stain remover');
    terms.add('limescale remover');
  }

  // Wooden furniture repair
  if (/bed|table|chair/.test(text) && /(broken|cracked|damaged)/.test(text)) {
    terms.add('wood repair kit');
    terms.add('wood glue');
  }

  // Plumbing leaks
  if (/(pipe|tap|leak|plumb)/.test(text)) {
    terms.add('plumbing repair kit');
    terms.add('pipe leak sealant');
  }

  // Electrical safety
  if (/(switch|outlet|powerpoint|socket)/.test(text)) {
    terms.add('electrical safety switch');
  }

  // Paint / wall fixes
  if (/(paint|wall|ceiling)/.test(text)) {
    terms.add('interior paint');
    terms.add('wall patch kit');
  }

  // Generic fallback – grab first few keywords
  if (terms.size === 0) {
    const match = text.match(/([a-z]{4,})/g);
    if (match) match.slice(0, 3).forEach((m) => terms.add(m));
  }

  // Always include the raw problem trimmed to keep context
  const trimmed = text.trim();
  if (trimmed) terms.add(trimmed);

  return Array.from(terms).filter(Boolean).slice(0, 5);
}

/**
 * Perform a basic DuckDuckGo search for local professionals.  Returns
 * up to 5 results with minimal fields.  For more robust data use
 * official business directories or APIs.
 *
 * @param {string} service
 * @param {string} location
 * @returns {Promise<Array>}
 */
async function fetchProfessionals(service, location) {
  const pros = [];
  const query = encodeURIComponent(`${service || ''} ${location || ''} site:hipages.com.au`);
  const url = `https://duckduckgo.com/html/?q=${query}`;
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36'
      },
      timeout: 15000
    });
    const $ = cheerio.load(data);
    $('a.result__a').each((i, el) => {
      if (i >= 5) return false;
      const link = $(el).attr('href');
      const name = $(el).text().trim();
      pros.push({
        id: `${service}-${location}-${i}`,
        name,
        services: [service],
        serviceAreas: [location],
        phone: null,
        website: link,
        rating: null,
        priceLow: null,
        priceHigh: null,
        state: null
      });
    });
  } catch (err) {
    console.warn('Failed to fetch professionals:', err.message);
  }
  return pros;
}
