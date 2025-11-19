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

  const conversationId = req.query.id || req.query.conversationId;
  if (!conversationId) {
    context.res = { status: 400, headers: corsHeaders, body: { error: 'conversationId required' } };
    return;
  }

  const container = cosmos.database('homerepair-db').container('conversations');

  try {
    const { resource } = await container.item(conversationId, sub).read();
    if (!resource) {
      context.res = { status: 404, headers: corsHeaders, body: { error: 'Conversation not found' } };
      return;
    }

    if (Array.isArray(resource.messages) && resource.messages.length > 50) {
      resource.messages = resource.messages.slice(-50);
    }

    context.res = { status: 200, headers: corsHeaders, body: resource };
  } catch (err) {
    context.log.warn('get-conversation error', err?.message);
    context.res = { status: 404, headers: corsHeaders, body: { error: 'Conversation not found' } };
  }
};
