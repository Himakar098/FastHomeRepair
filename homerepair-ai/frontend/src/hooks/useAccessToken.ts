// homerepair-ai/frontend/src/hooks/useAccessToken.ts
//
// This hook wraps the MSAL library to provide simple helpers for
// acquiring an access token, logging in/out and checking sign-in
// status.  It uses the configuration defined in src/auth/msalConfig.ts.

'use client';
import { useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth/msalConfig';

type GetTokenOptions = {
  forceLogin?: boolean;
};

export function useAccessToken() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const signedIn = !!account;

  const login = useCallback(async () => {
    const res = await instance.loginPopup(loginRequest);
    return res.accessToken;
  }, [instance]);

  const getToken = useCallback(
    async (options: GetTokenOptions = {}) => {
      if (!account) {
        if (options.forceLogin) {
          return login();
        }
        return null;
      }
      try {
        const res = await instance.acquireTokenSilent({
          ...loginRequest,
          account
        });
        return res.accessToken;
      } catch {
        const res = await instance.acquireTokenPopup({
          ...loginRequest,
          account
        });
        return res.accessToken;
      }
    },
    [account, instance, login]
  );

  const logout = useCallback(() => {
    instance.logoutPopup();
  }, [instance]);

  return { getToken, login, logout, signedIn };
}
