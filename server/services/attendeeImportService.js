import crypto from 'crypto';
import * as XLSX from 'xlsx';
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
 * Parses binary or base64 Excel (.xlsx, .xls) content into array of object rows.
 * Reads specified sheet (defaults to first sheet).
 */
export function parseExcel(input, sheetNameOrIndex = 0) {
  if (!input) return [];
  const buffer = typeof input === 'string' && !input.startsWith('PK')
    ? Buffer.from(input, 'base64')
    : input;
  const workbook = XLSX.read(buffer, { type: typeof buffer === 'string' ? 'string' : 'buffer' });
  const sheetName = typeof sheetNameOrIndex === 'string'
    ? sheetNameOrIndex
    : workbook.SheetNames[sheetNameOrIndex || 0];
  if (!sheetName || !workbook.Sheets[sheetName]) return [];
  const worksheet = workbook.Sheets[sheetName];
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  return parseCSV(csvContent);
}

/**
 * Definitions for the accepted event attendee columns.
 * Matches official DevFest Ranchi recommendations (Email, Phone, Track, College, Role + Ticket Code & Name).
 */
export const TARGET_COLUMNS = [
  {
    key: 'uniqueCode',
    label: 'Ticket / Unique Code',
    required: true,
    aliases: ['unique code', 'ticket code', 'ticket id', 'registration code', 'uniquecode', 'ticket', 'ticket_code', 'code'],
    example: 'DFR26-A101',
    description: 'Unique login and verification code',
  },
  {
    key: 'name',
    label: 'Full Name',
    required: true,
    aliases: ['name', 'full name', 'attendee name', 'fullname', 'full_name', 'attendee_name', 'student name', 'candidate name'],
    example: 'Aman Dangi',
    description: 'Generates privacy-preserving display name (e.g. Aman D.)',
  },
  {
    key: 'email',
    label: 'Email',
    required: false,
    aliases: ['email', 'email address', 'email id', 'email_address', 'email_id', 'mail'],
    example: 'aman@gdgranchi.in',
    description: 'Small letters & trim ho jata hai',
  },
  {
    key: 'phone',
    label: 'Phone',
    required: false,
    aliases: ['phone number', 'phone', 'mobile number', 'contact', 'phone_number', 'mobile_number', 'contact number', 'mobile', 'phone no', 'mobile no'],
    example: '+91 98765-43210',
    description: '+91, 0, spaces hatkar 10-digit number ban jata hai',
  },
  {
    key: 'track',
    label: 'Track',
    required: false,
    aliases: ['track / registration status', 'track', 'category', 'ticket type', 'track / registration', 'registration status', 'ticket_type', 'track_name', 'track name'],
    example: 'Flagship Dev Track',
    description: 'Games ko specific track ke liye target karne me kaam aata hai',
  },
  {
    key: 'organization',
    label: 'College / Org',
    required: false,
    aliases: ['organization / college & location', 'organization', 'college', 'company', 'organization / college', 'college & location', 'institute', 'institution', 'college name', 'company name'],
    example: 'BIT Mesra',
    description: 'Attendee info me save hota hai',
  },
  {
    key: 'designation',
    label: 'Role / Domain',
    required: false,
    aliases: ['designation / domain', 'designation', 'role', 'domain', 'designation / role', 'job title', 'role / domain'],
    example: 'Software Engineer',
    description: 'Attendee profile me save hota hai',
  },
];

/**
 * Maps raw CSV headers against the 7 target columns.
 * Identifies mapped headers and collects all unneeded/extra columns into ignoredColumns.
 */
export function resolveTargetColumns(rawHeaders) {
  const headers = (rawHeaders || []).map((h) => String(h).trim());
  const mapping = {};
  const matchedHeaders = new Set();

  for (const target of TARGET_COLUMNS) {
    let matchedHeader = null;

    // 1. Direct lowercase match
    for (const h of headers) {
      const lower = h.toLowerCase();
      if (target.aliases.includes(lower)) {
        matchedHeader = h;
        break;
      }
    }

    // 2. Alphanumeric normalized fallback match
    if (!matchedHeader) {
      for (const h of headers) {
        const normH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const alias of target.aliases) {
          const normA = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normH === normA) {
            matchedHeader = h;
            break;
          }
        }
        if (matchedHeader) break;
      }
    }

    mapping[target.key] = {
      key: target.key,
      label: target.label,
      required: target.required,
      example: target.example,
      description: target.description,
      matchedHeader,
      found: Boolean(matchedHeader),
    };

    if (matchedHeader) {
      matchedHeaders.add(matchedHeader);
    }
  }

  const ignoredColumns = headers.filter((h) => !matchedHeaders.has(h));
  const missingRequired = TARGET_COLUMNS.filter((t) => t.required && !mapping[t.key].found).map((t) => t.label);

  return {
    mapping,
    ignoredColumns,
    missingRequired,
  };
}

/**
 * Generates an instant dry-run preview of an attendee CSV import.
 * Detects target columns, runs validations, and returns sample preview rows without DB writes.
 */
