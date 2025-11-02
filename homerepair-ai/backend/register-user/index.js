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
  try {
    claims = await validateJwt(token);
  } catch {
    context.res = { status: 401, headers: corsHeaders, body: { error: 'Unauthorized' } };
    return;
  }
  const sub = claims?.sub;
  if (!sub) {
    context.res = { status: 401, headers: corsHeaders, body: { error: 'Unauthorized' } };
    return;
  }

  // Validate body
  const {
    preferredUsername,
    displayName,
    contactEmail,
    mobileNumber,
    address
  } = req.body || {};

  const usernameCandidates = [preferredUsername, displayName].filter(v => typeof v === 'string' && v.trim());
  const username = usernameCandidates.length ? usernameCandidates[0].trim() : '';
  if (!username || username.length > 100) {
    context.res = { status: 400, headers: corsHeaders, body: { error: 'preferredUsername is required (<=100 chars)' } };
    return;
  }

  const emailClaims = [];
  if (contactEmail) emailClaims.push(contactEmail);
  if (Array.isArray(claims?.emails)) emailClaims.push(...claims.emails);
  if (claims?.email) emailClaims.push(claims.email);
  if (claims?.preferred_username) emailClaims.push(claims.preferred_username);
  const email = emailClaims.find(e => typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) || null;
  if (!email) {
    context.res = { status: 400, headers: corsHeaders, body: { error: 'A valid email address is required' } };
    return;
  }

  let mobile = null;
  if (typeof mobileNumber === 'string' && mobileNumber.trim()) {
    const cleaned = mobileNumber.trim();
    if (!/^[0-9+ ()-]{6,20}$/.test(cleaned)) {
      context.res = { status: 400, headers: corsHeaders, body: { error: 'mobileNumber invalid' } };
      return;
    }
    mobile = cleaned;
  }

  let addressClean = null;
  if (typeof address === 'string' && address.trim()) {
    const trimmed = address.trim();
    if (trimmed.length > 280) {
      context.res = { status: 400, headers: corsHeaders, body: { error: 'address must be 280 characters or fewer' } };
      return;
    }
    addressClean = trimmed;
  }

  const db = cosmos.database('homerepair-db');
  const users = db.container('users');

  const item = {
    id: sub,
    displayName: username,
    preferredUsername: username,
    contactEmail: email,
    mobileNumber: mobile,
    address: addressClean,
    defaultUserId: sub,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  // Upsert while preserving createdAt if exists
  try {
    const existing = await users.item(sub, sub).read().catch(() => null);
    if (existing?.resource?.createdAt) item.createdAt = existing.resource.createdAt;

    await users.items.upsert(item, { partitionKey: sub });
    context.res = { status: 200, headers: corsHeaders, body: { ok: true, user: item } };
  } catch (e) {
    context.log.error('register-user error', e);
    context.res = { status: 500, headers: corsHeaders, body: { error: 'Failed to save profile' } };
  }
};
