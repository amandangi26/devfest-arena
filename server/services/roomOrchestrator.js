import crypto from 'crypto';
import { db } from '../db/index.js';
import { memoryStore } from '../db/memoryStore.js';
import { generateRoomCode } from '../lib/roomCode.js';
import { toSafeQuestion } from './gameService.js';
import { calculateScore } from './scoringService.js';

export class RoomError extends Error {
  constructor(message, status = 400, code = 'ROOM_ERROR') {
    super(message);
    this.name = 'RoomError';
    this.status = status;
    this.code = code;
  }
}

// Allowed state transitions table
const ALLOWED_TRANSITIONS = {
  LOBBY: ['COUNTDOWN', 'QUESTION_ACTIVE', 'GAME_OVER', 'ARCHIVED'],
  COUNTDOWN: ['COUNTDOWN', 'QUESTION_ACTIVE', 'PAUSED', 'QUESTION_LOCKED', 'LOBBY', 'GAME_OVER'],
  QUESTION_ACTIVE: ['QUESTION_ACTIVE', 'QUESTION_LOCKED', 'QUESTION_RESULT', 'LEADERBOARD', 'PAUSED', 'COUNTDOWN', 'GAME_OVER'],
  PAUSED: ['QUESTION_ACTIVE', 'QUESTION_LOCKED', 'QUESTION_RESULT', 'LEADERBOARD', 'COUNTDOWN', 'GAME_OVER', 'ARCHIVED'],
  QUESTION_LOCKED: ['QUESTION_LOCKED', 'QUESTION_RESULT', 'LEADERBOARD', 'QUESTION_ACTIVE', 'COUNTDOWN', 'GAME_OVER'],
  QUESTION_RESULT: ['QUESTION_RESULT', 'LEADERBOARD', 'COUNTDOWN', 'QUESTION_ACTIVE', 'QUESTION_LOCKED', 'GAME_OVER'],
  LEADERBOARD: ['LEADERBOARD', 'COUNTDOWN', 'QUESTION_ACTIVE', 'QUESTION_RESULT', 'GAME_OVER'],
  GAME_OVER: ['ARCHIVED', 'LEADERBOARD', 'LOBBY'],
  ARCHIVED: ['LOBBY'],
};

class RoomOrchestrator {
  constructor() {
    // In-memory active room cache for instant access
    this.rooms = new Map(); // roomCode -> RoomInstance
    this.subscribers = new Map(); // roomCode -> Set<Response (SSE)>
    this.pendingAnswersQueue = []; // In-memory write buffer for answers
    this.broadcastDebounceTimers = new Map(); // roomCode -> timeout
    this.startGlobalTicker();
  }

  // SSE Subscription
  subscribe(roomCode, res) {
    const code = roomCode.toUpperCase().trim();
    if (!this.subscribers.has(code)) {
      this.subscribers.set(code, new Set());
    }
    const set = this.subscribers.get(code);
    set.add(res);

    // Initial projection push
    const projection = this.getPublicProjection(code);
    if (projection) {
      res.write(`data: ${JSON.stringify(projection)}\n\n`);
    }

    return () => {
      set.delete(res);
      if (set.size === 0) {
        this.subscribers.delete(code);
      }
    };
  }

  /**
   * Throttles SSE broadcasts during high-concurrency bursts (max 4 per second per room).
   * Prevents socket buffer exhaustion when hundreds of attendees submit within seconds.
   */
  throttledBroadcast(roomCode, waitMs = 250) {
    const code = roomCode.toUpperCase().trim();
    if (this.broadcastDebounceTimers.has(code)) return;

    const timer = setTimeout(() => {
      this.broadcastDebounceTimers.delete(code);
      this.broadcast(code);
    }, waitMs);
    if (timer.unref) timer.unref();
    this.broadcastDebounceTimers.set(code, timer);
  }

  broadcast(roomCode) {
    const code = roomCode.toUpperCase().trim();
    if (this.broadcastDebounceTimers.has(code)) {
      clearTimeout(this.broadcastDebounceTimers.get(code));
      this.broadcastDebounceTimers.delete(code);
    }
    const set = this.subscribers.get(code);
    if (!set || set.size === 0) return;

    const projection = this.getPublicProjection(code);
    if (!projection) return;

    const payload = `data: ${JSON.stringify(projection)}\n\n`;
    for (const res of set) {
      try {
        res.write(payload);
      } catch {
        set.delete(res);
      }
    }
  }

  /**
   * Flushes a micro-batch of pending answers to database.
   */
  async flushPendingAnswers(maxBatch = 200) {
    if (!this.pendingAnswersQueue || this.pendingAnswersQueue.length === 0) return 0;
    const batch = this.pendingAnswersQueue.splice(0, maxBatch);
    if (batch.length === 0) return 0;

    try {
      await db.saveAcceptedAnswersBatch(batch);
      return batch.length;
    } catch (err) {
      console.error('[RoomOrchestrator] Batch flush error, re-queuing:', err.message);
      this.pendingAnswersQueue.unshift(...batch);
      return 0;
    }
  }

  /**
   * Flushes all pending answers for a specific room or entire queue.
   */
  async flushAllPendingAnswersForRoom(roomCode) {
    if (!this.pendingAnswersQueue || this.pendingAnswersQueue.length === 0) return;
    const code = roomCode ? roomCode.toUpperCase().trim() : null;

    let matching = [];
    if (code) {
      const remaining = [];
      for (const ans of this.pendingAnswersQueue) {
        if (ans.room_code === code) {
          matching.push(ans);
        } else {
          remaining.push(ans);
        }
      }
      this.pendingAnswersQueue = remaining;
    } else {
      matching = this.pendingAnswersQueue;
      this.pendingAnswersQueue = [];
    }

    if (matching.length === 0) return;
    try {
      await db.saveAcceptedAnswersBatch(matching);
    } catch (err) {
      console.error('[RoomOrchestrator] Error flushing all answers for room:', err.message);
      this.pendingAnswersQueue.unshift(...matching);
    }
  }

