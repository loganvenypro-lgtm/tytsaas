// In-memory sliding-window limits, per key (a user id, an email). The API runs
// as one process (ecosystem.config.cjs), so memory is shared by every request.

/**
 * `hit(key)` records a hit and returns the seconds to wait when the key went
 * over `max` hits in `windowMs`, else 0 (the refused hit is not counted).
 */
export function createLimiter({ windowMs, max }) {
  const hits = new Map();

  // Drop stale keys now and then so the map doesn't grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [key, times] of hits) if (now - times[times.length - 1] >= windowMs) hits.delete(key);
  }, windowMs).unref();

  return {
    hit(key) {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return Math.ceil((recent[0] + windowMs - now) / 1000);
      }
      recent.push(now);
      hits.set(key, recent);
      return 0;
    },
  };
}

/** Express guard after requireUser: 429 once the signed-in user goes over the limit. */
export function limitPerUser({ windowMs, max, message = "Trop de requêtes, réessaie dans quelques minutes." }) {
  const limiter = createLimiter({ windowMs, max });
  return (req, res, next) => {
    const wait = limiter.hit(req.user.id);
    if (!wait) return next();
    res.set("Retry-After", String(wait));
    res.status(429).json({ error: message, code: "rate_limited" });
  };
}
