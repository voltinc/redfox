export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, headers, signal, raw } = {}) {
  const init = {
    method,
    credentials: 'same-origin',
    signal,
    headers: { ...(headers || {}) },
  };
  if (body !== undefined) {
    if (raw) {
      init.body = body;
    } else {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }
  const response = await fetch(path, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new ApiError(json?.error || `Request failed with ${response.status}`, response.status, json?.details);
  }
  return json ?? {};
}

export const post = (path, body) => api(path, { method: 'POST', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path, body) => api(path, { method: 'DELETE', body });
