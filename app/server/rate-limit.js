/* Small in-process rate limiter.

   Self-hosted Redfox runs as a single process, so a fixed-window counter in
   memory is enough to stop credential stuffing and signup floods without
   dragging in a dependency. Counters reset when the process restarts. */

const buckets = new Map();

export function rateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

/* Express helper: returns true when the request should continue. */
export function enforceRateLimit(req, res, { name, limit, windowMs }) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const result = rateLimit({ key: `${name}:${ip}`, limit, windowMs });
  if (result.ok) return true;
  res.set('Retry-After', String(result.retryAfter));
  res.status(429).json({ error: `Too many attempts. Try again in ${result.retryAfter} seconds.` });
  return false;
}

/* Housekeeping so the map cannot grow without bound on a long-lived process. */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref?.();
