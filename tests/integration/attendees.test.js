import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { db } from '../../server/db/index.js';
import { config } from '../../server/config.js';

describe('Attendees Admin API Integration', () => {
  let app;

  beforeEach(() => {
    db.resetMemoryStore();
    app = createApp();
  });

  describe('POST /api/attendees/import', () => {
    it('blocks unauthorized access without admin key', async () => {
      const res = await request(app)
        .post('/api/attendees/import')
        .send({ csvText: 'Unique Code,Name\nDFR-1,Test' });

      expect(res.status).toBe(403);
    });

    it('successfully imports attendees with valid admin key', async () => {
      const runId = Math.floor(Math.random() * 8000) + 1000;
      const csv = `Unique Code,Name,Email,Phone Number,Track / Registration Status,Organization / College & Location
DFR26-A${runId}1,Aditi Verma,aditi${runId}@example.com,9876543220,Flagship Dev Track,BIT Mesra
DFR26-A${runId}2,Vikram Singh,vikram${runId}@example.com,9876543221,Conference Only,IIM Ranchi`;

      const res = await request(app)
        .post('/api/attendees/import')
        .set('x-admin-key', config.adminApiKey)
        .send({ csvText: csv });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.report.importedCount).toBe(2);
      expect(res.body.report.quarantinedCount).toBe(0);

      // Verify listing
      const listRes = await request(app)
        .get('/api/attendees')
        .set('x-admin-key', config.adminApiKey);

      expect(listRes.status).toBe(200);
      expect(listRes.body.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('POST /api/attendees/:uniqueCode/check-in', () => {
    it('marks physical check-in without affecting ticket verification status', async () => {
      const csv = `Unique Code,Name,Email,Phone Number\nDFR26-601,Rahul Roy,rahul@example.com,9876543230`;
      await request(app)
        .post('/api/attendees/import')
        .set('x-admin-key', config.adminApiKey)
        .send({ csvText: csv });

      const checkInRes = await request(app)
        .post('/api/attendees/DFR26-601/check-in')
        .set('x-admin-key', config.adminApiKey);

      expect(checkInRes.status).toBe(200);
      expect(checkInRes.body.attendee.attendanceStatus).toBe('checked_in');
      expect(checkInRes.body.attendee.checkedInAt).toBeDefined();

      const attendee = await db.findAttendeeByUniqueCode('DFR26-601');
      expect(attendee.attendance_status).toBe('checked_in');
      expect(attendee.ticket_verified_at).toBe(null); // Separate fact!
    });
  });

  describe('POST /api/attendees (Manual Entry)', () => {
    it('manually registers a walk-in attendee with custom code', async () => {
      const res = await request(app)
        .post('/api/attendees')
        .set('x-admin-key', config.adminApiKey)
        .send({
          uniqueCode: 'DFR26-SPOT-101',
          name: 'Pooja Kashyap',
          email: 'pooja@example.com',
          phone: '9876543299',
          organization: 'Ranchi Women College',
          track: 'flagship-dev',
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.attendee.unique_code).toBe('DFR26-SPOT-101');
      expect(res.body.attendee.name).toBe('Pooja Kashyap');
      expect(res.body.attendee.display_name).toBe('Pooja K.');
      expect(res.body.attendee.attendance_status).toBe('checked_in');

      // Verify attendee is in database
      const found = await db.findAttendeeByUniqueCode('DFR26-SPOT-101');
      expect(found).toBeDefined();
      expect(found.email_normalized).toBe('pooja@example.com');
    });

    it('auto-generates spot code if uniqueCode is not provided', async () => {
      const res = await request(app)
        .post('/api/attendees')
        .set('x-admin-key', config.adminApiKey)
        .send({
          name: 'Amit Kumar',
          email: 'amit@example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.attendee.unique_code).toMatch(/^DFR26-W\d+$/);
    });

    it('rejects duplicate ticket code with 409 Conflict', async () => {
      await request(app)
        .post('/api/attendees')
        .set('x-admin-key', config.adminApiKey)
        .send({
          uniqueCode: 'DFR26-SPOT-DUP',
          name: 'First User',
          email: 'first@example.com',
        });

      const dupRes = await request(app)
        .post('/api/attendees')
        .set('x-admin-key', config.adminApiKey)
        .send({
          uniqueCode: 'DFR26-SPOT-DUP',
          name: 'Second User',
          email: 'second@example.com',
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe('DUPLICATE_UNIQUE_CODE');
    });

    it('rejects missing name or invalid email with 400', async () => {
      const res = await request(app)
        .post('/api/attendees')
        .set('x-admin-key', config.adminApiKey)
        .send({
          name: '',
          email: 'not-an-email',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
