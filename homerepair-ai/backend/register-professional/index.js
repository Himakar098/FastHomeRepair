const { CosmosClient } = require('@azure/cosmos');
const { validateJwt } = require('../common/auth');

const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin'
};

const cosmos = process.env.COSMOS_CONNECTION_STRING
  ? new CosmosClient(process.env.COSMOS_CONNECTION_STRING)
  : null;

function mapStateAbbrev(s) {
  const t = String(s || '').toUpperCase();
  const map = { NSW:'NSW','NEW SOUTH WALES':'NSW', VIC:'VIC','VICTORIA':'VIC', QLD:'QLD','QUEENSLAND':'QLD', WA:'WA','WESTERN AUSTRALIA':'WA', SA:'SA','SOUTH AUSTRALIA':'SA', TAS:'TAS','TASMANIA':'TAS', NT:'NT','NORTHERN TERRITORY':'NT', ACT:'ACT','AUSTRALIAN CAPITAL TERRITORY':'ACT' };
  return map[t] || null;
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }
  if (!cosmos) {
    context.res = { status: 500, headers: corsHeaders, body: { error: 'COSMOS_CONNECTION_STRING missing' } };
    return;
  }

  // Auth
  const authz = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  let claims;
  try { claims = await validateJwt(token); } catch { claims = null; }
  const sub = claims?.sub;
  if (!sub) {
    context.res = { status: 401, headers: corsHeaders, body: { error: 'Unauthorized' } };
    return;
  }

  // Validate body
  const { businessName, phone, website, state, serviceAreas, abn } = req.body || {};
  if (!businessName || typeof businessName !== 'string' || businessName.length > 150) {
    context.res = { status: 400, headers: corsHeaders, body: { error: 'businessName is required (<=150 chars)' } };
    return;
  }
  let stateCode = mapStateAbbrev(state);
  if (!stateCode) {
    context.res = { status: 400, headers: corsHeaders, body: { error: 'state is required (AUS state/territory)' } };
    return;
  }
  const areas = Array.isArray(serviceAreas) ? serviceAreas.filter(a => typeof a === 'string' && a.trim()).slice(0, 20) : [];

  if (phone && !/^[0-9+ ]{6,20}$/.test(phone)) {
    context.res = { status: 400, headers: corsHeaders, body: { error: 'phone invalid' } };
    return;
  }
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) {
    context.res = { status: 400, headers: corsHeaders, body: { error: 'website must start with http(s)://' } };
    return;
  }
  if (abn && !/^\d{11}$/.test(abn.replace(/\s/g, ''))) {
    context.res = { status: 400, headers: corsHeaders, body: { error: 'ABN must be 11 digits (no spaces)' } };
    return;
  }

  const db = cosmos.database('homerepair-db');
  const pros = db.container('professionals');

  const item = {
    id: sub,                 // owner is always the signed-in user
    ownerId: sub,
    businessName,
    phone: phone || null,
    website: website || null,
    state: stateCode,
    serviceAreas: areas,
    abn: abn || null,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  try {
    const existing = await pros.item(sub, sub).read().catch(() => null);
    if (existing?.resource?.createdAt) item.createdAt = existing.resource.createdAt;

    await pros.items.upsert(item, { partitionKey: sub });
    context.res = { status: 200, headers: corsHeaders, body: { ok: true, professional: item } };
  } catch (e) {
    context.log.error('register-professional error', e);
    context.res = { status: 500, headers: corsHeaders, body: { error: 'Failed to save professional profile' } };
  }
};