  /**
   * Creates a new live game room from a published game version.
   */
  async createRoom({ gameDefinitionId, gameVersionId, trackTarget, hallName, adminId = 'admin', requirePin = false, pin = '' }) {
    let version;
    let gameTitle = 'DevFest Stage Quiz';
    const def = await db.getGameDefinition(gameDefinitionId);
    if (def?.title) gameTitle = def.title;

    const targetHall = hallName || def?.hall_name || def?.hallName || 'Conference Hall';
    const targetTrack = trackTarget || def?.track_target || def?.trackTarget || 'all';

    // Deduplication guard: if an active room already exists for this game in the same hall, return it
    for (const active of this.rooms.values()) {
      if (
        active.gameDefinitionId === gameDefinitionId &&
        active.hallName === targetHall &&
        active.status !== 'GAME_OVER' &&
        active.status !== 'ARCHIVED' &&
        active.status !== 'ENDED'
      ) {
        return active;
      }
    }

    let isEnded = def?.status === 'ENDED';
    if (!isEnded) {
      try {
        const pastSessions = await db.getGameSessionsByDefinitionId(gameDefinitionId);
        if ((pastSessions || []).some((s) => s.status === 'GAME_OVER')) {
          isEnded = true;
          if (def && def.status !== 'ENDED') {
            await db.upsertGameDefinition({ ...def, status: 'ENDED' }).catch(() => {});
          }
        }
      } catch {
        // ignore
      }
    }

    if (isEnded) {
      throw new RoomError(
        `Cannot launch "${gameTitle}": This quiz has already concluded and is marked as ENDED. Under DevFest tournament rules, replay is disabled.`,
        400,
        'GAME_ENDED'
      );
    }

    if (gameVersionId) {
      version = await db.getGameVersion(gameVersionId);
    } else {
      const versions = await db.listGameVersions(gameDefinitionId);
      if (versions.length > 0) {
        version = versions[0];
      } else {
        const questions = def?.questions;

        if (questions && questions.length > 0) {
          version = {
            id: `ver_${gameDefinitionId}_v1`,
            game_definition_id: gameDefinitionId,
            version_number: 1,
            total_questions: questions.length,
            questions,
            created_at: Date.now(),
          };
          try {
            await db.createGameVersion(version);
          } catch {
            // ignore
          }
        } else {
          throw new RoomError(
            `Cannot launch "${gameTitle}": This quiz currently has 0 questions. Please add questions in the editor before launching a live battle room.`,
            400
          );
        }
      }
    }

    if (!version || !version.questions || version.questions.length === 0) {
      throw new RoomError('Invalid game version for room creation.', 400);
    }

    // Generate unique room code
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (this.rooms.has(roomCode) && attempts < 10) {
      roomCode = generateRoomCode();
      attempts++;
    }

    const requiresPin = Boolean(requirePin);
    const roomPin = requiresPin ? (pin && String(pin).trim() ? String(pin).trim().toUpperCase() : roomCode) : null;

    const now = Date.now();
    const room = {
      id: `room_${crypto.randomBytes(6).toString('hex')}`,
      roomCode,
      hallName: targetHall,
      gameTitle,
      requiresPin,
      pin: roomPin,
      gameDefinitionId: version.game_definition_id,
      gameVersionId: version.id,
      trackTarget: targetTrack,
      status: 'LOBBY',
      stateVersion: 1,
      currentQuestionIndex: 0,
      totalQuestions: version.total_questions,
      questions: version.questions, // Authoritative version snapshot
      questionStartedAt: null,
      questionDeadlineAt: null,
      pausedAt: null,
      remainingTimeMsAtPause: null,
      scheduledStartTime: null,
      resultEndsAt: null,
      leaderboardEndsAt: null,
      startedAt: null,
      endedAt: null,
      createdAt: now,
      attendees: new Map(), // uniqueCode -> attendee
      submissionCounts: {}, // questionIndex -> { total, breakdown: { opt_1: n, ... } }
      submissionsByQuestion: {}, // questionIndex -> Map(uniqueCode -> { ... })
      leaderboardCache: [],
    };

    this.rooms.set(roomCode, room);

    // Persist session to database
    await db.upsertGameSession({
      id: room.id,
      room_code: room.roomCode,
      game_definition_id: room.gameDefinitionId,
      game_version_id: room.gameVersionId,
      track_target: room.trackTarget,
      status: room.status,
      state_version: room.stateVersion,
      current_question_index: room.currentQuestionIndex,
      created_at: room.createdAt,
    });

    await db.logAuditEvent({
      id: `audit_${crypto.randomBytes(8).toString('hex')}`,
      admin_id: adminId,
      action: 'CREATE_ROOM',
      target_id: roomCode,
      details: { versionId: version.id, totalQuestions: room.totalQuestions },
    });

    return room;
  }

  getRoom(roomCode) {
    if (!roomCode) return null;
    return this.rooms.get(roomCode.toUpperCase().trim()) || null;
  }

  listActiveRooms() {
    return Array.from(this.rooms.values())
      .filter((r) => r.status !== 'GAME_OVER' && r.status !== 'ARCHIVED' && r.status !== 'ENDED')
      .map((r) => ({
        roomCode: r.roomCode,
        gameDefinitionId: r.gameDefinitionId,
        gameVersionId: r.gameVersionId,
        gameTitle: r.gameTitle || 'Tech Stage Battle',
        hallName: r.hallName || 'Conference Hall',
        trackTarget: r.trackTarget,
        status: r.status,
        requiresPin: Boolean(r.requiresPin),
        currentQuestionIndex: r.currentQuestionIndex,
        totalQuestions: r.totalQuestions,
        attendeeCount: r.attendees.size,
        createdAt: r.createdAt,
      }));
  }

  /**
   * Registers attendee joining the room lobby.
   */
  async joinRoom(roomCode, attendee, providedPin = '') {
    const code = (roomCode || '').toUpperCase().trim();
    const room = this.getRoom(code);
    if (!room) {
      // Check database to see if this was a concluded match
      try {
        const session = await db.getGameSessionByRoomCode(code);
        if (session && (session.status === 'GAME_OVER' || session.status === 'ARCHIVED' || session.status === 'ENDED')) {
          throw new RoomError('This battle has already concluded and is marked as ended.', 400, 'ROOM_ENDED');
        }
      } catch (e) {
        if (e instanceof RoomError) throw e;
      }
      throw new RoomError(`Room "${code}" not found or inactive.`, 404, 'ROOM_NOT_FOUND');
    }

    if (room.status === 'ARCHIVED' || room.status === 'GAME_OVER' || room.status === 'ENDED') {
      throw new RoomError('This battle has already concluded and is marked as ended.', 400, 'ROOM_ENDED');
    }

    const isAlreadyJoined = room.attendees.has(attendee.uniqueCode);

    // Verify PIN if room requires PIN (bypass if attendee is already in room)
    if (room.requiresPin && !isAlreadyJoined) {
      const cleanPin = providedPin ? String(providedPin).trim().toUpperCase() : '';
      const targetPin = String(room.pin || room.roomCode).trim().toUpperCase();
      const codePin = String(room.roomCode).trim().toUpperCase();

      if (cleanPin !== targetPin && cleanPin !== codePin) {
        if (!cleanPin) {
          throw new RoomError('This game requires a Room PIN to join. Please enter the PIN.', 401, 'PIN_REQUIRED');
        }
        throw new RoomError('Incorrect Room PIN. Please check the code with the session host.', 401, 'INVALID_PIN');
      }
    }

    // Track eligibility: log informative notice but permit all verified DevFest ticket holders to participate
    if (room.trackTarget && room.trackTarget !== 'all') {
      const normTarget = String(room.trackTarget).toLowerCase().trim();
      const eligible =
        !attendee.trackIds ||
        attendee.trackIds.length === 0 ||
        attendee.trackIds.some((t) => {
          if (!t) return false;
          const normT = String(t).toLowerCase().trim();
          return normT === normTarget || normT === 'all' || normTarget === 'all';
        });

      if (!eligible) {
        console.warn(`[RoomOrchestrator] Attendee ${attendee.uniqueCode} track (${JSON.stringify(attendee.trackIds)}) differs from room target (${room.trackTarget}). Permitting join as verified ticket holder.`);
      }
    }

    // Single Active Hall Policy: Remove attendee from any other active rooms to prevent dual-hall point farming
    for (const [otherCode, otherRoom] of this.rooms.entries()) {
      if (
        otherCode !== code &&
        otherRoom.status !== 'GAME_OVER' &&
        otherRoom.status !== 'ARCHIVED' &&
        otherRoom.status !== 'ENDED'
      ) {
        if (otherRoom.attendees.has(attendee.uniqueCode)) {
          otherRoom.attendees.delete(attendee.uniqueCode);
          this.broadcast(otherCode);
        }
      }
    }

    room.attendees.set(attendee.uniqueCode, {
      uniqueCode: attendee.uniqueCode,
      displayName: attendee.displayName,
      organization: attendee.organization,
      joinedAt: isAlreadyJoined ? room.attendees.get(attendee.uniqueCode).joinedAt : Date.now(),
    });

    this.broadcast(roomCode);
    return { ok: true, roomCode: room.roomCode, status: room.status, requiresPin: Boolean(room.requiresPin) };
  }

