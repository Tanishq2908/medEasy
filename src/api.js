// Single API client. In development Vite proxies /api to the Flask server;
// on Vercel, vercel.json rewrites /api to Render; when Flask serves the app, relative
// URLs also work. Set VITE_BACKEND_URL only to call an API on another origin directly.
// (Deliberately not VITE_API_URL: old deployments set that to a server that no longer exists.)
const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function token() {
  try { return localStorage.getItem('medeasy-token'); } catch { return null; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(`Cannot reach the MedEasy server (${BASE || window.location.origin}${path}). If the backend is on Render's free plan it may be waking up — try again in a minute.`, 0);
  }
  const data = await res.json().catch(() => null);
  if (data === null) {
    // Non-JSON answer: usually the proxy reached the wrong host, or Render is starting/failed.
    throw new ApiError(`The server at ${BASE || window.location.origin}/api returned an unexpected response (HTTP ${res.status}). Check that the backend URL in vercel.json is your Render URL.`, res.status);
  }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}
