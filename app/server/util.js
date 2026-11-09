export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const bad = (msg, details) => new HttpError(400, msg, details);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body?.[f] === null || String(body[f]).trim() === '');
  if (missing.length) throw bad(`Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`, { missing });
}

export function paginate(req, defaultLimit = 25) {
  const limit = Math.min(Math.max(parseInt(req.query.limit ?? defaultLimit, 10) || defaultLimit, 1), 200);
  const page = Math.max(parseInt(req.query.page ?? 1, 10) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
}

export function paged(items, total, page, limit) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export function safeJson(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

export function bytesToMb(bytes, digits = 1) {
  return Math.round((Number(bytes || 0) / 1048576) * 10 ** digits) / 10 ** digits;
}

export function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
