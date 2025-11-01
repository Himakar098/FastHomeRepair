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
  const map = {
    NSW: 'NSW',
    'NEW SOUTH WALES': 'NSW',
    VIC: 'VIC',
    'VICTORIA': 'VIC',
    QLD: 'QLD',
    'QUEENSLAND': 'QLD',
    WA: 'WA',
    'WESTERN AUSTRALIA': 'WA',
    SA: 'SA',
    'SOUTH AUSTRALIA': 'SA',
    TAS: 'TAS',
    'TASMANIA': 'TAS',
    NT: 'NT',
    'NORTHERN TERRITORY': 'NT',
    ACT: 'ACT',
    'AUSTRALIAN CAPITAL TERRITORY': 'ACT'
  };
  return map[t] || null;
}

// Helper to flatten services array into concatenated lowercase string for searching
function concatServices(services) {
  if (!Array.isArray(services) || services.length === 0) return '';
  return services
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => s.trim().toLowerCase())
    .join(',');
}

function normaliseList(value, max = 20) {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .slice(0, max);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, max);
  }
  return [];
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }
  if (!cosmos) {
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: 'COSMOS_CONNECTION_STRING missing' }
    };
    return;
  }

  // Auth
  const authz = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  let claims;
  try {
    claims = await validateJwt(token);
  } catch {
    claims = null;
  }
  const sub = claims?.sub;
  if (!sub) {
    context.res = { status: 401, headers: corsHeaders, body: { error: 'Unauthorized' } };
    return;
  }

  // Validate body
  const {
    businessName,
    phone,
    website,
    state,
    serviceAreas,
    abn,
    services,
    tradeQualifications,
    certifications,
    yearsExperience,
    licenceNumbers,
    insuranceProvider,
    insurancePolicyNumber,
    insuranceExpiry
  } = req.body || {};
  const businessNameClean = typeof businessName === 'string' ? businessName.trim() : '';
  const websiteClean = typeof website === 'string' ? website.trim() : '';
  const abnDigits = typeof abn === 'string' ? abn.replace(/\s/g, '') : '';
  const insuranceName = typeof insuranceProvider === 'string' ? insuranceProvider.trim() : '';
  const phoneClean = typeof phone === 'string' ? phone.trim() : '';
  if (!businessNameClean || businessNameClean.length > 150) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'businessName is required (<=150 chars)' }
    };
    return;
  }
  let stateCode = mapStateAbbrev(state);
  if (!stateCode) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'state is required (AUS state/territory)' }
    };
    return;
  }
  const areas = normaliseList(serviceAreas);
  if (areas.length === 0) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'Provide at least one service area' }
    };
    return;
  }

  const serviceList = normaliseList(services);
  if (serviceList.length === 0) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'Provide at least one service offered' }
    };
    return;
  }

  const qualificationList = normaliseList(tradeQualifications);
  if (qualificationList.length === 0) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'At least one trade qualification is required' }
    };
    return;
  }

  const certificationList = normaliseList(certifications);
  if (certificationList.length === 0) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'At least one certification is required' }
    };
    return;
  }

  const licenceList = normaliseList(licenceNumbers || []);
  if (licenceList.length === 0) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'At least one licence number is required' }
    };
    return;
  }

  const years = Number(yearsExperience);
  if (!Number.isFinite(years) || years < 1 || years > 80) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'yearsExperience must be between 1 and 80' }
    };
    return;
  }

  if (!insuranceName || insuranceName.length < 2) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'insuranceProvider is required' }
    };
    return;
  }

  if (phoneClean && !/^[0-9+ ]{6,20}$/.test(phoneClean)) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'phone invalid' }
    };
    return;
  }
  if (!websiteClean || !/^https?:\/\/[\S]+$/i.test(websiteClean)) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'website must start with http(s)://' }
    };
    return;
  }
  if (!abnDigits || !/^\d{11}$/.test(abnDigits)) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: 'ABN must be 11 digits (no spaces)' }
    };
    return;
  }

  const db = cosmos.database('homerepair-db');
  const pros = db.container('professionals');

  const now = new Date().toISOString();
  const item = {
    id: sub, // owner is always the signed-in user
    ownerId: sub,
    businessName: businessNameClean,
    phone: phoneClean || null,
    website: websiteClean,
    state: stateCode,
    serviceAreas: areas,
    services: serviceList,
    servicesConcat: concatServices(serviceList),
    abn: abnDigits,
    tradeQualifications: qualificationList,
    certifications: certificationList,
    licenceNumbers: licenceList,
    yearsExperience: Math.round(years),
    insuranceProvider: insuranceName,
    insurancePolicyNumber: typeof insurancePolicyNumber === 'string' ? insurancePolicyNumber.trim() || null : null,
    insuranceExpiry: typeof insuranceExpiry === 'string' ? insuranceExpiry.trim() || null : null,
    updatedAt: now,
    createdAt: now,
    verificationStatus: 'pending_review'
  };

  try {
    const existing = await pros.item(sub, sub).read().catch(() => null);
    if (existing?.resource) {
      if (existing.resource.createdAt) item.createdAt = existing.resource.createdAt;
      if (existing.resource.verificationStatus) item.verificationStatus = existing.resource.verificationStatus;
      if (existing.resource.reviewNotes) item.reviewNotes = existing.resource.reviewNotes;
    }

    await pros.items.upsert(item, { partitionKey: sub });
    context.res = {
      status: 200,
      headers: corsHeaders,
      body: { ok: true, professional: item }
    };
  } catch (e) {
    context.log.error('register-professional error', e);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: 'Failed to save professional profile' }
    };
  }
};
