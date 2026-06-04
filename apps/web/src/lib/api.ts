// Fetch wrapper that injects the JWT Authorization header. A module-level token
// getter is set by the AuthProvider (avoids reading localStorage on every call
// and avoids a React import cycle).

let getToken: () => string | null = () => null;

export function setTokenGetter(fn: () => string | null): void {
  getToken = fn;
}

// Strip any trailing slash(es) so `${BASE}/api/...` never produces a double
// slash (Express 404s on `//api/...`).
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export const TOKEN_KEY = "cda_token";

function currentToken(): string | null {
  const fromGetter = getToken();
  if (fromGetter) return fromGetter;
  if (typeof window !== "undefined") return localStorage.getItem(TOKEN_KEY);
  return null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = currentToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  base: BASE,
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data ?? {}) }),
  /** Authenticated file download (e.g. CSV). Returns a Blob. */
  async download(path: string): Promise<Blob> {
    const token = currentToken();
    const res = await fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    return res.blob();
  },
};
