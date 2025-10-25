// homerepair-ai/frontend/src/api/http.ts
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

  // attach token per-request
  async function post<T=any>(url: string, data?: any) {
    const token = await getToken();
    return client.post<T>(url, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  return { post };
}