  /**
   * Starts server-authoritative timer loop (runs every 1000ms).
   * Ensures all participant devices change questions synchronously with the stage.
   */
  startGlobalTicker() {
    if (this._ticker) return;
    this._ticker = setInterval(async () => {
      try {
        await this.tick();
      } catch (err) {
        // ticker exception suppressed
      }
    }, 1000);
    if (this._ticker.unref) this._ticker.unref();
  }

  async tick() {
    const now = Date.now();

    // Micro-batch persistence: flush pending answers continuously (up to 200 answers/sec)
    if (this.pendingAnswersQueue && this.pendingAnswersQueue.length > 0) {
      await this.flushPendingAnswers(200).catch((err) => {
        console.error('[Ticker] Background flush error:', err.message);
      });
    }

    for (const [roomCode, room] of this.rooms.entries()) {
      if (!room || room.status === 'ARCHIVED' || room.status === 'GAME_OVER') continue;

      // 1. Scheduled Start in LOBBY
      if (room.status === 'LOBBY' && room.scheduledStartTime && now >= room.scheduledStartTime) {
        room.scheduledStartTime = null;
        try {
          await this.transitionState(roomCode, 'COUNTDOWN');
        } catch (e) {
          console.error('[Ticker] scheduled start error:', e.message);
        }
        continue;
      }

      // 2. Countdown Complete -> Launch Question
      if (room.status === 'COUNTDOWN' && room.countdownEndsAt && now >= room.countdownEndsAt) {
        room.countdownEndsAt = null;
        try {
          await this.transitionState(roomCode, 'QUESTION_ACTIVE', {
            questionIndex: room.currentQuestionIndex || 0,
          });
        } catch (e) {
          console.error('[Ticker] countdown finish error:', e.message);
        }
        continue;
      }

      // 3. Question Active Timeout (Respects configured timeLimitSeconds) -> Lock & Reveal Results
      if (
        room.status === 'QUESTION_ACTIVE' &&
        !room.pausedAt &&
        room.questionDeadlineAt &&
        now >= room.questionDeadlineAt
      ) {
        try {
          await this.transitionState(roomCode, 'QUESTION_RESULT');
          // Allow 5 seconds for audience to view correct answer, breakdown & explanation
          room.resultEndsAt = now + 5000;
        } catch (e) {
          console.error('[Ticker] question timeout error:', e.message);
        }
        continue;
      }

      // 4. Results Display Timeout (5s) -> Auto Advance to Stage LEADERBOARD
      if (room.status === 'QUESTION_RESULT' && room.resultEndsAt && now >= room.resultEndsAt) {
        room.resultEndsAt = null;
        try {
          await this.transitionState(roomCode, 'LEADERBOARD');
          // Allow 5 seconds for audience to view live stage leaderboard standings
          room.leaderboardEndsAt = now + 5000;
        } catch (e) {
          console.error('[Ticker] auto transition to leaderboard error:', e.message);
        }
        continue;
      }

      // 5. Leaderboard Display Timeout (5s) -> Auto Advance to Next Question Countdown OR Conclude Game
      if (room.status === 'LEADERBOARD' && room.leaderboardEndsAt && now >= room.leaderboardEndsAt) {
        room.leaderboardEndsAt = null;
        const nextIndex = room.currentQuestionIndex + 1;
        try {
          if (nextIndex < room.totalQuestions) {
            room.currentQuestionIndex = nextIndex;
            await this.transitionState(roomCode, 'COUNTDOWN');
          } else {
            // All questions finished! Transition to GAME_OVER and publish final tournament scores
            await this.transitionState(roomCode, 'GAME_OVER');
          }
        } catch (e) {
          console.error('[Ticker] auto advance from leaderboard error:', e.message);
        }
        continue;
      }
    }
  }

  setScheduledStartTime(roomCode, timestamp) {
    const room = this.getRoom(roomCode);
    if (!room) throw new RoomError('Room not found', 404);
    room.scheduledStartTime = timestamp ? Number(timestamp) : null;
    this.broadcast(roomCode);
    return room;
  }

