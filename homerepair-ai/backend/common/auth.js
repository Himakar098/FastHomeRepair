// homerepair-ai/backend/common/auth.js
// Minimal JWT validation using JWKS. Use with Azure AD B2C (Microsoft Entra External ID) or another OIDC provider.

const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

const JWKS_URI = process.env.JWKS_URI; // e.g. https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/discovery/v2.0/keys?p=B2C_1_signupsignin
const ISSUER = process.env.TOKEN_ISSUER; // exact iss in tokens
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
