// homerepair-ai/frontend/src/hooks/useAccessToken.ts
'use client';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth/msalConfig';

export function useAccessToken() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  async function getToken() {
    if (!account) {
      const login = await instance.loginPopup(loginRequest);
      return login.accessToken;
    }
    try {
      const res = await instance.acquireTokenSilent({
        ...loginRequest,
        account
      });
      return res.accessToken;
    } catch {
      const res = await instance.acquireTokenPopup(loginRequest);
      return res.accessToken;
    }
  }

  function logout() {
    instance.logoutPopup();
  }

  function isSignedIn() {
    return !!account;
  }

  return { getToken, logout, isSignedIn };
}
