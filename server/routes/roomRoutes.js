import { Router } from 'express';
import { z } from 'zod';
import { roomOrchestrator } from '../services/roomOrchestrator.js';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';

export const roomRouter = Router();

const createRoomSchema = z.object({
  gameDefinitionId: z.string().trim().min(1, 'gameDefinitionId is required'),
  gameVersionId: z.string().trim().optional(),
  trackTarget: z.string().trim().default('all'),
  hallName: z.string().trim().default('Conference Hall'),
  requirePin: z.boolean().optional().default(false),
  pin: z.string().trim().max(10).optional().or(z.literal('')),
});

const submitAnswerSchema = z.object({
  selectedOptionId: z.string().trim().min(1, 'selectedOptionId is required').max(50),
  idempotencyKey: z.string().trim().max(100).optional(),
});

const transitionRoomSchema = z.object({
  targetState: z.string().trim().min(1, 'targetState is required'),
  questionIndex: z.number().int().min(0).optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

const scheduleRoomSchema = z.object({
  scheduledStartTime: z.number().positive().nullable(),
});

/**
 * GET /api/rooms/public
 * Public list of active live rooms for Arena & Spectators.
 */
roomRouter.get('/public', (req, res) => {
  const rooms = roomOrchestrator.listActiveRooms();
  res.json({ ok: true, data: rooms });
});

/**
 * GET /api/rooms/:code/state
 * Public read-only projection of current room state.
 */
roomRouter.get('/:code/state', async (req, res, next) => {
  try {
    const code = req.params.code?.toUpperCase().trim();
    const projection = roomOrchestrator.getPublicProjection(code);
    if (!projection) {
      // Check database to see if this was a completed match
      try {
        const session = await db.getGameSessionByRoomCode(code);
        if (session && (session.status === 'GAME_OVER' || session.status === 'ENDED') && session.status !== 'ARCHIVED') {
          return res.json({
            ok: true,
            state: {
              roomCode: code,
              status: 'GAME_OVER',
              isEnded: true,
              gameTitle: 'Concluded Match',
              message: 'This battle has already concluded and is marked as ended.',
            },
          });
        }
      } catch {
        // ignore
      }
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Room "${code}" not found or has been closed.` },
      });
    }
    res.json({ ok: true, state: projection });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:code/stream
 * Server-Sent Events (SSE) real-time state stream for Mobile Players and Stage Displays.
 */
roomRouter.get('/:code/stream', (req, res) => {
  const roomCode = req.params.code?.toUpperCase().trim();
  const room = roomOrchestrator.getRoom(roomCode);

  if (!room) {
    return res.status(404).json({ error: { message: `Room "${roomCode}" not found.` } });
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const unsubscribe = roomOrchestrator.subscribe(roomCode, res);

  req.on('close', () => {
    unsubscribe();
  });
});

/**
 * POST /api/rooms/:code/join
 * Authenticated attendee joins the room lobby.
 */
roomRouter.post('/:code/join', requireAuth, async (req, res, next) => {
  try {
    const { pin } = req.body || {};
    const result = await roomOrchestrator.joinRoom(req.params.code, req.user, pin);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/:code/leave
 * Authenticated attendee leaves the room lobby.
 */
roomRouter.post('/:code/leave', requireAuth, (req, res) => {
  const removed = roomOrchestrator.removeAttendee(req.params.code, req.user.uniqueCode);
  res.json({ ok: true, removed });
});

/**
 * POST /api/rooms/:code/submit-answer
 * Authoritative, idempotent answer submission endpoint.
 */
roomRouter.post('/:code/submit-answer', requireAuth, async (req, res, next) => {
  try {
    const parseResult = submitAnswerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'selectedOptionId is required.',
          details: parseResult.error.format(),
        },
      });
    }

    const { selectedOptionId, idempotencyKey } = parseResult.data;
    const result = await roomOrchestrator.submitAnswer({
      roomCode: req.params.code,
      attendee: req.user,
      selectedOptionId,
      idempotencyKey,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// ADMIN OPERATIONS (requireAdmin)
// ==============================================================================

/**
 * POST /api/rooms
 * Creates a new live room from a game version.
 */
roomRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    const parseResult = createRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'gameDefinitionId is required.',
          details: parseResult.error.format(),
        },
      });
    }

    const room = await roomOrchestrator.createRoom({
      ...parseResult.data,
      adminId: req.adminId || 'admin',
    });

    res.status(201).json({
      ok: true,
      roomCode: room.roomCode,
      room,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms
 * Lists all active rooms.
 */
roomRouter.get('/', requireAdmin, (req, res) => {
  const rooms = roomOrchestrator.listActiveRooms();
  res.json({ ok: true, data: rooms });
});

/**
 * POST /api/rooms/:code/transition
 * Advances room state machine with strict Zod state validation.
 */
roomRouter.post('/:code/transition', requireAdmin, async (req, res, next) => {
  try {
    const parseResult = transitionRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'targetState is required.',
          details: parseResult.error.format(),
        },
      });
    }

    const { targetState, questionIndex, payload } = parseResult.data;
    const qIndex = questionIndex !== undefined ? questionIndex : payload?.questionIndex;

    const updated = await roomOrchestrator.transitionState(
      req.params.code,
      targetState,
      { questionIndex: qIndex },
      req.adminId || 'admin'
    );

    res.json({ ok: true, room: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/:code/pause
 */
roomRouter.post('/:code/pause', requireAdmin, async (req, res, next) => {
  try {
    const updated = await roomOrchestrator.pauseGame(req.params.code, req.adminId || 'admin');
    res.json({ ok: true, room: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/:code/resume
 */
roomRouter.post('/:code/resume', requireAdmin, async (req, res, next) => {
  try {
    const updated = await roomOrchestrator.resumeGame(req.params.code, req.adminId || 'admin');
    res.json({ ok: true, room: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/:code/advance
 */
roomRouter.post('/:code/advance', requireAdmin, async (req, res, next) => {
  try {
    await roomOrchestrator.advanceNext(req.params.code, req.adminId || 'admin');
    const projection = roomOrchestrator.getPublicProjection(req.params.code);
    res.json({ ok: true, state: projection });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/get-or-create
 * Retrieves an active lobby room for a game, or initializes one.
 */
roomRouter.post('/get-or-create', async (req, res, next) => {
  try {
    const { gameDefinitionId, requirePin, pin, trackTarget, hallName } = req.body;
    if (!gameDefinitionId) {
      return res.status(400).json({ error: { message: 'gameDefinitionId is required' } });
    }
    const room = await roomOrchestrator.getOrCreateRoomForGame(gameDefinitionId, {
      requirePin,
      pin,
      trackTarget,
      hallName: hallName || 'Conference Hall',
      adminId: 'anchor',
    });
    res.json({ ok: true, roomCode: room.roomCode, room });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/:code/schedule
 * Anchors set or cancel auto-start scheduled time with timestamp validation.
 */
roomRouter.post('/:code/schedule', requireAdmin, async (req, res, next) => {
  try {
    const parseResult = scheduleRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'scheduledStartTime must be a valid epoch timestamp or null.',
          details: parseResult.error.format(),
        },
      });
    }

    const { scheduledStartTime } = parseResult.data;
    const room = roomOrchestrator.setScheduledStartTime(req.params.code, scheduledStartTime);
    res.json({ ok: true, room });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:code/attendees
 * Anchors fetch real-time list of members currently joined in the lobby.
 */
roomRouter.get('/:code/attendees', requireAdmin, (req, res) => {
  const attendees = roomOrchestrator.getRoomAttendees(req.params.code);
  res.json({ ok: true, data: attendees, count: attendees.length });
});

/**
 * DELETE /api/rooms/:code/attendees/:uniqueCode
 * Admin/Host removes or kicks an attendee from the lobby.
 */
roomRouter.delete('/:code/attendees/:uniqueCode', requireAdmin, (req, res) => {
  const removed = roomOrchestrator.removeAttendee(req.params.code, req.params.uniqueCode);
  res.json({ ok: true, removed });
});

/**
 * GET /api/rooms/:code/telemetry
 * Real-time auditorium telemetry for stage anchors:
 * shows full details of who is connected, who answered, and what option each attendee selected.
 */
roomRouter.get('/:code/telemetry', requireAdmin, (req, res, next) => {
  try {
    const telemetry = roomOrchestrator.getRoomTelemetry(req.params.code);
    if (!telemetry) {
      return res.status(404).json({ error: { message: `Room "${req.params.code}" not found.` } });
    }
    res.json({ ok: true, data: telemetry });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/rooms/:code
 * Admin closes or discards an active room / lobby.
 */
roomRouter.delete('/:code', requireAdmin, async (req, res, next) => {
  try {
    const roomCode = req.params.code?.toUpperCase().trim();
    const result = await roomOrchestrator.closeRoom(roomCode, req.adminId || 'admin');
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});
