// homerepair-ai/frontend/src/hooks/useAccessToken.ts
//
// This hook wraps the MSAL library to provide simple helpers for
// acquiring an access token, logging in/out and checking sign-in
// status.  It uses the configuration defined in src/auth/msalConfig.ts.

'use client';
import { useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth/msalConfig';

export function useAccessToken() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const signedIn = !!account;

  // Acquire a token, prompting the user if necessary
  const getToken = useCallback(async () => {
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
  }, [instance, account]);

  const logout = useCallback(() => {
    instance.logoutPopup();
  }, [instance]);

  return { getToken, logout, signedIn };
}