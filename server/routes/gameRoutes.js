import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import {
  createGame,
  updateGame,
  publishGame,
  duplicateGame,
  archiveGame,
  deleteGame,
  toSafeQuestion,
} from '../services/gameService.js';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { roomOrchestrator } from '../services/roomOrchestrator.js';

export const gameRouter = Router();

export const CURATED_DEFAULT_GAMES = [];


/**
 * GET /api/games/public
 * Lists ready/published games available for audience attendees.
 */
gameRouter.get('/public', async (req, res, next) => {
  try {
    let allGames = [];
    try {
      allGames = await db.listGameDefinitions();
    } catch {
      allGames = [];
    }

    let publicGames = allGames
      .filter(
        (g) =>
          g.status !== 'ARCHIVED' &&
          g.status !== 'ENDED' &&
          (g.questions?.length > 0 || g.totalQuestions > 0)
      )
      .map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description || '',
        category: g.category || 'Tech Challenge',
        trackTarget: g.track_target || g.trackTarget || 'all',
        totalQuestions: g.questions?.length || g.totalQuestions || 0,
        status: g.status,
        updatedAt: g.updated_at || g.created_at || Date.now(),
      }));

    res.json({
      ok: true,
      data: publicGames,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/games/public/:id/grade-all
 * Evaluates all submitted answers at quiz completion (anti-cheating: no answers revealed during active play)
 */
gameRouter.post('/public/:id/grade-all', async (req, res, next) => {
  try {
    const { submissions } = req.body;
    let game = null;
    try {
      game = await db.getGameDefinition(req.params.id);
    } catch {
      game = null;
    }
    if (!game) {
      return res.status(404).json({ error: { message: 'Game not found.' } });
    }

    const questions = game.questions || [];
    let correctCount = 0;
    let totalScore = 0;

    const breakdown = (submissions || []).map((sub) => {
      const q = questions.find((item) => item.questionId === sub.questionId);
      if (!q) {
        return {
          questionId: sub.questionId,
          selectedOptionId: sub.selectedOptionId,
          isCorrect: false,
          correctOptionId: null,
          explanation: '',
        };
      }
      const isCorrect = q.correctOptionId === sub.selectedOptionId;
      if (isCorrect) {
        correctCount += 1;
        totalScore += Math.round(100 * (q.pointsMultiplier || 1.0));
      }
      return {
        questionId: q.questionId,
        prompt: q.prompt,
        selectedOptionId: sub.selectedOptionId,
        correctOptionId: q.correctOptionId,
        isCorrect,
        explanation: q.explanation || '',
      };
    });

    res.json({
      ok: true,
      totalQuestions: questions.length,
      correctCount,
      totalScore,
      breakdown,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/public/:id
 * Retrieves sanitized game details with questions (stripped of answer keys) for user view & practice.
 */
gameRouter.get('/public/:id', async (req, res, next) => {
  try {
    let game = null;
    try {
      game = await db.getGameDefinition(req.params.id);
    } catch {
      game = null;
    }

    if (!game) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Game not found or not published.' },
      });
    }

    if (game.status === 'ENDED' || game.status === 'ARCHIVED') {
      return res.status(400).json({
        error: {
          code: 'GAME_ENDED',
          message: 'This tournament game has concluded and is no longer available to enter.',
        },
      });
    }

    res.json({
      ok: true,
      game: {
        id: game.id,
        title: game.title,
        description: game.description,
        category: game.category || 'Tech Quiz',
        trackTarget: game.trackTarget || 'all',
        questions: (game.questions || []).map(toSafeQuestion),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/games/public/:id/check-answer
 * Instant interactive feedback for solo practice mode.
 */
gameRouter.post('/public/:id/check-answer', async (req, res, next) => {
  try {
    const { questionId, selectedOptionId } = req.body;
    let game = null;
    try {
      game = await db.getGameDefinition(req.params.id);
    } catch {
      game = null;
    }

    if (!game) {
      return res.status(404).json({ error: { message: 'Game not found.' } });
    }

    const question = (game.questions || []).find((q) => q.questionId === questionId);
    if (!question) {
      return res.status(404).json({ error: { message: 'Question not found.' } });
    }

    const isCorrect = question.correctOptionId === selectedOptionId;
    res.json({
      ok: true,
      isCorrect,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation || '',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/leaderboard/summary
 * Retrieves overall conference-wide leaderboard, active rooms, and games roster.
 */
gameRouter.get('/leaderboard/summary', async (req, res, next) => {
  try {
    const [overall, allGames] = await Promise.all([
      roomOrchestrator.getOverallLeaderboard(),
      db.listGameDefinitions(),
    ]);

    const activeRooms = roomOrchestrator.listActiveRooms();

    const gamesSummary = (allGames || [])
      .filter((g) => g.status !== 'ARCHIVED')
      .map((g) => {
        let isEnded = g.status === 'ENDED';
        for (const r of roomOrchestrator.rooms.values()) {
          if (r.gameDefinitionId === g.id && r.status === 'GAME_OVER') {
            isEnded = true;
            break;
          }
        }
        return {
          id: g.id,
          title: g.title,
          description: g.description,
          category: g.category || 'Tech Challenge',
          trackTarget: g.track_target || g.trackTarget || 'all',
          totalQuestions: g.questions?.length || g.totalQuestions || 0,
          status: isEnded ? 'ENDED' : g.status,
          updatedAt: g.updated_at || g.created_at,
        };
      });

    res.json({
      ok: true,
      data: {
        overall,
        games: gamesSummary,
        activeRooms,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/:id/results
 * Publicly retrieves tournament leaderboard, battle stats, and question analytics for a game match.
 */
gameRouter.get('/:id/results', async (req, res, next) => {
  try {
    const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
    const isAdmin = Boolean(adminKey && adminKey === config.adminApiKey);
    const results = await roomOrchestrator.getGameResults(req.params.id, isAdmin);
    res.json({
      ok: true,
      data: results,
    });
  } catch (err) {
    next(err);
  }
});

// Enforce admin privileges across all management endpoints below
gameRouter.use(requireAdmin);

/**
 * GET /api/games
 * Lists all game definitions.
 */
gameRouter.get('/', async (req, res, next) => {
  try {
    const rawGames = await db.listGameDefinitions();
    // Enhance games with real-time and persisted room statuses: if any room for this game is GAME_OVER or ended, mark as ENDED
    const games = await Promise.all(
      rawGames.map(async (g) => {
        let isEnded = g.status === 'ENDED';
        let endedRoomCode = null;
        let endedAt = null;

        // 1. Check live in-memory rooms
        for (const r of roomOrchestrator.rooms.values()) {
          if (r.gameDefinitionId === g.id && r.status === 'GAME_OVER') {
            isEnded = true;
            endedRoomCode = r.roomCode;
            endedAt = r.endedAt;
            break;
          }
        }

        // 2. Check persisted database sessions if not already marked ended
        if (!isEnded) {
          try {
            const sessions = await db.getGameSessionsByDefinitionId(g.id);
            const gameOverSession = (sessions || []).find((s) => s.status === 'GAME_OVER');
            if (gameOverSession) {
              isEnded = true;
              endedRoomCode = gameOverSession.room_code;
              endedAt = gameOverSession.ended_at;

              // Synchronize definition status in DB so future queries know it's ENDED
              if (g.status !== 'ENDED') {
                try {
                  await db.upsertGameDefinition({
                    ...g,
                    status: 'ENDED',
                    updated_at: Date.now(),
                  });
                } catch (e) {
                  console.warn('[gameRoutes] failed to sync ENDED status to db:', e?.message);
                }
              }
            }
          } catch (err) {
            console.warn('[gameRoutes] error fetching sessions for game', g.id, err?.message);
          }
        }

        return {
          ...g,
          status: isEnded ? 'ENDED' : g.status,
          hasEndedSession: isEnded,
          endedRoomCode,
          endedAt,
        };
      })
    );

    res.json({
      ok: true,
      data: games,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/games/:id/restart
 * Resets an ended game, wipes previous match sessions and answers, and creates a fresh room.
 */
gameRouter.post('/:id/restart', async (req, res, next) => {
  try {
    const { hallName, requirePin, pin, trackTarget } = req.body || {};
    const newRoom = await roomOrchestrator.restartGame(req.params.id, {
      hallName: hallName || 'Conference Hall',
      requirePin: Boolean(requirePin),
      pin: pin || '',
      trackTarget: trackTarget || 'all',
      adminId: 'admin',
    });

    res.json({
      ok: true,
      message: 'Game match reset successfully. Fresh room created.',
      roomCode: newRoom.roomCode,
      room: newRoom,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/games
 * Creates a new Game Definition draft.
 */
gameRouter.post('/', async (req, res, next) => {
  try {
    const game = await createGame(req.body, req.adminId || 'admin');
    res.status(201).json({
      ok: true,
      game,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/:id
 * Retrieves a specific game definition with full questions and answer keys.
 */
gameRouter.get('/:id', async (req, res, next) => {
  try {
    const game = await db.getGameDefinition(req.params.id);
    if (!game) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Game definition "${req.params.id}" not found.` },
      });
    }
    res.json({
      ok: true,
      game,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/games/:id
 * Updates an existing game definition draft.
 */
gameRouter.put('/:id', async (req, res, next) => {
  try {
    const updated = await updateGame(req.params.id, req.body, req.adminId || 'admin');
    res.json({
      ok: true,
      game: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/games/:id/publish
 * Compiles a draft into an immutable game version snapshot.
 */
gameRouter.post('/:id/publish', async (req, res, next) => {
  try {
    const version = await publishGame(req.params.id, req.adminId || 'admin');
    res.status(201).json({
      ok: true,
      version,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/:id/versions
 * Lists published immutable versions for a game definition.
 */
gameRouter.get('/:id/versions', async (req, res, next) => {
  try {
    const versions = await db.listGameVersions(req.params.id);
    res.json({
      ok: true,
      data: versions,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/games/:id/duplicate
 * Clones a game definition for reuse.
 */
gameRouter.post('/:id/duplicate', async (req, res, next) => {
  try {
    const duplicated = await duplicateGame(req.params.id, req.adminId || 'admin');
    res.status(201).json({
      ok: true,
      game: duplicated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/games/:id
 * Archives game by default, or permanently deletes with ?permanent=true
 */
gameRouter.delete('/:id', async (req, res, next) => {
  try {
    const isPermanent = req.query.permanent === 'true';
    if (isPermanent) {
      const result = await deleteGame(req.params.id, req.adminId || 'admin');
      return res.json({
        ok: true,
        deleted: true,
        gameId: req.params.id,
        title: result.title,
      });
    }

    const archived = await archiveGame(req.params.id, req.adminId || 'admin');
    res.json({
      ok: true,
      game: archived,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/games/:id/permanent
 * Explicit endpoint for permanently removing a game and its versions from the DB
 */
gameRouter.delete('/:id/permanent', async (req, res, next) => {
  try {
    const result = await deleteGame(req.params.id, req.adminId || 'admin');
    res.json({
      ok: true,
      deleted: true,
      gameId: req.params.id,
      title: result.title,
    });
  } catch (err) {
    next(err);
  }
});
