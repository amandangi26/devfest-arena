import { validateSession } from '../services/authService.js';
import { config } from '../config.js';

/**
 * Extracts raw session token from cookie or Authorization header.
 */
export function extractToken(req) {
  // 1. Check HttpOnly cookie
  if (req.cookies && req.cookies[config.sessionCookieName]) {
    return req.cookies[config.sessionCookieName];
  }

  // 2. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Middleware: Enforces that the request has a valid, unexpired attendee session.
 */
export async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please verify your ticket.',
      },
    });
  }

  try {
    const authContext = await validateSession(token);
    if (!authContext) {
      // Clear invalid cookie
      res.clearCookie(config.sessionCookieName);
      return res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please verify your ticket again.',
        },
      });
    }

    req.user = authContext.attendee;
    req.session = authContext.session;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Attaches session if present, but does not block unauthenticated requests.
 */
export async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const authContext = await validateSession(token);
    if (authContext) {
      req.user = authContext.attendee;
      req.session = authContext.session;
    }
    next();
  } catch {
    next();
  }
}
