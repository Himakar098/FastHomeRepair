// homerepair-ai/frontend/src/auth/msalConfig.ts
import { Configuration, LogLevel } from '@azure/msal-browser';

const tenant = process.env.NEXT_PUBLIC_B2C_TENANT!;              // e.g., homerepairb2c
const policy = process.env.NEXT_PUBLIC_B2C_POLICY!;              // e.g., B2C_1_signupsignin
const clientId = process.env.NEXT_PUBLIC_B2C_CLIENT_ID!;         // eb662b8c-...
const knownAuthority = `${tenant}.b2clogin.com`;
const authority = `https://${tenant}.b2clogin.com/${tenant}.onmicrosoft.com/${policy}`;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    knownAuthorities: [knownAuthority],
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || 'https://mango-glacier-0e5b73f00.3.azurestaticapps.net',
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || 'https://mango-glacier-0e5b73f00.3.azurestaticapps.net'
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
  scopes: [
    'openid',
    'offline_access',
    // Your API scope:
    process.env.NEXT_PUBLIC_B2C_API_SCOPE! // e.g., api://219c.../access_as_user
  ]
};
