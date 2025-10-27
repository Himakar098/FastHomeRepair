// homerepair-ai/frontend/src/auth/msalConfig.ts

import { Configuration, LogLevel } from '@azure/msal-browser';

const ciamTenant = process.env.NEXT_PUBLIC_CIAM_TENANT;
const ciamClientId = process.env.NEXT_PUBLIC_CIAM_CLIENT_ID;
const b2cTenant = process.env.NEXT_PUBLIC_B2C_TENANT;
const b2cClientId = process.env.NEXT_PUBLIC_B2C_CLIENT_ID;
const b2cPolicy = process.env.NEXT_PUBLIC_B2C_POLICY;

const tenant = ciamTenant || b2cTenant;
const clientId = ciamClientId || b2cClientId;

if (!tenant || !clientId) {
  throw new Error('MSAL configuration missing tenant or client id environment variables.');
}

const domainSuffix =
  process.env.NEXT_PUBLIC_B2C_DOMAIN ||
  (ciamTenant ? 'ciamlogin.com' : 'b2clogin.com');

let authority: string;
let knownAuthority: string;

if (ciamTenant && ciamClientId) {
  knownAuthority = `${tenant}.ciamlogin.com`;
  authority = `https://${knownAuthority}/${tenant}.onmicrosoft.com`;
} else {
  if (!b2cPolicy) {
    throw new Error('NEXT_PUBLIC_B2C_POLICY must be set when using Azure AD B2C.');
  }
  knownAuthority = `${tenant}.${domainSuffix}`;
  authority = `https://${knownAuthority}/${tenant}.onmicrosoft.com/${b2cPolicy}`;
}

const fallbackRedirect =
  process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3000';

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    knownAuthorities: [knownAuthority],
    redirectUri: fallbackRedirect,
    postLogoutRedirectUri: fallbackRedirect
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: () => {}
    }
  }
};

const configuredScope =
  process.env.NEXT_PUBLIC_B2C_API_SCOPE ||
  process.env.NEXT_PUBLIC_API_SCOPE ||
  (process.env.NEXT_PUBLIC_API_CLIENT_ID
    ? `api://${process.env.NEXT_PUBLIC_API_CLIENT_ID}/access_as_user`
    : undefined);

export const loginRequest = {
  scopes: ['openid', 'offline_access', ...(configuredScope ? [configuredScope] : [])]
};
