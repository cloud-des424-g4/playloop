const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Mirrors the API's Error schema: { code, message, details? }.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? 'UNKNOWN_ERROR';
    this.details = body?.details;
  }
}

export async function apiFetch(path, { method = 'GET', body, headers, signal } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    signal,
    // The session lives in the httpOnly playloop_token cookie.
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export const api = {
  get: (path, options) => apiFetch(path, options),
  post: (path, body, options) => apiFetch(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => apiFetch(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => apiFetch(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => apiFetch(path, { ...options, method: 'DELETE' }),
};