  getRoomAttendees(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room) return [];
    return Array.from(room.attendees.values()).map((a) => ({
      uniqueCode: a.uniqueCode,
      displayName: a.displayName,
      organization: a.organization,
      joinedAt: a.joinedAt,
    }));
  }

  removeAttendee(roomCode, uniqueCode) {
    const room = this.getRoom(roomCode);
    if (!room) return false;
    const cleanCode = String(uniqueCode).trim().toUpperCase();
    const deleted = room.attendees.delete(cleanCode);
    if (deleted) {
      this.broadcast(roomCode);
    }
    return deleted;
  }

  async getOrCreateRoomForGame(gameDefinitionId, options = {}) {
    const def = await db.getGameDefinition(gameDefinitionId);
    let isEnded = def?.status === 'ENDED';
    if (!isEnded) {
      try {
        const pastSessions = await db.getGameSessionsByDefinitionId(gameDefinitionId);
        if ((pastSessions || []).some((s) => s.status === 'GAME_OVER')) {
          isEnded = true;
          if (def && def.status !== 'ENDED') {
            await db.upsertGameDefinition({ ...def, status: 'ENDED' }).catch(() => {});
          }
        }
      } catch {
        // ignore
      }
    }

    if (isEnded) {
      throw new RoomError(
        `Cannot launch "${def?.title || 'Game'}": This quiz has already concluded and is marked as ENDED. Under DevFest tournament rules, replay is disabled.`,
        400,
        'GAME_ENDED'
      );
    }

    for (const room of this.rooms.values()) {
      if (
        room.gameDefinitionId === gameDefinitionId &&
        room.status !== 'GAME_OVER' &&
        room.status !== 'ARCHIVED' &&
        (!options.hallName || room.hallName === options.hallName)
      ) {
        return room;
      }
    }

    return this.createRoom({
      gameDefinitionId,
      trackTarget: options.trackTarget || 'all',
      hallName: options.hallName || 'Conference Hall',
      requirePin: Boolean(options.requirePin),
      pin: options.pin || '',
      adminId: options.adminId || 'anchor',
    });
  }

  /**
   * Transitions room state with state-machine safety checks.
   */
  async transitionState(roomCode, targetState, payload = {}, adminId = 'admin') {
    const room = this.getRoom(roomCode);
    if (!room) throw new RoomError('Room not found', 404);

    const allowed = ALLOWED_TRANSITIONS[room.status] || [];
    if (!allowed.includes(targetState)) {
      throw new RoomError(
        `Illegal transition from "${room.status}" to "${targetState}". Allowed: ${allowed.join(', ')}`,
        400,
        'ILLEGAL_TRANSITION'
      );
    }

    const now = Date.now();

    // Idempotent / re-trigger handling if already in the target state
    if (room.status === targetState) {
      if (targetState === 'COUNTDOWN') {
        room.questionStartedAt = null;
        room.questionDeadlineAt = null;
        room.countdownEndsAt = now + 3200;
        room.stateVersion += 1;
        this.broadcast(roomCode);
        return room;
      }
      if (targetState === 'QUESTION_ACTIVE') {
        const qIndex = payload.questionIndex !== undefined ? payload.questionIndex : room.currentQuestionIndex;
        room.currentQuestionIndex = qIndex;
        const currentQ = room.questions[qIndex];
        if (currentQ) {
          const durationMs = (currentQ.timeLimitSeconds || 15) * 1000;
          room.questionStartedAt = now;
          room.questionDeadlineAt = now + durationMs;
          room.pausedAt = null;
          room.remainingTimeMsAtPause = null;
          room.stateVersion += 1;
          this.broadcast(roomCode);
          return room;
        }
      }
      // Return room gracefully without error
      return room;
    }

    room.status = targetState;
    room.stateVersion += 1;

    switch (targetState) {
      case 'COUNTDOWN': {
        if (payload.questionIndex !== undefined) {
          room.currentQuestionIndex = payload.questionIndex;
        }
        room.questionStartedAt = null;
        room.questionDeadlineAt = null;
        room.countdownEndsAt = now + 3200; // 3.2s countdown
        break;
      }
      case 'QUESTION_ACTIVE': {
        const qIndex = payload.questionIndex !== undefined ? payload.questionIndex : room.currentQuestionIndex;
        room.currentQuestionIndex = qIndex;
        const currentQ = room.questions[qIndex];
        if (!currentQ) throw new RoomError(`Question at index ${qIndex} does not exist.`, 400);

        const durationMs = (currentQ.timeLimitSeconds || 15) * 1000;
        room.questionStartedAt = now;
        room.questionDeadlineAt = now + durationMs;
        room.pausedAt = null;
        room.remainingTimeMsAtPause = null;

        // Reset counts for question
        if (!room.submissionCounts[qIndex]) {
          room.submissionCounts[qIndex] = {
            total: 0,
            breakdown: { opt_1: 0, opt_2: 0, opt_3: 0, opt_4: 0 },
          };
        }
        break;
      }
      case 'QUESTION_LOCKED':
      case 'QUESTION_RESULT': {
        // Results revealed: flush all pending answers for this room immediately to database
        await this.flushAllPendingAnswersForRoom(roomCode).catch((e) => {
          console.error('[RoomOrchestrator] Flush on QUESTION_RESULT error:', e.message);
        });
        if (!room.resultEndsAt) {
          room.resultEndsAt = now + 5000;
        }
        break;
      }
      case 'LEADERBOARD': {
        // Ensure all pending answers are committed before computing leaderboard
        await this.flushAllPendingAnswersForRoom(roomCode).catch((e) => {
          console.error('[RoomOrchestrator] Flush on LEADERBOARD error:', e.message);
        });
        await this.recalculateLeaderboard(roomCode);
        if (!room.leaderboardEndsAt) {
          room.leaderboardEndsAt = now + 5000;
        }
        break;
      }
      case 'GAME_OVER': {
        room.endedAt = now;
        await this.flushAllPendingAnswersForRoom(roomCode).catch((e) => {
          console.error('[RoomOrchestrator] Flush on GAME_OVER error:', e.message);
        });
        await this.recalculateLeaderboard(roomCode);
        if (room.gameDefinitionId) {
          try {
            const def = await db.getGameDefinition(room.gameDefinitionId);
            if (def && def.status !== 'ENDED') {
              await db.upsertGameDefinition({
                ...def,
                status: 'ENDED',
                updated_at: now,
              });
            }
          } catch (e) {
            console.error('[RoomOrchestrator] Failed to mark game definition as ENDED:', e.message);
          }
        }
        break;
      }
    }

    // Persist updated session
    await db.upsertGameSession({
      id: room.id,
      room_code: room.roomCode,
      game_definition_id: room.gameDefinitionId,
      game_version_id: room.gameVersionId,
      track_target: room.trackTarget,
      status: room.status,
      state_version: room.stateVersion,
      current_question_index: room.currentQuestionIndex,
      question_started_at: room.questionStartedAt,
      question_deadline_at: room.questionDeadlineAt,
      paused_at: room.pausedAt,
      remaining_time_ms_at_pause: room.remainingTimeMsAtPause,
      started_at: room.startedAt,
      ended_at: room.endedAt,
      created_at: room.createdAt,
    });

    await db.logAuditEvent({
      id: `audit_${crypto.randomBytes(8).toString('hex')}`,
      admin_id: adminId,
      action: 'TRANSITION_STATE',
      target_id: roomCode,
      details: { targetState, questionIndex: room.currentQuestionIndex },
    });

    this.broadcast(roomCode);
    return room;
  }

  /**
   * Pauses an active question.
   */
  async pauseGame(roomCode, adminId = 'admin') {
    const room = this.getRoom(roomCode);
    if (!room || room.status !== 'QUESTION_ACTIVE') {
      throw new RoomError('Can only pause an active question.', 400);
    }

    const now = Date.now();
    const remaining = Math.max(0, (room.questionDeadlineAt || now) - now);
    room.status = 'PAUSED';
    room.pausedAt = now;
    room.pausedBy = adminId;
    room.remainingTimeMsAtPause = remaining;
    room.stateVersion += 1;

    this.broadcast(roomCode);
    return room;
  }

  /**
   * Resumes a paused question.
   */
  async resumeGame(roomCode, adminId = 'admin') {
    const room = this.getRoom(roomCode);
    if (!room || room.status !== 'PAUSED') {
      throw new RoomError('Can only resume a paused question.', 400);
    }

    const now = Date.now();
    const remaining = room.remainingTimeMsAtPause || 5000;
    room.status = 'QUESTION_ACTIVE';
    room.questionDeadlineAt = now + remaining;
    room.pausedAt = null;
    room.remainingTimeMsAtPause = null;
    room.resumedBy = adminId;
    room.stateVersion += 1;

    this.broadcast(roomCode);
    return room;
  }

  /**
   * Advances to next question or concludes game.
   */
  async advanceNext(roomCode, adminId = 'admin') {
    const room = this.getRoom(roomCode);
    if (!room) throw new RoomError('Room not found', 404);

    if (room.status === 'LOBBY') {
      room.currentQuestionIndex = 0;
      return await this.transitionState(roomCode, 'COUNTDOWN', { questionIndex: 0 }, adminId);
    }

    if (room.currentQuestionIndex + 1 < room.totalQuestions) {
      const nextIndex = room.currentQuestionIndex + 1;
      room.currentQuestionIndex = nextIndex;
      return await this.transitionState(roomCode, 'COUNTDOWN', { questionIndex: nextIndex }, adminId);
    } else {
      return await this.transitionState(roomCode, 'GAME_OVER', {}, adminId);
    }
  }

  /**
   * Authoritative Answer Submission:
   * Validates deadline, computes score, writes atomic answer record.
   */
  async submitAnswer({ roomCode, attendee, selectedOptionId, idempotencyKey }) {
    const room = this.getRoom(roomCode);
    if (!room) {
      throw new RoomError('Room not found or inactive.', 404, 'ROOM_NOT_FOUND');
    }

    // 0. Attendee must be actively connected to this room
    if (!room.attendees.has(attendee.uniqueCode)) {
      throw new RoomError('You must join this room lobby before submitting answers.', 403, 'NOT_IN_ROOM');
    }

    // 1. Must be in QUESTION_ACTIVE state
    if (room.status !== 'QUESTION_ACTIVE') {
      throw new RoomError('Submissions are closed for this question.', 400, 'QUESTION_CLOSED');
    }

    const now = Date.now();
    // 2. Server deadline check (with a generous 600ms network propagation grace allowance)
    if (room.questionDeadlineAt && now > room.questionDeadlineAt + 600) {
      throw new RoomError('Submission deadline exceeded.', 400, 'DEADLINE_EXCEEDED');
    }

    const qIndex = room.currentQuestionIndex;
    const currentQ = room.questions[qIndex];
    if (!currentQ) {
      throw new RoomError('Active question not found.', 500);
    }

    // 3. Validate selected option
    const validOption = currentQ.options.find((opt) => opt.id === selectedOptionId);
    if (!validOption) {
      throw new RoomError(`Option "${selectedOptionId}" is invalid for this question.`, 400);
    }

    // 4. Calculate score
    const isCorrect = currentQ.correctOptionId === selectedOptionId;
    const elapsedMs = Math.max(0, now - (room.questionStartedAt || now));
    const pointsAwarded = calculateScore({
      isCorrect,
      elapsedMs,
      timeLimitSeconds: currentQ.timeLimitSeconds || 15,
      pointsMultiplier: currentQ.pointsMultiplier || 1.0,
    });

    const answerRecord = {
      id: `${room.roomCode}_q${qIndex}_${attendee.id}`,
      room_code: room.roomCode,
      question_index: qIndex,
      question_id: currentQ.questionId,
      attendee_id: attendee.id,
      unique_code: attendee.uniqueCode,
      display_name: attendee.displayName,
      selected_option_id: selectedOptionId,
      is_correct: isCorrect,
      time_elapsed_ms: elapsedMs,
      points_awarded: pointsAwarded,
      server_received_at: now,
      idempotency_key: idempotencyKey || null,
    };

    // 5. In-Memory Duplicate Check (Instant < 0.01ms idempotency barrier)
    if (!room.submissionsByQuestion) room.submissionsByQuestion = {};
    if (!room.submissionsByQuestion[qIndex]) {
      room.submissionsByQuestion[qIndex] = new Map();
    }
    if (room.submissionsByQuestion[qIndex].has(attendee.uniqueCode)) {
      const error = new Error('Answer already submitted for this question');
      error.code = '23505'; // PostgreSQL unique_violation code
      error.status = 409;
      throw error;
    }

    // 6. Enqueue for asynchronous batch persistence to database
    this.pendingAnswersQueue.push(answerRecord);

    // Keep memoryStore in sync immediately for local lookups and tests
    memoryStore.saveAcceptedAnswer(answerRecord).catch(() => {});

    // 7. Update in-memory counts & live telemetry
    if (!room.submissionCounts[qIndex]) {
      room.submissionCounts[qIndex] = {
        total: 0,
        breakdown: { opt_1: 0, opt_2: 0, opt_3: 0, opt_4: 0 },
      };
    }
    const counts = room.submissionCounts[qIndex];
    counts.total += 1;
    if (counts.breakdown[selectedOptionId] !== undefined) {
      counts.breakdown[selectedOptionId] += 1;
    }

    room.submissionsByQuestion[qIndex].set(attendee.uniqueCode, {
      attendeeId: attendee.id,
      uniqueCode: attendee.uniqueCode,
      displayName: attendee.displayName,
      organization: attendee.organization,
      selectedOptionId,
      selectedOptionText: validOption.text,
      isCorrect,
      timeElapsedMs: elapsedMs,
      pointsAwarded,
      submittedAt: now,
    });

    // 8. Broadcast updated submission count with 250ms throttling (avoids flooding socket buffers)
    this.throttledBroadcast(roomCode, 250);

    return {
      ok: true,
      questionIndex: qIndex,
      pointsAwarded,
      isCorrect,
    };
  }

  /**
   * Recalculates leaderboard rankings from durable accepted answer records.
   */
  async recalculateLeaderboard(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room) return [];

    // Calculate directly from in-memory submissions cache for instantaneous 0-DB read ranking
    const scoreMap = new Map(); // attendeeId -> { displayName, uniqueCode, totalScore, correctCount, fastestTimeMs, totalTimeMs }

    const hasMemorySubmissions =
      room.submissionsByQuestion &&
      Object.keys(room.submissionsByQuestion).length > 0;

    if (hasMemorySubmissions) {
      for (const qIndex of Object.keys(room.submissionsByQuestion)) {
        const qMap = room.submissionsByQuestion[qIndex];
        if (!qMap) continue;
        for (const [uniqueCode, sub] of qMap.entries()) {
          const attendeeId = sub.attendeeId || uniqueCode;
          const existing = scoreMap.get(attendeeId) || {
            displayName: sub.displayName,
            uniqueCode: sub.uniqueCode || uniqueCode,
            totalScore: 0,
            correctCount: 0,
            totalTimeMs: 0,
            fastestTimeMs: Infinity,
          };

          existing.totalScore += (sub.pointsAwarded || 0);
          existing.totalTimeMs += (sub.timeElapsedMs || 0);
          if (sub.isCorrect) {
            existing.correctCount += 1;
            existing.fastestTimeMs = Math.min(existing.fastestTimeMs, sub.timeElapsedMs || Infinity);
          }
          scoreMap.set(attendeeId, existing);
        }
      }
    } else {
      // Fallback: Query database if server restarted or memory cache is cold
      const allAnswers = await db.getAllAcceptedAnswersForRoom(room.roomCode);
      for (const ans of allAnswers) {
        const existing = scoreMap.get(ans.attendee_id) || {
          displayName: ans.display_name,
          uniqueCode: ans.unique_code || '',
          totalScore: 0,
          correctCount: 0,
          totalTimeMs: 0,
          fastestTimeMs: Infinity,
        };

        existing.totalScore += (ans.points_awarded || 0);
        existing.totalTimeMs += (ans.time_elapsed_ms || 0);
        if (ans.is_correct) {
          existing.correctCount += 1;
          existing.fastestTimeMs = Math.min(existing.fastestTimeMs, ans.time_elapsed_ms || Infinity);
        }
        scoreMap.set(ans.attendee_id, existing);
      }
    }

    // Sort descending by total score, then by lowest total time taken (cumulative), then by fastest reaction
    const sorted = Array.from(scoreMap.entries())
      .map(([attendeeId, stat]) => ({
        attendeeId,
        displayName: stat.displayName,
        totalScore: stat.totalScore,
        correctCount: stat.correctCount,
        totalTimeMs: stat.totalTimeMs,
        fastestTimeMs: stat.fastestTimeMs === Infinity ? 0 : stat.fastestTimeMs,
      }))
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
        return a.fastestTimeMs - b.fastestTimeMs;
      });

    const ranked = sorted.map((entry, idx) => ({
      rank: idx + 1,
      ...entry,
    }));

    room.leaderboardCache = ranked;
    return ranked;
  }

  /**
   * Real-time Auditorium Telemetry:
   * Provides full visibility to Anchors into who is playing, connected,
   * what option each attendee selected, response times, and pending counts.
   */
  getRoomTelemetry(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    const qIndex = room.currentQuestionIndex;
    const currentQ = room.questions[qIndex];
    const qSubmissions = room.submissionsByQuestion?.[qIndex] || new Map();
    const counts = room.submissionCounts[qIndex] || {
      total: 0,
      breakdown: { opt_1: 0, opt_2: 0, opt_3: 0, opt_4: 0 },
    };

    const responses = Array.from(qSubmissions.values());
    const answeredCodes = new Set(responses.map((r) => r.uniqueCode));

    const pendingAttendees = Array.from(room.attendees.values())
      .filter((a) => !answeredCodes.has(a.uniqueCode))
      .map((a) => ({
        uniqueCode: a.uniqueCode,
        displayName: a.displayName,
        organization: a.organization,
        joinedAt: a.joinedAt,
      }));

    return {
      roomCode: room.roomCode,
      hallName: room.hallName || 'Conference Hall',
      gameTitle: room.gameTitle || 'DevFest Stage Quiz',
      trackTarget: room.trackTarget,
      status: room.status,
      currentQuestionIndex: qIndex,
      totalQuestions: room.totalQuestions,
      activeQuestion: currentQ
        ? {
            questionId: currentQ.questionId,
            order: currentQ.order || qIndex + 1,
            prompt: currentQ.prompt,
            options: currentQ.options,
            correctOptionId: currentQ.correctOptionId,
            explanation: currentQ.explanation,
          }
        : null,
      totalConnected: room.attendees.size,
      submissionCount: counts.total,
      pendingCount: pendingAttendees.length,
      breakdown: counts.breakdown,
      responses,
      pendingAttendees,
    };
  }

  /**
   * Compiles the public projection for client consumption.
   * Strips all private PII, ticket codes, and hidden answer keys.
   */
  getPublicProjection(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    const currentQ = room.questions[room.currentQuestionIndex];
    const isRevealed = ['QUESTION_RESULT', 'LEADERBOARD', 'GAME_OVER'].includes(room.status);
    const submissionCount = room.submissionCounts[room.currentQuestionIndex] || {
      total: 0,
      breakdown: { opt_1: 0, opt_2: 0, opt_3: 0, opt_4: 0 },
    };

    return {
      roomCode: room.roomCode,
      hallName: room.hallName || 'Conference Hall',
      gameTitle: room.gameTitle || 'DevFest Stage Quiz',
      trackTarget: room.trackTarget,
      status: room.status,
      isEnded: ['GAME_OVER', 'ARCHIVED', 'ENDED'].includes(room.status),
      requiresPin: Boolean(room.requiresPin),
      stateVersion: room.stateVersion,
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: room.totalQuestions,
      questionDeadlineAt: room.questionDeadlineAt,
      questionStartedAt: room.questionStartedAt,
      pausedAt: room.pausedAt,
      countdownEndsAt: room.countdownEndsAt || null,
      scheduledStartTime: room.scheduledStartTime || null,
      lobbyAttendees: Array.from(room.attendees.values()).slice(-30).map((a) => ({
        uniqueCode: a.uniqueCode,
        displayName: a.displayName,
        organization: a.organization,
        joinedAt: a.joinedAt,
      })),
      attendeeCount: room.attendees.size,
      submissionCount: submissionCount.total,
      // Active question (sanitized without correctOptionId during active play)
      activeQuestion: currentQ
        ? {
            ...toSafeQuestion(currentQ),
            explanation: isRevealed ? currentQ.explanation : null,
            correctOptionId: isRevealed ? currentQ.correctOptionId : null,
          }
        : null,
      // Results breakdown (only distributed during result/leaderboard states)
      resultsBreakdown: isRevealed
        ? {
            ...submissionCount.breakdown,
            correctOptionId: currentQ?.correctOptionId || null,
          }
        : null,
      // Top 10 leaderboard
      leaderboard: room.leaderboardCache.slice(0, 10).map((entry) => ({
        rank: entry.rank,
        displayName: entry.displayName,
        totalScore: entry.totalScore,
        correctCount: entry.correctCount,
      })),
    };
  }

  /**
   * Retrieves comprehensive tournament match results for an ended game definition.
   */
  async getGameResults(gameDefinitionId) {
    const game = await db.getGameDefinition(gameDefinitionId);
    if (!game) {
      throw new RoomError('Game not found.', 404);
    }

    const questions = game.questions || [];

    // 1. Look for live or concluded room in memory
    let matchedRoom = null;
    for (const r of this.rooms.values()) {
      if (r.gameDefinitionId === gameDefinitionId) {
        matchedRoom = r;
        break;
      }
    }

    if (matchedRoom) {
      const totalParticipants = matchedRoom.attendees.size;
      const questionsSummary = questions.map((q, idx) => {
        const counts = matchedRoom.submissionCounts?.[idx] || { total: 0, breakdown: {} };
        const qSubmissions = matchedRoom.submissionsByQuestion?.[idx] || new Map();
        let correctCount = 0;
        for (const sub of qSubmissions.values()) {
          if (sub.selectedOptionId === q.correctOptionId) {
            correctCount++;
          }
        }
        return {
          questionIndex: idx,
          questionId: q.questionId,
          order: q.order || idx + 1,
          prompt: q.prompt,
          codeSnippet: q.codeSnippet || null,
          options: q.options || [],
          correctOptionId: q.correctOptionId,
          explanation: q.explanation || '',
          totalAnswers: counts.total || 0,
          correctCount,
          breakdown: counts.breakdown || {},
        };
      });

      return {
        game: {
          id: game.id,
          title: game.title,
          description: game.description,
          trackTarget: game.track_target || game.trackTarget || 'all',
          status: game.status,
          totalQuestions: questions.length,
        },
        session: {
          id: matchedRoom.id,
          roomCode: matchedRoom.roomCode,
          hallName: matchedRoom.hallName || 'Conference Hall',
          status: matchedRoom.status,
          startedAt: matchedRoom.startedAt,
          endedAt: matchedRoom.endedAt || Date.now(),
          totalParticipants,
        },
        leaderboard: matchedRoom.leaderboardCache || [],
        questionsSummary,
      };
    }

    // 2. Fallback: check database persisted sessions and accepted answers
    const sessions = await db.getGameSessionsByDefinitionId(gameDefinitionId);
    const session = (sessions || []).find((s) => s.status === 'GAME_OVER') || sessions?.[0] || null;

    let leaderboard = [];
    let questionsSummary = [];
    let totalParticipants = 0;

    if (session) {
      const answers = await db.getAllAcceptedAnswersForRoom(session.room_code);
      const attendeeStats = new Map();

      for (const ans of answers) {
        let stat = attendeeStats.get(ans.attendee_id);
        if (!stat) {
          stat = {
            attendeeId: ans.attendee_id,
            displayName: ans.display_name,
            uniqueCode: ans.unique_code,
            totalScore: 0,
            correctCount: 0,
            totalTimeMs: 0,
            fastestTimeMs: Infinity,
          };
        }
        stat.totalScore += (ans.points_awarded || 0);
        stat.totalTimeMs += (ans.time_elapsed_ms || 0);
        if (ans.is_correct) {
          stat.correctCount += 1;
          stat.fastestTimeMs = Math.min(stat.fastestTimeMs, ans.time_elapsed_ms || Infinity);
        }
        attendeeStats.set(ans.attendee_id, stat);
      }

      const sorted = Array.from(attendeeStats.values()).sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
        return a.fastestTimeMs - b.fastestTimeMs;
      });

      leaderboard = sorted.map((s, idx) => ({
        rank: idx + 1,
        ...s,
        totalTimeMs: s.totalTimeMs || 0,
        fastestTimeMs: s.fastestTimeMs === Infinity ? 0 : s.fastestTimeMs,
      }));

      totalParticipants = attendeeStats.size;

      questionsSummary = questions.map((q, idx) => {
        const qAnswers = answers.filter((a) => a.question_index === idx);
        const breakdown = { opt_1: 0, opt_2: 0, opt_3: 0, opt_4: 0 };
        let correctCount = 0;
        for (const a of qAnswers) {
          if (a.selected_option_id && breakdown[a.selected_option_id] !== undefined) {
            breakdown[a.selected_option_id]++;
          }
          if (a.is_correct) correctCount++;
        }
        return {
          questionIndex: idx,
          questionId: q.questionId,
          order: q.order || idx + 1,
          prompt: q.prompt,
          codeSnippet: q.codeSnippet || null,
          options: q.options || [],
          correctOptionId: q.correctOptionId,
          explanation: q.explanation || '',
          totalAnswers: qAnswers.length,
          correctCount,
          breakdown,
        };
      });
    }

    return {
      game: {
        id: game.id,
        title: game.title,
        description: game.description,
        trackTarget: game.track_target || game.trackTarget || 'all',
        status: game.status,
        totalQuestions: questions.length,
      },
      session: session
        ? {
            id: session.id,
            roomCode: session.room_code,
            hallName: session.hall_name || 'Conference Hall',
            status: session.status,
            startedAt: session.started_at,
            endedAt: session.ended_at || session.created_at,
            totalParticipants,
          }
        : null,
      leaderboard,
      questionsSummary,
    };
  }

  /**
   * Resets an ended or existing game, wipes past sessions & accepted answers,
   * updates status to READY, and provisions a brand-new live battle room.
   */
  async restartGame(gameDefinitionId, options = {}) {
    const def = await db.getGameDefinition(gameDefinitionId);
    if (!def) {
      throw new RoomError('Game not found.', 404);
    }

    // 1. Remove active room from memory if any exists
    for (const [code, r] of this.rooms.entries()) {
      if (r.gameDefinitionId === gameDefinitionId) {
        this.rooms.delete(code);
      }
    }

    // 2. Clear previous database sessions and accepted answers
    await db.clearGameSessionsAndAnswers(gameDefinitionId);

    // 3. Reset game definition status to READY
    const updatedDef = {
      ...def,
      status: 'READY',
      updated_at: Date.now(),
    };
    await db.upsertGameDefinition(updatedDef);

    // 4. Provision fresh room in LOBBY state
    const newRoom = await this.createRoom({
      gameDefinitionId,
      trackTarget: options.trackTarget || def.track_target || def.trackTarget || 'all',
      hallName: options.hallName || 'Conference Hall',
      requirePin: Boolean(options.requirePin),
      pin: options.pin || '',
      adminId: options.adminId || 'admin',
    });

    return newRoom;
  }

  /**
   * Compiles the cumulative conference-wide tournament leaderboard across all matches.
   */
  async getOverallLeaderboard() {
    let allAnswers = [];
    try {
      allAnswers = await db.getAllAcceptedAnswers();
    } catch (e) {
      console.warn('[RoomOrchestrator] getAllAcceptedAnswers error:', e.message);
      allAnswers = [];
    }

    // CRITICAL TOURNAMENT RULE: The public /arena conference-wide leaderboard
    // only includes finalized tournament scores from matches that have completely finished (GAME_OVER / ENDED).
    // In-flight active rooms (LOBBY, COUNTDOWN, QUESTION_ACTIVE, QUESTION_RESULT, LEADERBOARD)
    // are strictly excluded until all questions conclude.
    const activeUnfinishedRoomCodes = new Set();
    for (const room of this.rooms.values()) {
      if (room.status !== 'GAME_OVER' && room.status !== 'ENDED') {
        activeUnfinishedRoomCodes.add(room.roomCode);
      }
    }

    try {
      const dbSessions = await db.getAllGameSessions();
      for (const s of (dbSessions || [])) {
        if (s.status !== 'GAME_OVER' && s.status !== 'ENDED') {
          activeUnfinishedRoomCodes.add(s.room_code);
        }
      }
    } catch {
      // ignore
    }

    // In-memory submissions only for concluded matches (GAME_OVER / ENDED)
    const memoryAnswers = [];
    for (const room of this.rooms.values()) {
      if (room.status !== 'GAME_OVER' && room.status !== 'ENDED') {
        continue;
      }
      if (!room.submissionsByQuestion) continue;
      for (const [qIdx, qMap] of Object.entries(room.submissionsByQuestion)) {
        const q = room.questions[qIdx];
        for (const sub of qMap.values()) {
          memoryAnswers.push({
            attendee_id: sub.attendeeId,
            display_name: sub.displayName,
            unique_code: sub.uniqueCode,
            room_code: room.roomCode,
            points_awarded: sub.pointsAwarded || 0,
            is_correct: sub.isCorrect ?? (q ? sub.selectedOptionId === q.correctOptionId : false),
            time_elapsed_ms: sub.timeElapsedMs || 0,
          });
        }
      }
    }

    // Filter database answers to exclude any in-flight unfinished match
    const finalizedDbAnswers = allAnswers.filter((a) => !activeUnfinishedRoomCodes.has(a.room_code));
    const combined = [...finalizedDbAnswers, ...memoryAnswers];
    const attendeeMap = new Map();

    for (const ans of combined) {
      const id = ans.attendee_id || ans.unique_code;
      if (!id) continue;

      let stat = attendeeMap.get(id);
      if (!stat) {
        stat = {
          attendeeId: id,
          displayName: ans.display_name || 'DevFest Attendee',
          uniqueCode: ans.unique_code || '',
          organization: '',
          track: '',
          totalScore: 0,
          correctCount: 0,
          totalAnswers: 0,
          totalTimeMs: 0,
          roomsPlayed: new Set(),
          fastestTimeMs: Infinity,
        };
      }

      stat.totalScore += (ans.points_awarded || 0);
      stat.totalAnswers += 1;
      stat.totalTimeMs += (ans.time_elapsed_ms || 0);
      if (ans.is_correct) {
        stat.correctCount += 1;
        if (ans.time_elapsed_ms && ans.time_elapsed_ms > 0) {
          stat.fastestTimeMs = Math.min(stat.fastestTimeMs, ans.time_elapsed_ms);
        }
      }
      if (ans.room_code) {
        stat.roomsPlayed.add(ans.room_code);
      }
      attendeeMap.set(id, stat);
    }

    // Fetch attendee profiles to enrich college/org and track
    try {
      const attendees = await db.listAttendees();
      if (attendees && attendees.length > 0) {
        for (const att of attendees) {
          const stat = attendeeMap.get(att.unique_code);
          if (stat) {
            stat.displayName = att.display_name || stat.displayName;
            stat.organization = att.organization || '';
            stat.track = att.track_ids?.[0] || 'all';
          }
        }
      }
    } catch {
      // ignore
    }

    const sorted = Array.from(attendeeMap.values()).sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
      return a.fastestTimeMs - b.fastestTimeMs;
    });

    const ranked = sorted.map((item, idx) => ({
      rank: idx + 1,
      attendeeId: item.attendeeId,
      displayName: item.displayName,
      uniqueCode: item.uniqueCode,
      organization: item.organization,
      track: item.track || 'Flagship Dev',
      totalScore: item.totalScore,
      correctCount: item.correctCount,
      totalAnswers: item.totalAnswers,
      accuracyPct: item.totalAnswers > 0 ? Math.round((item.correctCount / item.totalAnswers) * 100) : 0,
      matchesPlayed: item.roomsPlayed.size,
      totalTimeMs: item.totalTimeMs || 0,
      fastestTimeMs: item.fastestTimeMs === Infinity ? 0 : item.fastestTimeMs,
      isChampion: idx === 0,
      isPodium: idx < 3,
    }));

    return {
      standings: ranked,
      totalParticipants: ranked.length,
      topThree: ranked.slice(0, 3),
      updatedAt: Date.now(),
    };
  }

  /**
   * Closes / archives an active room and removes it from the active cache.
   */
  async closeRoom(roomCode, adminId = 'admin') {
    const code = (roomCode || '').toUpperCase().trim();
    const room = this.getRoom(code);
    if (!room) {
      // Check database to see if a session exists and archive it
      try {
        const session = await db.getGameSessionByRoomCode(code);
        if (session) {
          await db.upsertGameSession({
            ...session,
            status: 'ARCHIVED',
          }).catch(() => {});
          return { roomCode: code, message: `Room ${code} closed successfully` };
        }
      } catch {
        // ignore
      }
      return { roomCode: code, message: `Room ${code} is already closed.` };
    }

    const now = Date.now();
    room.status = 'ARCHIVED';
    room.endedAt = now;
    room.stateVersion += 1;

    // Flush any pending answers
    await this.flushAllPendingAnswersForRoom(code).catch(() => {});

    // Broadcast state to any connected clients/projectors before ending
    this.broadcast(code);

    // Close and cleanup all SSE subscriber streams for this room
    const subs = this.subscribers.get(code);
    if (subs) {
      for (const res of subs) {
        try {
          res.write(`data: ${JSON.stringify({ type: 'ROOM_CLOSED', message: 'This room has been closed by an admin.' })}\n\n`);
          res.end();
        } catch {
          // ignore
        }
      }
      this.subscribers.delete(code);
    }

    // Persist status in database session
    try {
      await db.upsertGameSession({
        id: room.id,
        room_code: room.roomCode,
        game_definition_id: room.gameDefinitionId,
        game_version_id: room.gameVersionId,
        track_target: room.trackTarget,
        status: 'ARCHIVED',
        state_version: room.stateVersion,
        current_question_index: room.currentQuestionIndex,
        created_at: room.createdAt,
      });
    } catch {
      // ignore
    }

    // Log audit event
    await db.logAuditEvent({
      id: `audit_${crypto.randomBytes(8).toString('hex')}`,
      admin_id: adminId,
      action: 'CLOSE_ROOM',
      target_id: code,
      details: { roomCode: code, gameDefinitionId: room.gameDefinitionId, gameTitle: room.gameTitle },
    }).catch(() => {});

    // Remove from in-memory active rooms map
    this.rooms.delete(code);

    return { roomCode: code, message: `Room ${code} closed successfully` };
  }
}

export const roomOrchestrator = new RoomOrchestrator();
