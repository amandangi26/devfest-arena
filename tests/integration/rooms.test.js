import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { db } from '../../server/db/index.js';
import { config } from '../../server/config.js';
import { importAttendees } from '../../server/services/attendeeImportService.js';
import { createGame, publishGame } from '../../server/services/gameService.js';

describe('Room Orchestrator & Live Gameplay Integration', () => {
  let app;
  let publishedVersion;
  let gameDef;
  let attendeeCookie;

  beforeEach(async () => {
    db.resetMemoryStore();
    app = createApp();

    // 1. Seed attendee
    const csv = `Unique Code,Name,Email,Phone Number,Track / Registration Status,Organization / College & Location
DFR26-G1,Gaurav Kumar,gaurav@example.com,9876543299,Flagship Dev Track,BIT Mesra`;
    await importAttendees({ csvText: csv });

    // 2. Login attendee to obtain session cookie
    const loginRes = await request(app)
      .post('/api/auth/verify-ticket')
      .send({ uniqueCode: 'DFR26-G1', contact: 'gaurav@example.com' });
    attendeeCookie = loginRes.headers['set-cookie'];

    // 3. Create & publish test game
    gameDef = await createGame({
      title: 'Realtime Architecture Battle',
      trackTarget: 'flagship-dev',
      questions: [
        {
          questionId: 'q-1',
          order: 1,
          prompt: 'What Google Cloud service provides serverless containers?',
          options: [
            { id: 'opt_1', text: 'GCE' },
            { id: 'opt_2', text: 'Cloud Run' },
            { id: 'opt_3', text: 'Cloud Functions' },
            { id: 'opt_4', text: 'GKE' },
          ],
          correctOptionId: 'opt_2',
          timeLimitSeconds: 15,
          explanation: 'Cloud Run provides fully managed serverless containers.',
        },
      ],
    });

    publishedVersion = await publishGame(gameDef.id);
  });

  it('runs complete synchronized question lifecycle and idempotent answer submission', async () => {
    // 1. Admin creates live room
    const createRoomRes = await request(app)
      .post('/api/rooms')
      .set('x-admin-key', config.adminApiKey)
      .send({
        gameDefinitionId: gameDef.id,
        gameVersionId: publishedVersion.id,
        trackTarget: 'flagship-dev',
      });

    expect(createRoomRes.status).toBe(201);
    const roomCode = createRoomRes.body.roomCode;
    expect(roomCode).toHaveLength(6);

    // 2. Attendee joins room lobby
    const joinRes = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .set('Cookie', attendeeCookie);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.ok).toBe(true);

    // 3. Admin transitions to COUNTDOWN, then QUESTION_ACTIVE
    await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'COUNTDOWN' });

    const activeRes = await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'QUESTION_ACTIVE', questionIndex: 0 });

    expect(activeRes.status).toBe(200);
    expect(activeRes.body.room.status).toBe('QUESTION_ACTIVE');

    // 4. Verify public projection does NOT leak correctOptionId during active play
    const stateRes = await request(app).get(`/api/rooms/${roomCode}/state`);
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.state.activeQuestion.correctOptionId).toBeNull();
    expect(stateRes.body.state.resultsBreakdown).toBeNull();

    // 5. Attendee submits correct answer (opt_2)
    const submitRes = await request(app)
      .post(`/api/rooms/${roomCode}/submit-answer`)
      .set('Cookie', attendeeCookie)
      .send({ selectedOptionId: 'opt_2' });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.isCorrect).toBe(true);
    expect(submitRes.body.pointsAwarded).toBe(100);

    // 6. Idempotency test: duplicate submission must be rejected
    const dupRes = await request(app)
      .post(`/api/rooms/${roomCode}/submit-answer`)
      .set('Cookie', attendeeCookie)
      .send({ selectedOptionId: 'opt_1' });

    expect(dupRes.status).toBe(409); // Conflict

    // 7. Admin reveals results (QUESTION_RESULT)
    await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'QUESTION_RESULT' });

    const revealState = await request(app).get(`/api/rooms/${roomCode}/state`);
    expect(revealState.body.state.resultsBreakdown).not.toBeNull();
    expect(revealState.body.state.resultsBreakdown.correctOptionId).toBe('opt_2');
    expect(revealState.body.state.resultsBreakdown.opt_2).toBe(1);

    // 8. Admin shows leaderboard (LEADERBOARD)
    await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'LEADERBOARD' });

    const leaderState = await request(app).get(`/api/rooms/${roomCode}/state`);
    expect(leaderState.body.state.leaderboard).toHaveLength(1);
    expect(leaderState.body.state.leaderboard[0].displayName).toBe('Gaurav K.');
    expect(leaderState.body.state.leaderboard[0].rank).toBe(1);
  });

  it('allows anchor quick manual overrides and advanceNext across questions without illegal transition errors', async () => {
    // 1. Create a 2-question game
    const multiGameDef = await createGame({
      title: 'DevFest Quick Battle',
      trackTarget: 'flagship-dev',
      questions: [
        {
          questionId: 'q-1',
          order: 1,
          prompt: 'Question 1',
          options: [
            { id: 'opt_1', text: 'A' },
            { id: 'opt_2', text: 'B' },
            { id: 'opt_3', text: 'C' },
            { id: 'opt_4', text: 'D' },
          ],
          correctOptionId: 'opt_1',
          timeLimitSeconds: 10,
        },
        {
          questionId: 'q-2',
          order: 2,
          prompt: 'Question 2',
          options: [
            { id: 'opt_1', text: 'A' },
            { id: 'opt_2', text: 'B' },
            { id: 'opt_3', text: 'C' },
            { id: 'opt_4', text: 'D' },
          ],
          correctOptionId: 'opt_2',
          timeLimitSeconds: 10,
        },
      ],
    });
    const multiVersion = await publishGame(multiGameDef.id);

    // 2. Create room
    const createRes = await request(app)
      .post('/api/rooms')
      .set('x-admin-key', config.adminApiKey)
      .send({
        gameDefinitionId: multiGameDef.id,
        gameVersionId: multiVersion.id,
      });
    const roomCode = createRes.body.roomCode;

    // 3. Anchor Override: 3-2-1 Countdown
    let res = await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'COUNTDOWN' });
    expect(res.status).toBe(200);
    expect(res.body.room.status).toBe('COUNTDOWN');

    // 4. Anchor Override: Push Live Now (Skip 3s)
    res = await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'QUESTION_ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.room.status).toBe('QUESTION_ACTIVE');
    expect(res.body.room.currentQuestionIndex).toBe(0);

    // 5. Anchor Override: Lock Answers
    res = await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'QUESTION_LOCKED' });
    expect(res.status).toBe(200);
    expect(res.body.room.status).toBe('QUESTION_LOCKED');

    // 6. Anchor Override: Reveal Results
    res = await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'QUESTION_RESULT' });
    expect(res.status).toBe(200);
    expect(res.body.room.status).toBe('QUESTION_RESULT');

    // 7. Anchor Override: Stage Leaderboard
    res = await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'LEADERBOARD' });
    expect(res.status).toBe(200);
    expect(res.body.room.status).toBe('LEADERBOARD');

    // 8. Anchor Override: Next Question (calls advance)
    res = await request(app)
      .post(`/api/rooms/${roomCode}/advance`)
      .set('x-admin-key', config.adminApiKey);
    expect(res.status).toBe(200);

    // Check room state: should be in COUNTDOWN for question index 1
    const stateRes = await request(app).get(`/api/rooms/${roomCode}/state`);
    expect(stateRes.body.state.status).toBe('COUNTDOWN');
    expect(stateRes.body.state.currentQuestionIndex).toBe(1);

    // 9. Jump straight to QUESTION_ACTIVE for Question 2
    res = await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'QUESTION_ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.room.currentQuestionIndex).toBe(1);

    // 10. Anchor Override: Finish Match directly from active question
    res = await request(app)
      .post(`/api/rooms/${roomCode}/transition`)
      .set('x-admin-key', config.adminApiKey)
      .send({ targetState: 'GAME_OVER' });
    expect(res.status).toBe(200);
    expect(res.body.room.status).toBe('GAME_OVER');
  });

  it('allows an admin to close / discard an active room and removes it from active rooms list', async () => {
    // 1. Admin creates a live room
    const createRes = await request(app)
      .post('/api/rooms')
      .set('x-admin-key', config.adminApiKey)
      .send({
        gameDefinitionId: gameDef.id,
        gameVersionId: publishedVersion.id,
        trackTarget: 'flagship-dev',
        hallName: 'Hall 2 (AI & Web)',
      });

    expect(createRes.status).toBe(201);
    const roomCode = createRes.body.roomCode;

    // 2. Room shows up in active rooms list
    const activeRes = await request(app).get('/api/rooms/public');
    expect(activeRes.status).toBe(200);
    const foundBefore = activeRes.body.data.some((r) => r.roomCode === roomCode);
    expect(foundBefore).toBe(true);

    // 3. Admin deletes / closes the room
    const deleteRes = await request(app)
      .delete(`/api/rooms/${roomCode}`)
      .set('x-admin-key', config.adminApiKey);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.ok).toBe(true);

    // 4. Room is no longer in active rooms list
    const activeAfterRes = await request(app).get('/api/rooms/public');
    const foundAfter = activeAfterRes.body.data.some((r) => r.roomCode === roomCode);
    expect(foundAfter).toBe(false);
  });
});
