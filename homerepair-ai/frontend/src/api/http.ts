// homerepair-ai/frontend/src/api/http.ts
//
// A simple HTTP client helper that attaches a bearer token to POST
// requests.  It uses the useAccessToken hook to acquire a token on
// demand.  When running locally the API base defaults to
// http://localhost:7071 but can be overridden via the
// NEXT_PUBLIC_API_BASE environment variable.

'use client';
import axios from 'axios';
import { useAccessToken } from '../hooks/useAccessToken';

export function useHttp() {
  const { getToken } = useAccessToken();
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:7071';

  const client = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' }
  });

  async function post<T = any>(url: string, data?: any) {
    const token = await getToken({ forceLogin: true });
    if (!token) {
      throw new Error('Authentication required');
    }
    return client.post<T>(url, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  return { post };
}
