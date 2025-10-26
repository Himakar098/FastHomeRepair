// homerepair-ai/frontend/src/auth/msalConfig.ts
//
// Configuration for the MSAL PublicClientApplication.  Note that the
// redirect URIs default to http://localhost:3000 when running
// locally unless overridden via NEXT_PUBLIC_REDIRECT_URI.  This
// avoids being bounced off to the production Static Web Apps URL
// during local development.

import { Configuration, LogLevel } from '@azure/msal-browser';

const tenant = process.env.NEXT_PUBLIC_B2C_TENANT!;              // e.g., homerepairb2c
const policy = process.env.NEXT_PUBLIC_B2C_POLICY!;              // e.g., b2c_1_signupsignin
const clientId = process.env.NEXT_PUBLIC_B2C_CLIENT_ID!;         // eb662b8c-...
const knownAuthority = `${tenant}.ciamlogin.com`;
const authority = `https://${tenant}.ciamlogin.com/${tenant}.onmicrosoft.com/${policy}`;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    knownAuthorities: [knownAuthority],
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3000',
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3000'
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