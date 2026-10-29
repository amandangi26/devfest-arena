import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatDisplayName,
  normalizeEmail,
  normalizePhone,
  normalizeTrackId,
  parseCSV,
  importAttendees,
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
});
