import crypto from 'crypto';
import { db } from '../db/index.js';
import { config } from '../config.js';

/**
 * Normalizes an attendee name to a privacy-preserving display name.
 * e.g., "Aman Dangi" -> "Aman D.", "Rohan" -> "Rohan"
 */
export function formatDisplayName(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'Attendee';
  const parts = rawName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }
  const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

/**
 * Normalizes email strings.
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const clean = email.trim().toLowerCase();
  return clean.includes('@') ? clean : null;
}

/**
 * Standardizes 10-digit Indian phone numbers.
 * Strips +91, 0 prefix, hyphens, and spaces.
 */
export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Maps raw track strings to canonical track IDs.
 */
export function normalizeTrackId(rawTrack) {
  if (!rawTrack) return 'all';
  const lower = String(rawTrack).toLowerCase();
  if (lower.includes('flagship') || lower.includes('track 2') || lower.includes('dev')) {
    return 'flagship-dev';
  }
  if (lower.includes('beginner') || lower.includes('track 1') || lower.includes('abc')) {
    return 'beginner-track';
  }
  if (lower.includes('conference') || lower.includes('keynote')) {
    return 'conference-only';
  }
  return 'all';
}

/**
 * Parses raw CSV text into array of object rows.
 * Supports comma and tab delimiters, and handles quotes.
 */
export function parseCSV(csvContent) {
  if (!csvContent || typeof csvContent !== 'string') return [];
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const delimiter = headerLine.includes('\t') ? '\t' : ',';
  
  const parseRow = (text) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseRow(headerLine).map((h) => h.toLowerCase().trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Ingestion Worker: parses, validates, normalizes, and imports attendee records.
 */
export async function importAttendees({ csvText, rawRows, sourceImportId = `import_${Date.now()}` }) {
  const rows = rawRows || parseCSV(csvText);
  const now = Date.now();

  const quarantined = [];
  const validAttendees = [];
  const trackAssignments = [];
  const seenCodes = new Set();
  const trackCounts = {
    'flagship-dev': 0,
    'beginner-track': 0,
    'conference-only': 0,
    all: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // header is row 1

    // Disambiguate columns across Commudle / Google Forms variations
    const rawUniqueCode = r['unique code'] || r['ticket code'] || r['ticket id'] || r['registration code'] || r['uniquecode'] || r['code'];
    const rawName = r['name'] || r['full name'] || r['attendee name'] || r['fullname'];
    const rawEmail = r['email'] || r['email address'] || r['email id'];
    const rawPhone = r['phone number'] || r['phone'] || r['mobile number'] || r['contact'];
    const rawTrack = r['track / registration status'] || r['track'] || r['category'] || r['ticket type'];
    const rawOrg = r['organization / college & location'] || r['organization'] || r['college'] || r['company'];
    const rawDesig = r['designation / domain'] || r['designation'] || r['role'];

    // Mandatory validation
    if (!rawUniqueCode || !String(rawUniqueCode).trim()) {
      quarantined.push({
        row: rowNum,
        uniqueCode: null,
        reason: 'Missing unique ticket code',
        raw: r,
      });
      continue;
    }

    const uniqueCode = String(rawUniqueCode).trim().toUpperCase();

    if (seenCodes.has(uniqueCode)) {
      quarantined.push({
        row: rowNum,
        uniqueCode,
        reason: `Duplicate ticket code within import: ${uniqueCode}`,
        raw: r,
      });
      continue;
    }

    if (!rawName || !String(rawName).trim()) {
      quarantined.push({
        row: rowNum,
        uniqueCode,
        reason: 'Missing attendee name',
        raw: r,
      });
      continue;
    }

    seenCodes.add(uniqueCode);

    const emailNorm = normalizeEmail(rawEmail);
    const phoneNorm = normalizePhone(rawPhone);
    const trackId = normalizeTrackId(rawTrack);
    const displayName = formatDisplayName(rawName);

    const attendeeId = `att_${crypto.randomBytes(8).toString('hex')}`;

    const attendeeRecord = {
      id: attendeeId,
      event_id: config.eventId,
      unique_code: uniqueCode,
      name: String(rawName).trim(),
      display_name: displayName,
      email_normalized: emailNorm,
      phone_normalized: phoneNorm,
      organization: rawOrg ? String(rawOrg).trim() : '',
      designation: rawDesig ? String(rawDesig).trim() : '',
      registration_status: 'confirmed',
      attendance_status: 'unknown',
      ticket_verified_at: null,
      checked_in_at: null,
      created_at: now,
      updated_at: now,
    };

    validAttendees.push(attendeeRecord);
    trackCounts[trackId] = (trackCounts[trackId] || 0) + 1;

    trackAssignments.push({
      id: `trk_${crypto.randomBytes(8).toString('hex')}`,
      attendee_id: attendeeId,
      unique_code: uniqueCode,
      track_id: trackId,
      source_import_id: sourceImportId,
      assigned_at: now,
    });
  }

  // Batch commit valid records into database
  let importedCount = 0;
  for (const attendee of validAttendees) {
    try {
      const saved = await db.upsertAttendee(attendee);
      importedCount++;

      // Assign track
      const matchingTrack = trackAssignments.find((t) => t.unique_code === attendee.unique_code);
      if (matchingTrack) {
        matchingTrack.attendee_id = saved.id;
        await db.addAttendeeTrack(matchingTrack);
      }
    } catch (err) {
      quarantined.push({
        row: 'DB',
        uniqueCode: attendee.unique_code,
        reason: `Database persistence failed: ${err.message}`,
      });
    }
  }

  // Audit log
  await db.logAuditEvent({
    id: `audit_${crypto.randomBytes(8).toString('hex')}`,
    admin_id: 'system_import',
    action: 'ATTENDEE_IMPORT',
    target_id: sourceImportId,
    details: {
      totalRows: rows.length,
      importedCount,
      quarantinedCount: quarantined.length,
      trackCounts,
    },
  });

  return {
    sourceImportId,
    totalRows: rows.length,
    importedCount,
    quarantinedCount: quarantined.length,
    quarantined,
    trackCounts,
  };
}
