import crypto from 'crypto';
import { config } from '../config.js';
import { supabase } from '../db/supabaseClient.js';

/**
 * Constant-time string comparison to prevent timing attacks on secrets.
 */
export function timingSafeCompare(provided, secret) {
  if (!provided || !secret || typeof provided !== 'string' || typeof secret !== 'string') {
    return false;
  }
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(secret);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Middleware: Enforces that the request is made by an authorized event administrator.
 * Supports:
 *  1. x-admin-key HTTP header
 *  2. Authorization: Admin <key>
 *  3. Authorization: Bearer <key | Supabase JWT>
 *  4. Secure HttpOnly cookie: dfr26_admin_key
 */
export async function requireAdmin(req, res, next) {
  let adminKey = req.headers['x-admin-key'];
  let bearerToken = null;

  if (!adminKey && req.headers.authorization) {
    if (req.headers.authorization.startsWith('Admin ')) {
      adminKey = req.headers.authorization.slice(6).trim();
    } else if (req.headers.authorization.startsWith('Bearer ')) {
      bearerToken = req.headers.authorization.slice(7).trim();
      adminKey = bearerToken;
    }
  }

  if (!adminKey && req.cookies?.['dfr26_admin_key']) {
    adminKey = req.cookies['dfr26_admin_key'];
  }

  // 1. Primary Check: Timing-safe Master Event Key validation
  if (adminKey && timingSafeCompare(adminKey, config.adminApiKey)) {
    req.isAdmin = true;
    req.adminId = 'master_admin';
    return next();
  }

  // 2. Dual-mode check: Supabase Auth JWT verification (for individual accounts)
  const candidateToken = bearerToken || adminKey;
  if (candidateToken && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(candidateToken);
      if (!error && user) {
        req.isAdmin = true;
        req.adminId = user.email || user.id;
        req.supabaseUser = user;
        return next();
      }
    } catch {
      // ignore
    }
  }

  return res.status(403).json({
    error: {
      code: 'FORBIDDEN',
      message: 'Administrative privileges required for this operation.',
    },
  });
}
