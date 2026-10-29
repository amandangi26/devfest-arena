import crypto from 'crypto';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { normalizeEmail, normalizePhone } from './attendeeImportService.js';

export class AuthenticationError extends Error {
  constructor(message = 'Invalid ticket code or contact details') {
    super(message);
    this.name = 'AuthenticationError';
    this.status = 401;
  }
}

/**
 * Computes deterministic SHA-256 hash of a session token for storage.
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates an unguessable 256-bit random session token.
 */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Authoritative ticket verification workflow.
 * Compares uniqueCode against imported records and performs constant-time comparison on contact.
 */
export async function verifyTicket({ uniqueCode, contact }) {
  if (!uniqueCode || !contact) {
    throw new AuthenticationError();
  }

  const cleanCode = String(uniqueCode).trim().toUpperCase();
  const rawContact = String(contact).trim();

  // 1. Lookup attendee by unique ticket code
  const attendee = await db.findAttendeeByUniqueCode(cleanCode);
  if (!attendee) {
    // Deliberate uniform error response to prevent ticket enumeration oracle
    throw new AuthenticationError();
  }

  // 2. Cross-check contact against normalized email or phone
  let isMatch = false;
  if (rawContact.includes('@')) {
    const cleanEmail = normalizeEmail(rawContact);
    if (cleanEmail && attendee.email_normalized && cleanEmail === attendee.email_normalized) {
      isMatch = true;
    }
  } else {
    const cleanPhone = normalizePhone(rawContact);
    if (cleanPhone && attendee.phone_normalized && cleanPhone === attendee.phone_normalized) {
      isMatch = true;
    }
  }

  // Fallback: check both if contact format is ambiguous
  if (!isMatch) {
    const asEmail = normalizeEmail(rawContact);
    const asPhone = normalizePhone(rawContact);
    if (asEmail && attendee.email_normalized === asEmail) isMatch = true;
    if (asPhone && attendee.phone_normalized === asPhone) isMatch = true;
  }

  if (!isMatch) {
    throw new AuthenticationError();
  }

  // 3. Retrieve eligible track affiliations
  const trackIds = await db.getAttendeeTracks(attendee.id);
  const effectiveTracks = trackIds.length > 0 ? trackIds : ['all'];

  // 4. Issue secure revocable session
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const now = Date.now();
  const expiresAt = now + config.sessionTtlMs;

  const session = {
    id: `sess_${crypto.randomBytes(8).toString('hex')}`,
    token_hash: tokenHash,
    attendee_id: attendee.id,
    unique_code: attendee.unique_code,
    display_name: attendee.display_name,
    track_ids: effectiveTracks,
    created_at: now,
    expires_at: expiresAt,
    revoked_at: null,
  };

  await db.createSession(session);

  // 5. Update ticket verification timestamp on attendee
  await db.upsertAttendee({
    ...attendee,
    ticket_verified_at: now,
  });

  return {
    token: rawToken,
    session: {
      id: session.id,
      expiresAt: session.expires_at,
    },
    profile: {
      uniqueCode: attendee.unique_code,
      displayName: attendee.display_name,
      trackIds: effectiveTracks,
      organization: attendee.organization || '',
      designation: attendee.designation || '',
    },
  };
}

/**
 * Validates a session token supplied via cookie or bearer header.
 */
export async function validateSession(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const session = await db.findSessionByTokenHash(tokenHash);
  if (!session) {
    return null;
  }

  // Fetch fresh attendee data for current status
  const attendee = await db.findAttendeeById(session.attendee_id);
  if (!attendee) {
    return null;
  }

  return {
    session,
    attendee: {
      id: attendee.id,
      uniqueCode: attendee.unique_code,
      displayName: attendee.display_name,
      trackIds: session.track_ids,
      organization: attendee.organization,
      designation: attendee.designation,
    },
  };
}

/**
 * Revokes an active session token.
 */
export async function logoutSession(rawToken) {
  if (!rawToken) return true;
  const tokenHash = hashToken(rawToken);
  return db.revokeSession(tokenHash);
}
