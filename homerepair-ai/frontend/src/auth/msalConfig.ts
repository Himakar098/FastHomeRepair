// homerepair-ai/frontend/src/auth/msalConfig.ts

import { Configuration, LogLevel } from '@azure/msal-browser';

const tenantId = (process.env.NEXT_PUBLIC_CIAM_TENANT || '').trim();
const clientId = (process.env.NEXT_PUBLIC_CIAM_CLIENT_ID || '').trim();
const explicitAuthority = (process.env.NEXT_PUBLIC_CIAM_AUTHORITY || '').trim();
const isBrowser = typeof window !== 'undefined';

if (!clientId) {
  const message = 'NEXT_PUBLIC_CIAM_CLIENT_ID must be provided for CIAM auth.';
  if (isBrowser) {
    throw new Error(message);
  } else {
    console.warn(message);
  }
}

if (!explicitAuthority && !tenantId) {
  const message =
    'Provide NEXT_PUBLIC_CIAM_AUTHORITY (preferred) or NEXT_PUBLIC_CIAM_TENANT so the CIAM authority can be resolved.';
  if (isBrowser) {
    throw new Error(message);
  } else {
    console.warn(message);
  }
}

function buildAuthority(): { authority: string; knownAuthority: string } {
  const candidate = explicitAuthority.length > 0 ? explicitAuthority : tenantId;

  if (/^https?:\/\//i.test(candidate)) {
    const url = new URL(candidate.replace(/\/$/, ''));
    return { authority: url.origin + url.pathname.replace(/\/$/, ''), knownAuthority: url.host };
  }

  if (!candidate) {
    return { authority: '', knownAuthority: '' };
  }

  const authority = `https://${candidate}.ciamlogin.com/${candidate}/v2.0`;
  const knownAuthority = `${candidate}.ciamlogin.com`;
  return { authority, knownAuthority };
}

const { authority, knownAuthority } = buildAuthority();

if ((!authority || !knownAuthority) && isBrowser) {
  throw new Error('Failed to resolve CIAM authority.');
}

const redirectUri =
  process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3000';

const apiScope =
  process.env.NEXT_PUBLIC_CIAM_API_SCOPE ||
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
