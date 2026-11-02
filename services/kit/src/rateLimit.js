import { ApiError } from './ApiError.js';

export function createRateLimiter({ limit, windowMs }) {
  const hits = new Map();

  return function allow(key) {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}

export function rateLimit({ name, limit, windowMs, key }) {
  const allow = createRateLimiter({ limit, windowMs });

  return (req, _res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const blocked = key(req).some((part) => !allow(`${name}:${part}`));
    if (blocked) throw ApiError.rateLimited();
    next();
  };
}
