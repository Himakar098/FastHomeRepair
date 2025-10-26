// homerepair-ai/frontend/src/auth/msalConfig.ts

import { Configuration, LogLevel } from "@azure/msal-browser";

// const tenant   = process.env.NEXT_PUBLIC_B2C_TENANT!;    // e.g. homerepairb2c
// const policy   = process.env.NEXT_PUBLIC_B2C_POLICY!;    // e.g. B2C_1_signupsignin
// const clientId = process.env.NEXT_PUBLIC_B2C_CLIENT_ID!; // SPA client ID

// Allow overriding the login domain via an env var.  Defaults to the classic b2clogin.com.
// const domainSuffix = process.env.NEXT_PUBLIC_B2C_DOMAIN || "b2clogin.com";

// Build the authority based on the chosen domain suffix.
// const knownAuthority = `${tenant}.${domainSuffix}`;
// const authority      = `https://${knownAuthority}/${tenant}.onmicrosoft.com/${policy}`;
const tenant   = process.env.NEXT_PUBLIC_CIAM_TENANT!;
const clientId = process.env.NEXT_PUBLIC_CIAM_CLIENT_ID!;

const authority = `https://${tenant}.ciamlogin.com/${tenant}.onmicrosoft.com`;

// Use the current origin as the fallback redirect URI in production,
// and default to localhost during development if none is provided.
const fallbackRedirect =
  process.env.NEXT_PUBLIC_REDIRECT_URI ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    knownAuthorities: [`${tenant}.ciamlogin.com`],
    redirectUri: fallbackRedirect,
    postLogoutRedirectUri: fallbackRedirect
  },
  cache: {
    cacheLocation: "sessionStorage",
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
    `api://${process.env.NEXT_PUBLIC_API_CLIENT_ID}/access_as_user`
    // or: `api://${process.env.NEXT_PUBLIC_API_CLIENT_ID}/.default`
  ]
};

