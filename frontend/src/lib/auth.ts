const TOKEN_KEY = 'atendeae_token';
const ESTABLISHMENT_KEY = 'atendeae_establishment';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ESTABLISHMENT_KEY);
}

export interface EstablishmentInfo {
  id: string;
  email: string;
  name: string;
}

export function getEstablishment(): EstablishmentInfo | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ESTABLISHMENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EstablishmentInfo;
  } catch {
    return null;
  }
}

export function setEstablishment(establishment: EstablishmentInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ESTABLISHMENT_KEY, JSON.stringify(establishment));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
