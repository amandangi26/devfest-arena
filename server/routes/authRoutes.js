import { Router } from 'express';
import { z } from 'zod';
import { verifyTicket, logoutSession } from '../services/authService.js';
import { requireAuth, extractToken } from '../middleware/auth.js';
import { requireAdmin, timingSafeCompare } from '../middleware/adminAuth.js';
import { ticketVerificationRateLimiter, adminLoginRateLimiter } from '../middleware/rateLimiter.js';
import { supabase } from '../db/supabaseClient.js';
import { config } from '../config.js';

export const authRouter = Router();

const verifyTicketSchema = z.object({
  uniqueCode: z.string().trim().min(3, 'Ticket code must be at least 3 characters').max(30),
  contact: z.string().trim().min(3, 'Email or phone number is required').max(120),
});

const adminLoginSchema = z.object({
  email: z.string().trim().email('Valid email address is required').max(150),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/verify-ticket
 * Frictionless attendee verification via Commudle Ticket Code + email/phone.
 */
authRouter.post('/verify-ticket', ticketVerificationRateLimiter, async (req, res, next) => {
  try {
    const parseResult = verifyTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Both ticket code and contact (email or phone) are required.',
          details: parseResult.error.format(),
        },
      });
    }

    const { uniqueCode, contact } = parseResult.data;
    const result = await verifyTicket({ uniqueCode: uniqueCode.toUpperCase(), contact });

    // Set Secure HttpOnly cookie
    res.cookie(config.sessionCookieName, result.token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: config.sessionTtlMs,
      path: '/',
    });

    res.json({
      ok: true,
      profile: result.profile,
      token: result.token, // Provided for non-cookie contexts (mobile apps/webviews)
      expiresAt: result.session.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/session
 * Rehydrates existing attendee session.
 */
authRouter.get('/session', requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: req.user,
    session: {
      id: req.session.id,
      expiresAt: req.session.expires_at,
    },
  });
});

/**
 * POST /api/auth/logout
 * Terminates the active session and invalidates the session token in the database.
 */
authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      await logoutSession(token);
    }
    res.clearCookie(config.sessionCookieName, { path: '/' });
    res.json({ ok: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/admin-login (and alias /admin-verify)
 * Strictly rate-limited admin/anchor authentication endpoint.
 * Requires:
 *  - email & password (authenticates against Master Admin in .env or Supabase Auth)
 *  - or Bearer Token (active Supabase JWT)
 */
const handleAdminLoginRequest = async (req, res) => {
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : null;

  // 1. Bearer Token check (for existing Supabase JWT session)
  if (bearerToken && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(bearerToken);
      if (!error && user) {
        return res.json({
          ok: true,
          role: 'admin',
          provider: 'supabase',
          adminId: user.email || user.id,
          email: user.email,
          user: { id: user.id, email: user.email },
          token: bearerToken,
          message: 'Supabase admin authorization successful',
        });
      }
    } catch {
      // ignore
    }
  }

  // 2. Reject missing credentials with MISSING_CREDENTIALS
  const emailInput = req.body?.email?.trim();
  const passwordInput = req.body?.password;
  if (!emailInput || !passwordInput) {
    return res.status(400).json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Email address and password are required for admin sign in.',
      },
    });
  }

  // 3. Email + Password Authentication with strict Zod validation
  const parseResult = adminLoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues?.[0]?.message || 'Valid email and password are required.',
        details: parseResult.error.format(),
      },
    });
  }

  const { email, password } = parseResult.data;

  // A. Check against Master Admin configured in environment
  const isMasterEmail = config.adminEmail && email.toLowerCase() === config.adminEmail.toLowerCase();
  const isMasterPassword = timingSafeCompare(password, config.adminPassword);

  if (isMasterEmail && isMasterPassword) {
    res.cookie('dfr26_admin_key', config.adminApiKey, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: config.sessionTtlMs,
      path: '/',
    });
    return res.json({
      ok: true,
      role: 'admin',
      provider: 'master_admin',
      adminId: config.adminEmail,
      email: config.adminEmail,
      token: config.adminApiKey,
      message: 'Admin authorization successful',
    });
  }

  // B. Check against Supabase Auth if configured
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data?.user) {
        const token = data.session?.access_token || config.adminApiKey;
        res.cookie('dfr26_admin_key', token, {
          httpOnly: true,
          secure: config.isProduction,
          sameSite: 'lax',
          maxAge: config.sessionTtlMs,
          path: '/',
        });
        return res.json({
          ok: true,
          role: 'admin',
          provider: 'supabase',
          adminId: data.user.email || data.user.id,
          email: data.user.email,
          user: { id: data.user.id, email: data.user.email },
          token,
          message: 'Supabase admin authorization successful',
        });
      }
    } catch (err) {
      console.warn('[AdminAuth] Supabase auth attempt failed:', err.message);
    }
  }

  return res.status(401).json({
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid administrator email or password.',
    },
  });
};

authRouter.post('/admin-login', adminLoginRateLimiter, handleAdminLoginRequest);
authRouter.post('/admin-verify', adminLoginRateLimiter, handleAdminLoginRequest);

/**
 * GET /api/auth/admin-session
 * Checks if the current admin session is valid.
 */
authRouter.get('/admin-session', requireAdmin, (req, res) => {
  res.json({
    ok: true,
    isAdmin: true,
    adminId: req.adminId || 'master_admin',
    email: req.supabaseUser?.email || config.adminEmail,
  });
});

/**
 * POST /api/auth/admin-logout
 * Clears the admin session cookie.
 */
authRouter.post('/admin-logout', (req, res) => {
  res.clearCookie('dfr26_admin_key', { path: '/' });
  res.json({ ok: true, message: 'Admin logged out successfully' });
});
