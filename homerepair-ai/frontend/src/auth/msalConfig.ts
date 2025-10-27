// homerepair-ai/frontend/src/auth/msalConfig.ts

import { Configuration, LogLevel } from '@azure/msal-browser';

const tenant =
  process.env.NEXT_PUBLIC_CIAM_TENANT ||
  process.env.NEXT_PUBLIC_B2C_TENANT; // fallback for pipeline env
const clientId =
  process.env.NEXT_PUBLIC_CIAM_CLIENT_ID ||
  process.env.NEXT_PUBLIC_B2C_CLIENT_ID;

if (!tenant || !clientId) {
  throw new Error(
    'NEXT_PUBLIC_CIAM_TENANT/NEXT_PUBLIC_CIAM_CLIENT_ID must be provided for CIAM auth.'
  );
}

const authorityHost = `${tenant}.ciamlogin.com`;
const authority = `https://${authorityHost}/${tenant}.onmicrosoft.com`;

const redirectUri =
  process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3000';

const apiScope =
  process.env.NEXT_PUBLIC_CIAM_API_SCOPE ||
  process.env.NEXT_PUBLIC_B2C_API_SCOPE ||
  (process.env.NEXT_PUBLIC_API_CLIENT_ID
    ? `api://${process.env.NEXT_PUBLIC_API_CLIENT_ID}/access_as_user`
    : undefined);

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    knownAuthorities: [authorityHost],
    redirectUri,
    postLogoutRedirectUri: redirectUri
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

export const loginRequest = {
  scopes: ['openid', 'offline_access', ...(apiScope ? [apiScope] : [])]
};
