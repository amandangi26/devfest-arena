import crypto from 'crypto';

// 32-character unambiguous alphabet (omits 0, O, 1, I to prevent attendee entry errors)
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates an unpredictable 6-character uppercase PIN.
 * Entropy: 32^6 ≈ 1.07 billion unique combinations.
 */
export function generateRoomCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Validates whether a room code matches the expected format.
 */
export function isValidRoomCode(code) {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim().toUpperCase();
  if (clean.length !== 6) return false;
  for (const char of clean) {
    if (!ROOM_CODE_ALPHABET.includes(char)) {
      return false;
    }
  }
  return true;
}
