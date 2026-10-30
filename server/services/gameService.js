import crypto from 'crypto';
import { db } from '../db/index.js';
import { createGameDefinitionSchema, updateGameDefinitionSchema } from '../schemas/gameSchemas.js';

export class GameValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GameValidationError';
    this.status = 400;
  }
}

/**
 * Sanitizes a question object for audience / participant devices.
 * CRITICAL SECURITY BOUNDARY: Never exposes correctOptionId or hidden explanations during active quiz play.
 */
export function toSafeQuestion(question) {
  if (!question) return null;
  return {
    questionId: question.questionId,
    order: question.order,
    prompt: question.prompt,
    codeSnippet: question.codeSnippet || null,
    mediaUrl: question.mediaUrl || null,
    icon: question.icon || 'HelpCircle',
    options: (question.options || []).map((opt) => ({
      id: opt.id,
      text: opt.text,
      mediaUrl: opt.mediaUrl || null,
    })),
    timeLimitSeconds: question.timeLimitSeconds || 15,
    pointsMultiplier: question.pointsMultiplier || 1.0,
  };
}

/**
 * Sanitizes an entire published game version for client distribution.
 */
export function toSafeVersion(gameVersion) {
  if (!gameVersion) return null;
  return {
    id: gameVersion.id,
    gameDefinitionId: gameVersion.game_definition_id,
    versionNumber: gameVersion.version_number,
    totalQuestions: gameVersion.total_questions,
    questions: (gameVersion.questions || []).map(toSafeQuestion),
    publishedAt: gameVersion.published_at,
  };
}

/**
 * Creates a new Game Definition draft.
 */
export async function createGame(input, adminId = 'admin') {
  const parseResult = createGameDefinitionSchema.safeParse(input);
  if (!parseResult.success) {
    throw new GameValidationError(
      `Validation error: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
    );
  }

  const data = parseResult.data;
  const now = Date.now();
  const gameId = `game_${crypto.randomBytes(6).toString('hex')}`;

  // Ensure questions have valid sequential ordering
  const questions = (data.questions || []).map((q, idx) => ({
    ...q,
    order: idx + 1,
    questionId: q.questionId || `q_${idx + 1}`,
  }));

  const gameDefinition = {
    id: gameId,
    title: data.title.trim(),
    description: data.description?.trim() || '',
    game_type: data.gameType || 'SYNCHRONIZED_MCQ',
    track_target: data.trackTarget || 'all',
    hall_name: data.hallName || 'Conference Hall',
    hallName: data.hallName || 'Conference Hall',
    status: 'DRAFT',
    questions,
    created_at: now,
    updated_at: now,
  };

  await db.upsertGameDefinition(gameDefinition);

  await db.logAuditEvent({
    id: `audit_${crypto.randomBytes(8).toString('hex')}`,
    admin_id: adminId,
    action: 'CREATE_GAME_DRAFT',
    target_id: gameId,
    details: { title: gameDefinition.title, trackTarget: gameDefinition.track_target },
  });

  return gameDefinition;
}

/**
 * Updates an existing Game Definition draft.
 */
export async function updateGame(id, input, adminId = 'admin') {
  const existing = await db.getGameDefinition(id);
  if (!existing) {
    const error = new Error(`Game definition not found: ${id}`);
    error.status = 404;
    throw error;
  }

  if (existing.status === 'ARCHIVED') {
    throw new GameValidationError('Cannot modify an archived game definition.');
  }

  const parseResult = updateGameDefinitionSchema.safeParse(input);
  if (!parseResult.success) {
    throw new GameValidationError(
      `Validation error: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
    );
  }

  const updates = parseResult.data;
  const now = Date.now();

  let questions = existing.questions || [];
  if (updates.questions !== undefined) {
    questions = updates.questions.map((q, idx) => ({
      ...q,
      order: idx + 1,
      questionId: q.questionId || `q_${idx + 1}`,
    }));
  }

  const updatedGame = {
    ...existing,
    title: updates.title !== undefined ? updates.title.trim() : existing.title,
    description: updates.description !== undefined ? updates.description.trim() : existing.description,
    track_target: updates.trackTarget !== undefined ? updates.trackTarget : existing.track_target,
    hall_name: updates.hallName !== undefined ? updates.hallName : (existing.hall_name || existing.hallName || 'Conference Hall'),
    hallName: updates.hallName !== undefined ? updates.hallName : (existing.hall_name || existing.hallName || 'Conference Hall'),
    questions,
    updated_at: now,
  };

  await db.upsertGameDefinition(updatedGame);

  await db.logAuditEvent({
    id: `audit_${crypto.randomBytes(8).toString('hex')}`,
    admin_id: adminId,
    action: 'UPDATE_GAME_DRAFT',
    target_id: id,
    details: { questionCount: questions.length },
  });

  return updatedGame;
}

