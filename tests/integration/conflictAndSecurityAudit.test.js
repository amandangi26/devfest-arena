import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { db } from '../../server/db/index.js';
import { config } from '../../server/config.js';
import { importAttendees } from '../../server/services/attendeeImportService.js';
import { createGame, publishGame } from '../../server/services/gameService.js';
import { roomOrchestrator } from '../../server/services/roomOrchestrator.js';
import { resetRateLimiters } from '../../server/middleware/rateLimiter.js';

describe('Security, Multi-Admin Conflicts & Adversarial Testing Suite', () => {
  let app;
  let publishedVersion1;
  let publishedVersion2;
  let gameDef1;
  let gameDef2;
  let attendeeCookie1;
  let attendeeCookie2;

  beforeEach(async () => {
    db.resetMemoryStore();
    roomOrchestrator.rooms.clear();
    resetRateLimiters();
    app = createApp();

    // 1. Seed two attendees
    const csv = `Unique Code,Name,Email,Phone Number,Track / Registration Status,Organization / College & Location
DFR26-SEC1,Alice Security,alice@example.com,9876543211,Flagship Dev Track,BIT Mesra
DFR26-SEC2,Bob Adversary,bob@example.com,9876543222,All Tracks,Ranchi University`;
    await importAttendees({ csvText: csv });

    // 2. Obtain session cookies for both
    const res1 = await request(app)
      .post('/api/auth/verify-ticket')
      .send({ uniqueCode: 'DFR26-SEC1', contact: 'alice@example.com' });
    attendeeCookie1 = res1.headers['set-cookie'];

    const res2 = await request(app)
      .post('/api/auth/verify-ticket')
      .send({ uniqueCode: 'DFR26-SEC2', contact: 'bob@example.com' });
    attendeeCookie2 = res2.headers['set-cookie'];

    // 3. Create two test quizzes (for 2 different halls)
    gameDef1 = await createGame({
      title: 'Hall 1 Cloud Quiz',
      trackTarget: 'flagship-dev',
      hallName: 'Hall-1',
      questions: [
        {
          questionId: 'q-101',
          order: 1,
          prompt: 'What Google Cloud service runs containers serverless?',
          options: [
            { id: 'opt_1', text: 'GCE' },
            { id: 'opt_2', text: 'Cloud Run' },
            { id: 'opt_3', text: 'Cloud Functions' },
            { id: 'opt_4', text: 'GKE' },
          ],
          correctOptionId: 'opt_2',
          timeLimitSeconds: 15,
          explanation: 'Cloud Run runs serverless containers.',
        },
      ],
    });
    publishedVersion1 = await publishGame(gameDef1.id);

    gameDef2 = await createGame({
      title: 'Hall 2 AI Quiz',
      trackTarget: 'all',
      hallName: 'Hall-2',
      questions: [
        {
          questionId: 'q-201',
          order: 1,
          prompt: 'What is Gemini?',
          options: [
            { id: 'opt_1', text: 'LLM Model' },
            { id: 'opt_2', text: 'Database' },
            { id: 'opt_3', text: 'OS' },
            { id: 'opt_4', text: 'Browser' },
          ],
          correctOptionId: 'opt_1',
          timeLimitSeconds: 15,
          explanation: 'Gemini is Google multimodal AI model.',
        },
      ],
    });
    publishedVersion2 = await publishGame(gameDef2.id);
  });

  /* ========================================================================= */
  /* SCENARIO 1: Single Attendee attempting to join 2 Games simultaneously     */
  /* ========================================================================= */
  describe('Conflict Scenario 1: One User attempting to join 2 Games concurrently', () => {
    it('enforces Single-Active-Hall policy: moving to Room 2 removes attendee from Room 1 and prevents cross-hall answering', async () => {
      // Create Room 1 in Hall-1
      const room1Res = await request(app)
        .post('/api/rooms')
        .set('x-admin-key', config.adminApiKey)
        .send({
          gameDefinitionId: gameDef1.id,
          gameVersionId: publishedVersion1.id,
          hallName: 'Hall-1',
        });
      const roomCode1 = room1Res.body.roomCode;

      // Create Room 2 in Hall-2
      const room2Res = await request(app)
        .post('/api/rooms')
        .set('x-admin-key', config.adminApiKey)
        .send({
          gameDefinitionId: gameDef2.id,
          gameVersionId: publishedVersion2.id,
          hallName: 'Hall-2',
        });
      const roomCode2 = room2Res.body.roomCode;

      // 1. Alice joins Room 1
      const join1 = await request(app).post(`/api/rooms/${roomCode1}/join`).set('Cookie', attendeeCookie1);
      expect(join1.status).toBe(200);

      const r1 = roomOrchestrator.getRoom(roomCode1);
      expect(r1.attendees.has('DFR26-SEC1')).toBe(true);

      // 2. Alice moves to Hall-2 and joins Room 2
      const join2 = await request(app).post(`/api/rooms/${roomCode2}/join`).set('Cookie', attendeeCookie1);
      expect(join2.status).toBe(200);

      const r2 = roomOrchestrator.getRoom(roomCode2);
      expect(r2.attendees.has('DFR26-SEC1')).toBe(true);
      // Automatically removed from Room 1
      expect(r1.attendees.has('DFR26-SEC1')).toBe(false);

      // 3. Admin activates Question in both rooms
      await request(app)
        .post(`/api/rooms/${roomCode1}/transition`)
        .set('x-admin-key', config.adminApiKey)
        .send({ targetState: 'QUESTION_ACTIVE', payload: { questionIndex: 0 } });

      await request(app)
        .post(`/api/rooms/${roomCode2}/transition`)
        .set('x-admin-key', config.adminApiKey)
        .send({ targetState: 'QUESTION_ACTIVE', payload: { questionIndex: 0 } });

      // 4. Alice attempts to submit answer to Room 1 (where she is no longer active)
      const submitRoom1 = await request(app)
        .post(`/api/rooms/${roomCode1}/submit-answer`)
        .set('Cookie', attendeeCookie1)
        .send({ selectedOptionId: 'opt_2' });

      // Strictly rejected with 403 Forbidden because she is not in Room 1
      expect(submitRoom1.status).toBe(403);
      expect(submitRoom1.body.error.code).toBe('NOT_IN_ROOM');

      // 5. Alice submits answer to Room 2 (where she is currently active)
      const submitRoom2 = await request(app)
        .post(`/api/rooms/${roomCode2}/submit-answer`)
        .set('Cookie', attendeeCookie1)
        .send({ selectedOptionId: 'opt_1' });

      expect(submitRoom2.status).toBe(200);
      expect(submitRoom2.body.isCorrect).toBe(true);
    });
  });

  /* ========================================================================= */
  /* SCENARIO 2: Multi-Admin Concurrency on the Same Game                      */
  /* ========================================================================= */
  describe('Conflict Scenario 2: Two Admins acting on the exact same game concurrently', () => {
    it('safely handles two admins clicking "START GAME" (LOBBY -> COUNTDOWN) at the exact same millisecond without state corruption', async () => {
      const roomRes = await request(app)
        .post('/api/rooms')
        .set('x-admin-key', config.adminApiKey)
        .send({
          gameDefinitionId: gameDef1.id,
          gameVersionId: publishedVersion1.id,
          hallName: 'Conference Hall',
        });
      const roomCode = roomRes.body.roomCode;

      // Admin 1 and Admin 2 both trigger START GAME at the exact same time
      const [admin1Res, admin2Res] = await Promise.all([
        request(app)
          .post(`/api/rooms/${roomCode}/transition`)
          .set('x-admin-key', config.adminApiKey)
          .send({ targetState: 'COUNTDOWN', payload: { questionIndex: 0 } }),
        request(app)
          .post(`/api/rooms/${roomCode}/transition`)
          .set('x-admin-key', config.adminApiKey)
          .send({ targetState: 'COUNTDOWN', payload: { questionIndex: 0 } }),
      ]);

      // Both should succeed gracefully or idempotently (200 status)
      expect(admin1Res.status).toBe(200);
      expect(admin2Res.status).toBe(200);

      const room = roomOrchestrator.getRoom(roomCode);
      expect(room.status).toBe('COUNTDOWN');
      expect(room.currentQuestionIndex).toBe(0);
    });

    it('rejects conflicting illegal transitions when an admin issues an invalid state transition', async () => {
      const roomRes = await request(app)
        .post('/api/rooms')
        .set('x-admin-key', config.adminApiKey)
        .send({
          gameDefinitionId: gameDef1.id,
          gameVersionId: publishedVersion1.id,
          hallName: 'Conference Hall',
        });
      const roomCode = roomRes.body.roomCode;

      // Start Countdown first
      await request(app)
        .post(`/api/rooms/${roomCode}/transition`)
        .set('x-admin-key', config.adminApiKey)
        .send({ targetState: 'COUNTDOWN', payload: { questionIndex: 0 } });

      // Admin tries illegal transition directly to an invalid state
      const trans2 = await request(app)
        .post(`/api/rooms/${roomCode}/transition`)
        .set('x-admin-key', config.adminApiKey)
        .send({ targetState: 'ARCHIVED' }); // Not allowed from COUNTDOWN!

      // Illegal transition is strictly rejected with 400
      expect(trans2.status).toBe(400);
      expect(trans2.body.error.code).toBe('ILLEGAL_TRANSITION');
    });
  });

  /* ========================================================================= */
  /* SCENARIO 3: Adversarial Attacks & Exploit Resistance                      */
  /* ========================================================================= */
  describe('Adversarial Exploit Testing & Backdoor Audit', () => {
    let activeRoomCode;

    beforeEach(async () => {
      const roomRes = await request(app)
        .post('/api/rooms')
        .set('x-admin-key', config.adminApiKey)
        .send({
          gameDefinitionId: gameDef1.id,
          gameVersionId: publishedVersion1.id,
          hallName: 'Hall-1',
        });
      activeRoomCode = roomRes.body.roomCode;

      // Join Alice to room
      await request(app)
        .post(`/api/rooms/${activeRoomCode}/join`)
        .set('Cookie', attendeeCookie1);
    });

    it('ATTACK: Rapid-fire double-submit race condition (10 simultaneous submits) gives exactly 1 accepted answer', async () => {
      // Put room in QUESTION_ACTIVE
      await request(app)
        .post(`/api/rooms/${activeRoomCode}/transition`)
        .set('x-admin-key', config.adminApiKey)
        .send({ targetState: 'QUESTION_ACTIVE', payload: { questionIndex: 0 } });

      // Attacker fires 10 simultaneous answer submissions with different options
      const submissions = await Promise.all(
        ['opt_1', 'opt_2', 'opt_3', 'opt_4', 'opt_2', 'opt_2', 'opt_1', 'opt_3', 'opt_4', 'opt_2'].map(
          (optId) =>
            request(app)
              .post(`/api/rooms/${activeRoomCode}/submit-answer`)
              .set('Cookie', attendeeCookie1)
              .send({ selectedOptionId: optId })
        )
      );

      // Exactly ONE submission should succeed (200)
      const successCount = submissions.filter((r) => r.status === 200).length;
      const conflictCount = submissions.filter((r) => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(9);

      // Ensure room in-memory submission count is strictly 1
      const room = roomOrchestrator.getRoom(activeRoomCode);
      expect(room.submissionCounts[0].total).toBe(1);
    });

    it('ATTACK: Late submission after question timer deadline has passed is rejected', async () => {
      // Put room in QUESTION_ACTIVE with deadline in the past
      await request(app)
        .post(`/api/rooms/${activeRoomCode}/transition`)
        .set('x-admin-key', config.adminApiKey)
        .send({ targetState: 'QUESTION_ACTIVE', payload: { questionIndex: 0 } });

      const room = roomOrchestrator.getRoom(activeRoomCode);
      room.questionDeadlineAt = Date.now() - 5000; // 5 seconds expired

      const lateRes = await request(app)
        .post(`/api/rooms/${activeRoomCode}/submit-answer`)
        .set('Cookie', attendeeCookie1)
        .send({ selectedOptionId: 'opt_2' });

      expect(lateRes.status).toBe(400);
      expect(lateRes.body.error.message).toMatch(/deadline exceeded|locked/i);
    });

    it('ATTACK: Answering when room is in LOBBY or LEADERBOARD is rejected', async () => {
      // Room is currently in LOBBY
      const submitInLobby = await request(app)
        .post(`/api/rooms/${activeRoomCode}/submit-answer`)
        .set('Cookie', attendeeCookie1)
        .send({ selectedOptionId: 'opt_2' });

      expect(submitInLobby.status).toBe(400);
      expect(submitInLobby.body.error.message).toMatch(/submissions are closed|not accepting/i);
    });

    it('ATTACK: Submitting forged or non-existent option ID is rejected with 400', async () => {
      await request(app)
        .post(`/api/rooms/${activeRoomCode}/transition`)
        .set('x-admin-key', config.adminApiKey)
        .send({ targetState: 'QUESTION_ACTIVE', payload: { questionIndex: 0 } });

      const forgedRes = await request(app)
        .post(`/api/rooms/${activeRoomCode}/submit-answer`)
        .set('Cookie', attendeeCookie1)
        .send({ selectedOptionId: 'opt_HACK_999' });

      expect(forgedRes.status).toBe(400);
      expect(forgedRes.body.error.message).toMatch(/invalid for this question/i);
    });

    it('SECURITY BACKDOOR CHECK: Attendee cannot execute admin actions without x-admin-key', async () => {
      // 1. Transition state without admin key
      const transWithoutKey = await request(app)
        .post(`/api/rooms/${activeRoomCode}/transition`)
        .set('Cookie', attendeeCookie1)
        .send({ targetState: 'GAME_OVER' });
      expect([401, 403]).toContain(transWithoutKey.status);

      // 2. Discard / delete room without admin key
      const deleteWithoutKey = await request(app)
        .delete(`/api/rooms/${activeRoomCode}`)
        .set('Cookie', attendeeCookie1);
      expect([401, 403]).toContain(deleteWithoutKey.status);

      // 3. Create room without admin key
      const createWithoutKey = await request(app)
        .post('/api/rooms')
        .set('Cookie', attendeeCookie1)
        .send({ gameDefinitionId: gameDef1.id });
      expect([401, 403]).toContain(createWithoutKey.status);

      // 4. Create / edit game without admin key
      const gameWithoutKey = await request(app)
        .post('/api/games')
        .set('Cookie', attendeeCookie1)
        .send({ title: 'Hacked Quiz' });
      expect([401, 403]).toContain(gameWithoutKey.status);
    });

    it('SECURITY: Unauthenticated user without cookie cannot submit answers', async () => {
      await request(app)
        .post(`/api/rooms/${activeRoomCode}/transition`)
        .set('x-admin-key', config.adminApiKey)
        .send({ targetState: 'QUESTION_ACTIVE', payload: { questionIndex: 0 } });

      const res = await request(app)
        .post(`/api/rooms/${activeRoomCode}/submit-answer`)
        .set('Cookie', 'dfr26_session=invalid_or_expired')
        .send({ selectedOptionId: 'opt_2' });

      expect(res.status).toBe(401);
    });
  });
});
