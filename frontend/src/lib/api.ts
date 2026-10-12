import { getToken } from './auth';

function getApiBase(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  const port = window.location.port || '80';
  if (port === '3100') return '/api-backend';
  return 'http://localhost:4000/api';
}
const API_BASE = getApiBase();

/** Erro quando o backend não está rodando (ECONNREFUSED). */
export class BackendOfflineError extends Error {
  constructor() {
    super('Backend não está rodando. Inicie o backend ou use o dashboard no Docker (http://localhost:3100).');
    this.name = 'BackendOfflineError';
  }
}

/** Erro quando a sessão expirou ou não está autenticado (401). */
export class UnauthorizedError extends Error {
  constructor() {
    super('Sessão expirada. Faça login novamente.');
    this.name = 'UnauthorizedError';
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string>) };
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('ECONNREFUSED') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new BackendOfflineError();
    }
    throw err;
  }
  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401) {
      const { removeToken } = await import('./auth');
      removeToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new UnauthorizedError();
    }
    if (res.status === 403) {
      let body: { code?: string; message?: string } = {};
      try {
        body = JSON.parse(errText);
      } catch {
        body = { message: errText };
      }
      if (body.code === 'SUBSCRIPTION_REQUIRED' && typeof window !== 'undefined') {
        window.location.href = '/assinatura';
        throw new Error(body.message || 'Assinatura necessária');
      }
    }
    throw new Error(errText || `Erro ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  order: number;
  imageUrl?: string;
}

export interface BotConfig {
  evolutionBaseUrl: string;
  evolutionApiKey: string;
  instanceName: string;
  webhookUrl: string;
}
