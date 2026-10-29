/**
 * In-memory sliding window rate limiter for brute-force defense on sensitive routes.
 */
class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map(); // ip -> Array<timestamp>
  }

  isLimited(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    // Filter timestamps within current window
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxRequests) {
      return true;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return false;
  }
}

const authLimiter = new RateLimiter(60000, 15); // 15 attempts per minute per IP
const adminAuthLimiter = new RateLimiter(15 * 60 * 1000, 10); // 10 attempts per 15 mins per IP

export function ticketVerificationRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (authLimiter.isLimited(ip)) {
    return res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many verification attempts. Please wait a minute before trying again.',
      },
    });
  }
  next();
}

export function adminLoginRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (adminAuthLimiter.isLimited(ip)) {
    return res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many admin verification attempts. Please wait 15 minutes before trying again.',
      },
    });
  }
  next();
}

export function resetRateLimiters() {
  authLimiter.hits.clear();
  adminAuthLimiter.hits.clear();
}