export function previewAttendeeImport({ csvText, rawRows, previewLimit = 10 }) {
  const rows = rawRows || parseCSV(csvText);
  if (!rows || rows.length === 0) {
    return {
      totalRows: 0,
      validCount: 0,
      quarantinedCount: 0,
      columnMapping: {},
      ignoredColumns: [],
      missingRequired: ['Ticket / Unique Code', 'Full Name'],
      previewRows: [],
      quarantineSamples: [],
      trackCounts: {},
    };
  }

  const headers = Object.keys(rows[0] || {});
  const { mapping, ignoredColumns, missingRequired } = resolveTargetColumns(headers);

  const seenCodes = new Set();
  const previewRows = [];
  const quarantineSamples = [];
  const trackCounts = {
    'flagship-dev': 0,
    'beginner-track': 0,
    'conference-only': 0,
    all: 0,
  };
  let validCount = 0;
  let quarantinedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;

    const rawUniqueCode = mapping.uniqueCode.matchedHeader ? r[mapping.uniqueCode.matchedHeader] : (r['unique code'] || r['ticket code'] || r['ticket id'] || r['registration code'] || r['uniquecode'] || r['code']);
    const rawName = mapping.name.matchedHeader ? r[mapping.name.matchedHeader] : (r['name'] || r['full name'] || r['attendee name'] || r['fullname']);
    const rawEmail = mapping.email.matchedHeader ? r[mapping.email.matchedHeader] : (r['email'] || r['email address'] || r['email id']);
    const rawPhone = mapping.phone.matchedHeader ? r[mapping.phone.matchedHeader] : (r['phone number'] || r['phone'] || r['mobile number'] || r['contact']);
    const rawTrack = mapping.track.matchedHeader ? r[mapping.track.matchedHeader] : (r['track / registration status'] || r['track'] || r['category'] || r['ticket type']);
    const rawOrg = mapping.organization.matchedHeader ? r[mapping.organization.matchedHeader] : (r['organization / college & location'] || r['organization'] || r['college'] || r['company']);
    const rawDesig = mapping.designation.matchedHeader ? r[mapping.designation.matchedHeader] : (r['designation / domain'] || r['designation'] || r['role']);

    let isValid = true;
    let quarantineReason = null;

    if (!rawUniqueCode || !String(rawUniqueCode).trim()) {
      isValid = false;
      quarantineReason = 'Missing unique ticket code';
    } else {
      const uniqueCode = String(rawUniqueCode).trim().toUpperCase();
      if (seenCodes.has(uniqueCode)) {
        isValid = false;
        quarantineReason = `Duplicate ticket code: ${uniqueCode}`;
      } else {
        seenCodes.add(uniqueCode);
      }
    }

    if (isValid && (!rawName || !String(rawName).trim())) {
      isValid = false;
      quarantineReason = 'Missing attendee name';
    }

    const uniqueCodeFormatted = rawUniqueCode ? String(rawUniqueCode).trim().toUpperCase() : '';
    const emailNorm = normalizeEmail(rawEmail);
    const phoneNorm = normalizePhone(rawPhone);
    const trackId = normalizeTrackId(rawTrack);
    const displayName = formatDisplayName(rawName);

    if (isValid) {
      validCount++;
      trackCounts[trackId] = (trackCounts[trackId] || 0) + 1;
    } else {
      quarantinedCount++;
      if (quarantineSamples.length < 5) {
        quarantineSamples.push({
          row: rowNum,
          uniqueCode: uniqueCodeFormatted || 'N/A',
          reason: quarantineReason,
        });
      }
    }

    if (previewRows.length < previewLimit) {
      previewRows.push({
        row: rowNum,
        uniqueCode: uniqueCodeFormatted,
        name: rawName ? String(rawName).trim() : '',
        displayName,
        email: emailNorm || rawEmail || '',
        phone: phoneNorm || rawPhone || '',
        rawTrack: rawTrack || '',
        trackId,
        organization: rawOrg ? String(rawOrg).trim() : '',
        designation: rawDesig ? String(rawDesig).trim() : '',
        isValid,
        quarantineReason,
      });
    }
  }

  return {
    totalRows: rows.length,
    validCount,
    quarantinedCount,
    columnMapping: mapping,
    ignoredColumns,
    missingRequired,
    previewRows,
    quarantineSamples,
    trackCounts,
  };
}

/**
 * Ingestion Worker: parses, validates, normalizes, and imports attendee records.
 * Strictly targets recommended columns while filtering out arbitrary survey metadata.
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

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const { mapping } = resolveTargetColumns(headers);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // header is row 1

    // Extract ONLY the targeted columns
    const rawUniqueCode = mapping.uniqueCode.matchedHeader ? r[mapping.uniqueCode.matchedHeader] : (r['unique code'] || r['ticket code'] || r['ticket id'] || r['registration code'] || r['uniquecode'] || r['code']);
    const rawName = mapping.name.matchedHeader ? r[mapping.name.matchedHeader] : (r['name'] || r['full name'] || r['attendee name'] || r['fullname']);
    const rawEmail = mapping.email.matchedHeader ? r[mapping.email.matchedHeader] : (r['email'] || r['email address'] || r['email id']);
    const rawPhone = mapping.phone.matchedHeader ? r[mapping.phone.matchedHeader] : (r['phone number'] || r['phone'] || r['mobile number'] || r['contact']);
    const rawTrack = mapping.track.matchedHeader ? r[mapping.track.matchedHeader] : (r['track / registration status'] || r['track'] || r['category'] || r['ticket type']);
    const rawOrg = mapping.organization.matchedHeader ? r[mapping.organization.matchedHeader] : (r['organization / college & location'] || r['organization'] || r['college'] || r['company']);
    const rawDesig = mapping.designation.matchedHeader ? r[mapping.designation.matchedHeader] : (r['designation / domain'] || r['designation'] || r['role']);

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
