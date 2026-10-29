import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { db } from '../../server/db/index.js';
import { importAttendees } from '../../server/services/attendeeImportService.js';
import { config } from '../../server/config.js';

describe('Auth & Session API Integration', () => {
  let app;

  beforeEach(async () => {
    db.resetMemoryStore();
    app = createApp();

    // Seed test attendees
    const csv = `Unique Code,Name,Email,Phone Number,Track / Registration Status,Organization / College & Location
DFR26-101,Rohan Sharma,rohan@example.com,+91 98765-43210,Flagship Dev Track,BIT Mesra
DFR26-102,Kavita Sen,kavita@example.com,9876543219,Beginner Track,St. Xaviers`;

    await importAttendees({ csvText: csv });
  });

  describe('POST /api/auth/verify-ticket', () => {
    it('verifies valid ticket with email and sets HttpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/auth/verify-ticket')
        .send({
          uniqueCode: 'DFR26-101',
          contact: 'rohan@example.com',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.profile.uniqueCode).toBe('DFR26-101');
      expect(res.body.profile.displayName).toBe('Rohan S.');
      expect(res.body.profile.trackIds).toContain('flagship-dev');
      expect(res.body.token).toBeDefined();

      // Check cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(config.sessionCookieName);
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('verifies valid ticket with phone number', async () => {
      const res = await request(app)
        .post('/api/auth/verify-ticket')
        .send({
          uniqueCode: 'DFR26-101',
          contact: '9876543210',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.profile.displayName).toBe('Rohan S.');
    });

    it('rejects invalid ticket code with generic 401 error', async () => {
      const res = await request(app)
        .post('/api/auth/verify-ticket')
        .send({
          uniqueCode: 'DFR26-999',
          contact: 'rohan@example.com',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid ticket code or contact details');
    });

    it('rejects valid ticket with mismatched contact with identical generic 401 (enumeration protection)', async () => {
      const res = await request(app)
        .post('/api/auth/verify-ticket')
        .send({
          uniqueCode: 'DFR26-101',
          contact: 'wrong@example.com',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid ticket code or contact details');
    });

    it('rejects empty input with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/auth/verify-ticket')
        .send({
          uniqueCode: '',
          contact: '',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/session & POST /api/auth/logout', () => {
    it('authenticates session via cookie and successfully logs out', async () => {
      // 1. Verify ticket
      const loginRes = await request(app)
        .post('/api/auth/verify-ticket')
        .send({
          uniqueCode: 'DFR26-101',
          contact: 'rohan@example.com',
        });

      const cookie = loginRes.headers['set-cookie'];

      // 2. Fetch session
      const sessionRes = await request(app)
        .get('/api/auth/session')
        .set('Cookie', cookie);

      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.ok).toBe(true);
      expect(sessionRes.body.user.uniqueCode).toBe('DFR26-101');
      expect(sessionRes.body.user.displayName).toBe('Rohan S.');

      // 3. Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      expect(logoutRes.status).toBe(200);

      // 4. Subsequent session check should fail
      const expiredRes = await request(app)
        .get('/api/auth/session')
        .set('Cookie', cookie);

      expect(expiredRes.status).toBe(401);
    });
  });

  describe('Admin Authentication & Session Verification', () => {
    it('authenticates master admin with email and password', async () => {
      const res = await request(app)
        .post('/api/auth/admin-login')
        .send({
          email: config.adminEmail,
          password: config.adminPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.role).toBe('admin');
      expect(res.body.email).toBe(config.adminEmail);
      expect(res.body.provider).toBe('master_admin');
      expect(res.body.token).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('dfr26_admin_key');
    });

    it('rejects master admin login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/admin-login')
        .send({
          email: config.adminEmail,
          password: 'wrong-admin-password',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects master admin login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/admin-login')
        .send({
          email: 'notanadmin@devfest.in',
          password: config.adminPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects login with missing email or password with 400', async () => {
      const res = await request(app)
        .post('/api/auth/admin-login')
        .send({ email: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_CREDENTIALS');
    });

    it('rejects raw passkey login without email & password', async () => {
      const res = await request(app)
        .post('/api/auth/admin-login')
        .send({ adminKey: config.adminApiKey });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_CREDENTIALS');
    });

    it('verifies active admin session via cookie or header', async () => {
      const loginRes = await request(app)
        .post('/api/auth/admin-login')
        .send({
          email: config.adminEmail,
          password: config.adminPassword,
        });

      const adminCookie = loginRes.headers['set-cookie'];

      const sessionRes = await request(app)
        .get('/api/auth/admin-session')
        .set('Cookie', adminCookie);

      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.isAdmin).toBe(true);
      expect(sessionRes.body.email).toBe(config.adminEmail);
    });

    it('logs out admin and clears cookie', async () => {
      const res = await request(app).post('/api/auth/admin-logout');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
