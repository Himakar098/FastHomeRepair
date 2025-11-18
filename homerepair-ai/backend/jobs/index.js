const { CosmosClient } = require('@azure/cosmos');
const { validateJwt } = require('../common/auth');
const { v4: uuidv4 } = require('uuid');

const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin'
};

const cosmos = process.env.COSMOS_CONNECTION_STRING
  ? new CosmosClient(process.env.COSMOS_CONNECTION_STRING)
  : null;

function normalizeText(value, max = 4000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
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

  const db = cosmos.database('homerepair-db');
  const jobs = db.container('jobs');
  const professionals = db.container('professionals');

  if (req.method === 'POST') {
    const { title, description, summary, conversationId, preferredTime, budgetMin, budgetMax, location, products } =
      req.body || {};
    const cleanTitle = normalizeText(title || summary || 'Home repair request', 180);
    const cleanDesc = normalizeText(description || summary || '', 4000);
    if (!cleanDesc) {
      context.res = { status: 400, headers: corsHeaders, body: { error: 'description is required' } };
      return;
    }

    const job = {
      id: uuidv4(),
      userId: sub,
      conversationId: typeof conversationId === 'string' ? conversationId : null,
      title: cleanTitle,
      summary: normalizeText(summary || cleanDesc, 1000),
      description: cleanDesc,
      preferredTime: normalizeText(preferredTime || '', 120),
      budgetMin: Number.isFinite(Number(budgetMin)) ? Number(budgetMin) : null,
      budgetMax: Number.isFinite(Number(budgetMax)) ? Number(budgetMax) : null,
      location: typeof location === 'object' && location ? location : null,
      products: Array.isArray(products) ? products.slice(0, 6) : [],
      status: 'open',
      quotes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await jobs.items.create(job);
    context.res = { status: 201, headers: corsHeaders, body: job };
    return;
  }

  // GET handlers
  const role = String(req.query.role || 'user').toLowerCase();
  const jobId = req.query.jobId;

  if (jobId) {
    try {
      const { resource } = await jobs.item(jobId, jobId).read();
      if (!resource) {
        context.res = { status: 404, headers: corsHeaders, body: { error: 'Job not found' } };
        return;
      }
      if (resource.userId !== sub && role !== 'professional') {
        // allow professionals to view if job open
        if (resource.status !== 'open') {
          context.res = { status: 403, headers: corsHeaders, body: { error: 'Forbidden' } };
          return;
        }
      }
      context.res = { status: 200, headers: corsHeaders, body: resource };
      return;
    } catch (err) {
      context.log.warn('job fetch failed', err?.message);
      context.res = { status: 404, headers: corsHeaders, body: { error: 'Job not found' } };
      return;
    }
  }

  try {
    if (role === 'professional') {
      const { resource: pro } = await professionals.item(sub, sub).read().catch(() => ({ resource: null }));
      if (!pro) {
        context.res = {
          status: 403,
          headers: corsHeaders,
          body: { error: 'Professional profile required' }
        };
        return;
      }
      const query = {
        query:
          'SELECT TOP 30 * FROM c WHERE c.status = "open" ORDER BY c.createdAt DESC'
      };
      const { resources } = await jobs.items.query(query).fetchAll();
      context.res = { status: 200, headers: corsHeaders, body: resources || [] };
      return;
    }

    const query = {
      query: 'SELECT TOP 30 * FROM c WHERE c.userId = @user ORDER BY c.createdAt DESC',
      parameters: [{ name: '@user', value: sub }]
    };
    const { resources } = await jobs.items.query(query).fetchAll();
    context.res = { status: 200, headers: corsHeaders, body: resources || [] };
  } catch (err) {
    context.log.error('jobs GET error', err);
    context.res = { status: 500, headers: corsHeaders, body: { error: 'Failed to load jobs' } };
  }
};
