// homerepair-ai/frontend/src/auth/msalConfig.ts

import { Configuration, LogLevel } from '@azure/msal-browser';

const tenant =
  process.env.NEXT_PUBLIC_CIAM_TENANT || // tenant id for CIAM
  process.env.NEXT_PUBLIC_B2C_TENANT; // fallback for pipeline env
const clientId =
  process.env.NEXT_PUBLIC_CIAM_CLIENT_ID ||
  process.env.NEXT_PUBLIC_B2C_CLIENT_ID;

if (!tenant || !clientId) {
  throw new Error(
    'NEXT_PUBLIC_CIAM_TENANT/NEXT_PUBLIC_CIAM_CLIENT_ID must be provided for CIAM auth.'
  );
}

const explicitAuthority = (process.env.NEXT_PUBLIC_CIAM_AUTHORITY || '').trim();

function buildAuthority(): { authority: string; knownAuthority: string } {
  const candidate = explicitAuthority.length > 0 ? explicitAuthority : (tenant || '').trim();

  if (/^https?:\/\//i.test(candidate)) {
    const url = new URL(candidate.replace(/\/$/, ''));
    return { authority: url.origin + url.pathname.replace(/\/$/, ''), knownAuthority: url.host };
  }

  const guidTenant = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!candidate.includes('/') && !guidTenant.test(candidate)) {
    const legacyAuthority = `https://${candidate}.ciamlogin.com/${candidate}`;
    return { authority: legacyAuthority, knownAuthority: `${candidate}.ciamlogin.com` };
  }

  const tenantPath = candidate.replace(/^ciamlogin\.com\//i, '').replace(/^\/+|\/+$/g, '');
  const authorityUrl = `https://ciamlogin.com/${tenantPath}`;
  return { authority: authorityUrl, knownAuthority: 'ciamlogin.com' };
}

const { authority, knownAuthority } = buildAuthority();

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
    knownAuthorities: [knownAuthority],
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
  scopes: ["openid", "profile", "offline_access", ...(apiScope ? [apiScope] : [])]
};
