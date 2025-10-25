const { CosmosClient } = require('@azure/cosmos');
const { validateJwt } = require('../common/auth');

const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin'
};

let cosmos = null;
if (process.env.COSMOS_CONNECTION_STRING) {
  cosmos = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
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

  // Require JWT
  const authz = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  let claims;
  try { claims = await validateJwt(token); } catch { claims = null; }
  const sub = claims?.sub;
  if (!sub) {
    context.res = { status: 401, headers: corsHeaders, body: { error: 'Unauthorized' } };
    return;
  }

  const limit = Math.max(1, Math.min(parseInt(req.query.limit || '20', 10) || 20, 50));
  const continuation = req.query.continuationToken || undefined;

  const db = cosmos.database('homerepair-db');
  const container = db.container('conversations');

  try {
    // Partition isolation: read only the user's partition
    const querySpec = {
      query: 'SELECT c.id, c.updatedAt, c.createdAt, ARRAY_SLICE(c.messages, -1, 1) AS lastMsg FROM c ORDER BY c.updatedAt DESC'
    };

    const iterator = container.items.query(querySpec, {
      partitionKey: sub,
      maxItemCount: limit,
      continuationToken: continuation
    });

    const { resources, continuationToken } = await iterator.fetchNext();

    // Make a small, safe preview
    const conversations = (resources || []).map(r => {
      const last = Array.isArray(r.lastMsg) && r.lastMsg[0] ? r.lastMsg[0] : null;
      const preview = last?.content ? String(last.content).slice(0, 180) : '';
      return {
        id: r.id,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
        lastPreview: preview,
        lastRole: last?.role || null
      };
    });

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: {
        items: conversations,
        continuationToken: continuationToken || null,
        pageSize: limit
      }
    };
  } catch (e) {
    context.log.error('list-conversations error:', e);
    context.res = { status: 500, headers: corsHeaders, body: { error: 'Failed to list conversations' } };
  }
};
