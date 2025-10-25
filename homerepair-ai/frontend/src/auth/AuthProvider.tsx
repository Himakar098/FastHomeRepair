// homerepair-ai/frontend/src/auth/AuthProvider.tsx
'use client';
import React from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './msalConfig';

const pca = new PublicClientApplication(msalConfig);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <MsalProvider instance={pca}>{children}</MsalProvider>;
}
