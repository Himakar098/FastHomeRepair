const { CosmosClient } = require('@azure/cosmos');
const { validateJwt } = require('../common/auth');
const { v4: uuidv4 } = require('uuid');

const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
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

  const db = cosmos.database('homerepair-db');
  const jobs = db.container('jobs');
  const professionals = db.container('professionals');

  async function readJob(jobId) {
    if (!jobId) {
      throw new Error('jobId required');
    }
    const { resource } = await jobs.item(jobId, jobId).read();
    if (!resource) throw new Error('Job not found');
    return resource;
  }

  if (req.method === 'POST') {
    const { jobId, priceMin, priceMax, availability, message } = req.body || {};
    if (!jobId) {
      context.res = { status: 400, headers: corsHeaders, body: { error: 'jobId required' } };
      return;
    }

    const { resource: pro } = await professionals.item(sub, sub).read().catch(() => ({ resource: null }));
    if (!pro) {
      context.res = { status: 403, headers: corsHeaders, body: { error: 'Professional profile required' } };
      return;
    }

    const job = await readJob(jobId);
    if (job.status !== 'open') {
      context.res = { status: 400, headers: corsHeaders, body: { error: 'Job is not accepting quotes' } };
      return;
    }

    const quote = {
      id: uuidv4(),
      professionalId: sub,
      professionalName: pro.businessName || pro.name || 'Professional',
      priceMin: Number.isFinite(Number(priceMin)) ? Number(priceMin) : null,
      priceMax: Number.isFinite(Number(priceMax)) ? Number(priceMax) : null,
      availability: typeof availability === 'string' ? availability.trim() : '',
      message: typeof message === 'string' ? message.trim().slice(0, 1000) : '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    job.quotes = Array.isArray(job.quotes) ? job.quotes : [];
    const already = job.quotes.find((q) => q.professionalId === sub);
    if (already) {
      Object.assign(already, quote, { id: already.id, createdAt: already.createdAt, updatedAt: new Date().toISOString() });
    } else {
      job.quotes.push(quote);
    }
    job.updatedAt = new Date().toISOString();
    await jobs.items.upsert(job);
    context.res = { status: 200, headers: corsHeaders, body: job };
    return;
  }

  if (req.method === 'PATCH') {
    const { jobId, quoteId, action, scheduledSlot } = req.body || {};
    if (!jobId || !quoteId || action !== 'accept') {
      context.res = { status: 400, headers: corsHeaders, body: { error: 'jobId, quoteId and action=accept required' } };
      return;
    }

    const job = await readJob(jobId);
    if (job.userId !== sub) {
      context.res = { status: 403, headers: corsHeaders, body: { error: 'Only job owner can accept quotes' } };
      return;
    }

    const quotes = Array.isArray(job.quotes) ? job.quotes : [];
    const target = quotes.find((q) => q.id === quoteId);
    if (!target) {
      context.res = { status: 404, headers: corsHeaders, body: { error: 'Quote not found' } };
      return;
    }

    quotes.forEach((q) => {
      q.status = q.id === quoteId ? 'accepted' : 'declined';
    });
    job.status = 'scheduled';
    job.scheduledSlot = typeof scheduledSlot === 'string' ? scheduledSlot.trim() : '';
    job.updatedAt = new Date().toISOString();
    await jobs.items.upsert(job);
    context.res = { status: 200, headers: corsHeaders, body: job };
    return;
  }

  // GET handler
  const role = String(req.query.role || 'user').toLowerCase();
  const jobId = req.query.jobId;

  try {
    if (jobId) {
      const job = await readJob(jobId);
      if (job.userId !== sub && role !== 'professional') {
        context.res = { status: 403, headers: corsHeaders, body: { error: 'Forbidden' } };
        return;
      }
      context.res = { status: 200, headers: corsHeaders, body: job.quotes || [] };
      return;
    }

    if (role === 'professional') {
      const { resource: pro } = await professionals.item(sub, sub).read().catch(() => ({ resource: null }));
      if (!pro) {
        context.res = { status: 403, headers: corsHeaders, body: { error: 'Professional profile required' } };
        return;
      }
      const query = {
        query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.quotes, { professionalId: @proId }, true)',
        parameters: [{ name: '@proId', value: sub }]
      };
      const { resources } = await jobs.items.query(query).fetchAll();
      const matches = resources.map((job) => ({
        jobId: job.id,
        title: job.title,
        status: job.status,
        quote: job.quotes.find((q) => q.professionalId === sub)
      }));
      context.res = { status: 200, headers: corsHeaders, body: matches };
      return;
    }

    const query = {
      query: 'SELECT * FROM c WHERE c.userId = @user AND ARRAY_LENGTH(c.quotes) > 0',
      parameters: [{ name: '@user', value: sub }]
    };
    const { resources } = await jobs.items.query(query).fetchAll();
    context.res = { status: 200, headers: corsHeaders, body: resources || [] };
  } catch (err) {
    context.log.error('job-quotes error', err);
    context.res = { status: 500, headers: corsHeaders, body: { error: 'Failed to fetch quotes' } };
  }
};
