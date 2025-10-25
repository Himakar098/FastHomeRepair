// homerepair-ai/frontend/src/auth/AuthProvider.tsx
//
// Provides an MSAL context for the application.  Wrap your pages in
// this provider to enable authentication via Azure AD B2C.

'use client';
import React from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './msalConfig';

// Create a single MSAL instance for the app lifecycle
const pca = new PublicClientApplication(msalConfig);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <MsalProvider instance={pca}>{children}</MsalProvider>;
}