/**
 * Publishes a game definition into an immutable game version snapshot.
 */
export async function publishGame(id, adminId = 'admin') {
  const game = await db.getGameDefinition(id);
  if (!game) {
    const error = new Error(`Game definition not found: ${id}`);
    error.status = 404;
    throw error;
  }

  const questions = game.questions || [];
  if (questions.length === 0) {
    throw new GameValidationError('Cannot publish a game with 0 questions.');
  }

  if (questions.length > 15) {
    throw new GameValidationError('Maximum question limit exceeded (max 15).');
  }

  // Validate that all questions have valid options and a correctOptionId
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.options || q.options.length !== 4) {
      throw new GameValidationError(`Question #${i + 1} ("${q.prompt}") must have exactly 4 options.`);
    }
    const hasCorrect = q.options.some((opt) => opt.id === q.correctOptionId);
    if (!hasCorrect) {
      throw new GameValidationError(
        `Question #${i + 1} has an invalid or unset correctOptionId: "${q.correctOptionId}".`
      );
    }
  }

  // Determine sequential version number
  const existingVersions = await db.listGameVersions(id);
  const versionNumber = existingVersions.length + 1;
  const now = Date.now();

  const gameVersion = {
    id: `ver_${id}_v${versionNumber}`,
    game_definition_id: id,
    version_number: versionNumber,
    total_questions: questions.length,
    questions: JSON.parse(JSON.stringify(questions)), // Deep copy snapshot
    published_by: adminId,
    published_at: now,
  };

  // 1. Ensure game definition exists in DB and is marked as READY before inserting version snapshot
  await db.upsertGameDefinition({
    ...game,
    status: 'READY',
    updated_at: now,
  });

  // 2. Insert immutable version snapshot (guarantees parent row exists in Supabase to avoid FK violation)
  await db.createGameVersion(gameVersion);

  await db.logAuditEvent({
    id: `audit_${crypto.randomBytes(8).toString('hex')}`,
    admin_id: adminId,
    action: 'PUBLISH_GAME_VERSION',
    target_id: gameVersion.id,
    details: { versionNumber, questionCount: questions.length },
  });

  return gameVersion;
}

/**
 * Duplicates a game definition for reuse.
 */
export async function duplicateGame(id, adminId = 'admin') {
  const original = await db.getGameDefinition(id);
  if (!original) {
    const error = new Error(`Game definition not found: ${id}`);
    error.status = 404;
    throw error;
  }

  const cloneInput = {
    title: `${original.title} (Copy)`,
    description: original.description,
    gameType: original.game_type,
    trackTarget: original.track_target,
    hallName: original.hall_name || original.hallName || 'Conference Hall',
    questions: original.questions || [],
  };

  return createGame(cloneInput, adminId);
}

/**
 * Archives a game definition.
 */
export async function archiveGame(id, adminId = 'admin') {
  const game = await db.getGameDefinition(id);
  if (!game) {
    const error = new Error(`Game definition not found: ${id}`);
    error.status = 404;
    throw error;
  }

  const updated = {
    ...game,
    status: 'ARCHIVED',
    updated_at: Date.now(),
  };

  await db.upsertGameDefinition(updated);

  await db.logAuditEvent({
    id: `audit_${crypto.randomBytes(8).toString('hex')}`,
    admin_id: adminId,
    action: 'ARCHIVE_GAME',
    target_id: id,
    details: {},
  });

  return updated;
}

/**
 * Permanently deletes a game definition and associated versions from the database.
 */
export async function deleteGame(id, adminId = 'admin') {
  const game = await db.getGameDefinition(id);
  if (!game) {
    const error = new Error(`Game definition not found: ${id}`);
    error.status = 404;
    throw error;
  }

  const success = await db.deleteGameDefinition(id);
  if (!success) {
    const error = new Error(`Failed to delete game definition: ${id}`);
    error.status = 500;
    throw error;
  }

  await db.logAuditEvent({
    id: `audit_${crypto.randomBytes(8).toString('hex')}`,
    admin_id: adminId,
    action: 'DELETE_GAME',
    target_id: id,
    details: { title: game.title },
  });

  return { id, deleted: true, title: game.title };
}

