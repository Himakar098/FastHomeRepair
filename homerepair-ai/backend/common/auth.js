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
const AUD = sanitize(process.env.TOKEN_AUDIENCE);

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
  const audienceSet = new Set();
  if (AUD) {
    if (AUD.includes(',')) {
      AUD.split(',').map(sanitize).filter(Boolean).forEach(a => audienceSet.add(a));
    } else {
      audienceSet.add(AUD);
    }
    Array.from(audienceSet).forEach(a => {
      if (typeof a === 'string' && !a.toLowerCase().startsWith('api://')) {
        audienceSet.add(`api://${a}`);
      }
    });
  }

  const verifyOptions = {
    issuer: ISSUER || undefined,
    algorithms: ['RS256']
  };
  if (audienceSet.size > 0) {
    verifyOptions.audience = Array.from(audienceSet);
  }

  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, verifyOptions, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

module.exports = { validateJwt };
