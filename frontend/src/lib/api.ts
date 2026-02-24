const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

// ngrok free tier shows a browser interstitial that blocks fetch() calls.
// Adding this header bypasses it. Harmless on non-ngrok URLs.
const NGROK_HEADER: HeadersInit = { "ngrok-skip-browser-warning": "true" };

export function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { ...NGROK_HEADER, ...(init?.headers ?? {}) },
  });
}

export { BACKEND_URL };
