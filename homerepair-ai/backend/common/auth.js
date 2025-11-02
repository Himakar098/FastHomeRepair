// homerepair-ai/backend/common/auth.js
// CIAM JWT validation using JWKS
const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

function sanitize(value) {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

const tenantId = sanitize(process.env.CIAM_TENANT);
const explicitAuthority = sanitize(process.env.CIAM_AUTHORITY);
const derivedAuthority =
  explicitAuthority ||
  (tenantId ? `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0` : '');

const rawIssuer = sanitize(process.env.TOKEN_ISSUER) || derivedAuthority;
const rawJwks =
  sanitize(process.env.JWKS_URI) ||
  (derivedAuthority
    ? `${derivedAuthority.replace(/\/v2\.0$/i, '')}/discovery/v2.0/keys`
    : '');

const ISSUER = rawIssuer || null; // exact iss in tokens
const JWKS_URI = rawJwks || null;
const AUD = process.env.TOKEN_AUDIENCE; // your SPA client_id

let client = null;
if (JWKS_URI) {
  client = jwksClient({ jwksUri: JWKS_URI, cache: true, cacheMaxEntries: 10, cacheMaxAge: 3600000 });
}

function getKey(header, callback) {
  if (!client) return callback(new Error('JWKS not configured'));
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

async function validateJwt(token) {
  if (!token) throw new Error('No token');
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, { audience: AUD, issuer: ISSUER, algorithms: ['RS256'] }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

module.exports = { validateJwt };
