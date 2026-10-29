import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { db } from '../../server/db/index.js';
import { config } from '../../server/config.js';

describe('Game Builder API Integration (/api/games)', () => {
  let app;

  beforeEach(() => {
    db.resetMemoryStore();
    app = createApp();
  });

  const testQuestion = {
    questionId: 'q-1',
    order: 1,
    prompt: 'Which Gemini model is optimized for high-frequency low-latency execution?',
    icon: 'Sparkles',
    options: [
      { id: 'opt_1', text: 'Gemini 1.5 Ultra' },
      { id: 'opt_2', text: 'Gemini 1.5 Flash' },
      { id: 'opt_3', text: 'Gemini 1.0 Pro' },
      { id: 'opt_4', text: 'Gemini Nano 2' },
    ],
    correctOptionId: 'opt_2',
    timeLimitSeconds: 20,
    explanation: 'Flash is architected for sub-second latency and high request frequency.',
  };

  describe('Security Barrier: requireAdmin', () => {
    it('blocks unauthenticated requests without x-admin-key', async () => {
      const res = await request(app).get('/api/games');
      expect(res.status).toBe(403);
    });
  });

  describe('Full CRUD Workflow', () => {
    it('creates draft, updates questions, publishes version, and lists versions', async () => {
      // 1. Create Game Draft
      const createRes = await request(app)
        .post('/api/games')
        .set('x-admin-key', config.adminApiKey)
        .send({
          title: 'Gemini Stage Quiz',
          description: 'DevFest 2026 AI Quiz',
          trackTarget: 'flagship-dev',
          questions: [testQuestion],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.ok).toBe(true);
      const gameId = createRes.body.game.id;

      // 2. Fetch Game Draft
      const getRes = await request(app)
        .get(`/api/games/${gameId}`)
        .set('x-admin-key', config.adminApiKey);

      expect(getRes.status).toBe(200);
      expect(getRes.body.game.title).toBe('Gemini Stage Quiz');
      expect(getRes.body.game.questions).toHaveLength(1);

      // 3. Update Game Draft
      const updateRes = await request(app)
        .put(`/api/games/${gameId}`)
        .set('x-admin-key', config.adminApiKey)
        .send({
          title: 'Google AI Architecture Showdown',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.game.title).toBe('Google AI Architecture Showdown');

      // 4. Publish Version 1
      const pubRes = await request(app)
        .post(`/api/games/${gameId}/publish`)
        .set('x-admin-key', config.adminApiKey);

      expect(pubRes.status).toBe(201);
      expect(pubRes.body.version.version_number).toBe(1);
      expect(pubRes.body.version.total_questions).toBe(1);

      // 5. List Versions
      const versRes = await request(app)
        .get(`/api/games/${gameId}/versions`)
        .set('x-admin-key', config.adminApiKey);

      expect(versRes.status).toBe(200);
      expect(versRes.body.data).toHaveLength(1);
      expect(versRes.body.data[0].version_number).toBe(1);

      // 6. Duplicate Game
      const dupRes = await request(app)
        .post(`/api/games/${gameId}/duplicate`)
        .set('x-admin-key', config.adminApiKey);

      expect(dupRes.status).toBe(201);
      expect(dupRes.body.game.title).toContain('Copy');

      // 7. Archive Game
      const delRes = await request(app)
        .delete(`/api/games/${gameId}`)
        .set('x-admin-key', config.adminApiKey);

      expect(delRes.status).toBe(200);
      expect(delRes.body.game.status).toBe('ARCHIVED');
    });
  });
});
