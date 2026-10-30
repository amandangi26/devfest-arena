import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatDisplayName,
  normalizeEmail,
  normalizePhone,
  normalizeTrackId,
  parseCSV,
  importAttendees,
  resolveTargetColumns,
  previewAttendeeImport,
  TARGET_COLUMNS,
} from '../../server/services/attendeeImportService.js';
import { db } from '../../server/db/index.js';

describe('Attendee Ingestion & Sanitization', () => {
  beforeEach(() => {
    db.resetMemoryStore();
  });

  describe('formatDisplayName', () => {
    it('creates privacy-preserving display names', () => {
      expect(formatDisplayName('Aman Dangi')).toBe('Aman D.');
      expect(formatDisplayName('Rohan Sharma')).toBe('Rohan S.');
      expect(formatDisplayName('Priya')).toBe('Priya');
      expect(formatDisplayName('Dr. APJ Abdul Kalam')).toBe('Dr. K.');
      expect(formatDisplayName('')).toBe('Attendee');
    });
  });

  describe('normalizeEmail', () => {
    it('lowercases and trims valid emails', () => {
      expect(normalizeEmail('  Aman@GDGRanchi.IN ')).toBe('aman@gdgranchi.in');
      expect(normalizeEmail('invalid-string')).toBe(null);
      expect(normalizeEmail(null)).toBe(null);
    });
  });

  describe('normalizePhone', () => {
    it('strips +91 and extracts 10 digits', () => {
      expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
      expect(normalizePhone('09876543210')).toBe('9876543210');
      expect(normalizePhone('9876543210')).toBe('9876543210');
      expect(normalizePhone('12345')).toBe('12345');
    });
  });

  describe('normalizeTrackId', () => {
    it('maps track labels correctly', () => {
      expect(normalizeTrackId('Flagship Dev Track (Track 2)')).toBe('flagship-dev');
      expect(normalizeTrackId('Beginner Track')).toBe('beginner-track');
      expect(normalizeTrackId('Conference Only')).toBe('conference-only');
      expect(normalizeTrackId('General Admission')).toBe('all');
    });
  });

  describe('parseCSV', () => {
    it('parses comma-separated values with quotes', () => {
      const csv = `Unique Code,Name,Email,Phone Number\nDFR-01,"Aman, Dangi",aman@example.com,9876543210`;
      const rows = parseCSV(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]['unique code']).toBe('DFR-01');
      expect(rows[0]['name']).toBe('Aman, Dangi');
      expect(rows[0]['phone number']).toBe('9876543210');
    });
  });

  describe('importAttendees', () => {
    it('imports valid rows and quarantines duplicate codes or missing fields', async () => {
      const runId = Math.floor(Math.random() * 8000) + 1000;
      const c1 = `DFR26-U${runId}A`;
      const c2 = `DFR26-U${runId}B`;
      const csv = `Unique Code,Name,Email,Phone Number,Track / Registration Status,Organization / College & Location
${c1},Aman Dangi,aman${runId}@gdgranchi.in,9876543210,Flagship Dev Track,BIT Mesra
${c2},Priya Kumari,priya${runId}@example.com,9876543211,Beginner Track,IIT ISM
${c1},Duplicate Person,dup@example.com,9876543212,Flagship Dev Track,NIT Jamshedpur
,Missing Code,test@example.com,9876543213,Conference Only,St. Xaviers
DFR26-005,,no_name@example.com,9876543214,Conference Only,Ranchi University`;

      const result = await importAttendees({ csvText: csv });

      expect(result.totalRows).toBe(5);
      expect(result.importedCount).toBe(2);
      expect(result.quarantinedCount).toBe(3);

      // Verify DB records
      const attendee1 = await db.findAttendeeByUniqueCode(c1);
      expect(attendee1).not.toBeNull();
      expect(attendee1.name).toBe('Aman Dangi');
      expect(attendee1.display_name).toBe('Aman D.');
      expect(attendee1.email_normalized).toBe(`aman${runId}@gdgranchi.in`);

      // Verify track assignment
      const tracks = await db.getAttendeeTracks(attendee1.id);
      expect(tracks).toContain('flagship-dev');
    });
  });

  describe('resolveTargetColumns', () => {
    it('accurately resolves all 7 target columns and isolates ignored survey columns', () => {
      const headers = [
        'Timestamp',
        'Ticket Code',
        'Attendee Name',
        'Email Address',
        'Phone Number',
        'Track / Registration Status',
        'Organization / College & Location',
        'Designation / Domain',
        'T-Shirt Size',
        'Food Preference',
      ];

      const res = resolveTargetColumns(headers);
      expect(res.mapping.uniqueCode.matchedHeader).toBe('Ticket Code');
      expect(res.mapping.name.matchedHeader).toBe('Attendee Name');
      expect(res.mapping.email.matchedHeader).toBe('Email Address');
      expect(res.mapping.phone.matchedHeader).toBe('Phone Number');
      expect(res.mapping.track.matchedHeader).toBe('Track / Registration Status');
      expect(res.mapping.organization.matchedHeader).toBe('Organization / College & Location');
      expect(res.mapping.designation.matchedHeader).toBe('Designation / Domain');

      expect(res.missingRequired).toHaveLength(0);
      expect(res.ignoredColumns).toContain('Timestamp');
      expect(res.ignoredColumns).toContain('T-Shirt Size');
      expect(res.ignoredColumns).toContain('Food Preference');
    });

    it('flags missing required fields when Unique Code or Name is missing', () => {
      const headers = ['Email', 'Phone', 'College'];
      const res = resolveTargetColumns(headers);
      expect(res.missingRequired).toContain('Ticket / Unique Code');
      expect(res.missingRequired).toContain('Full Name');
    });
  });

  describe('previewAttendeeImport', () => {
    it('provides dry-run preview with column mapping and first rows', () => {
      const csv = `Ticket Code,Full Name,Email,Mobile Number,Track,College,Designation,ExtraSurveyField
DFR26-P01,Aman Dangi,aman@gdgranchi.in,+91 98765-43210,Flagship Dev Track,BIT Mesra,Engineer,Yes
DFR26-P02,Priya Kumari,priya@example.com,9876543211,Beginner Track,IIT ISM,Student,No
,Invalid Row,test@test.com,9999999999,All,College,Dev,Maybe`;

      const preview = previewAttendeeImport({ csvText: csv, previewLimit: 5 });

      expect(preview.totalRows).toBe(3);
      expect(preview.validCount).toBe(2);
      expect(preview.quarantinedCount).toBe(1);
      expect(preview.ignoredColumns).toContain('extrasurveyfield');
      expect(preview.previewRows).toHaveLength(3);
      expect(preview.previewRows[0].uniqueCode).toBe('DFR26-P01');
      expect(preview.previewRows[0].displayName).toBe('Aman D.');
      expect(preview.previewRows[0].phone).toBe('9876543210');
      expect(preview.previewRows[0].trackId).toBe('flagship-dev');
      expect(preview.previewRows[0].isValid).toBe(true);
      expect(preview.previewRows[2].isValid).toBe(false);
      expect(preview.previewRows[2].quarantineReason).toBe('Missing unique ticket code');
    });
  });
});
