const { CosmosClient } = require('@azure/cosmos');
const { validateJwt } = require('../common/auth');

const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  const authz = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  let claims;
  try { claims = await validateJwt(token); } catch { claims = null; }
  const sub = claims?.sub;
  if (!sub) {
    context.res = { status: 401, headers: corsHeaders, body: { error: 'Unauthorized' } };
    return;
  }

  try {
    const db = cosmos.database('homerepair-db');
    const users = db.container('users');
    const pros  = db.container('professionals');

    const [u, p] = await Promise.all([
      users.item(sub, sub).read().catch(() => ({ resource: null })),
      pros.item(sub, sub).read().catch(() => ({ resource: null })),
    ]);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: { user: u.resource || null, professional: p.resource || null }
    };
  } catch (e) {
    context.log.error('get-profile error', e);
    context.res = { status: 500, headers: corsHeaders, body: { error: 'Failed to fetch profile' } };
  }
};
