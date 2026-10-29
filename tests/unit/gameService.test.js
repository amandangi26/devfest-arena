import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGame,
  updateGame,
  publishGame,
  duplicateGame,
  archiveGame,
  toSafeQuestion,
  toSafeVersion,
} from '../../server/services/gameService.js';
import { generateRoomCode, isValidRoomCode } from '../../server/lib/roomCode.js';
import { db } from '../../server/db/index.js';

describe('Game Builder & Versioning Service', () => {
  beforeEach(() => {
    db.resetMemoryStore();
  });

  const validQuestion = {
    questionId: 'q-1',
    order: 1,
    prompt: 'What Google Cloud service provides serverless containers with automated scaling?',
    codeSnippet: 'gcloud run deploy my-service --image gcr.io/demo/app',
    mediaUrl: 'https://devfest.ranchi/diagrams/cloud-run.png',
    icon: 'Cloud',
    options: [
      { id: 'opt_1', text: 'Compute Engine' },
      { id: 'opt_2', text: 'Cloud Run' },
      { id: 'opt_3', text: 'Cloud Functions' },
      { id: 'opt_4', text: 'GKE Standard' },
    ],
    correctOptionId: 'opt_2',
    timeLimitSeconds: 15,
    pointsMultiplier: 1.0,
    explanation: 'Cloud Run is fully managed and scales containers down to zero.',
  };

  describe('Security Boundary: toSafeQuestion & toSafeVersion', () => {
    it('strictly withholds correctOptionId and explanation from safe payloads', () => {
      const safe = toSafeQuestion(validQuestion);

      expect(safe.correctOptionId).toBeUndefined();
      expect(safe.explanation).toBeUndefined();
      expect(safe.prompt).toBe(validQuestion.prompt);
      expect(safe.options).toHaveLength(4);
      expect(safe.options[1].id).toBe('opt_2');
      expect(safe.options[1].text).toBe('Cloud Run');
    });

    it('sanitizes all questions across a published game version', () => {
      const rawVersion = {
        id: 'ver_game_1_v1',
        game_definition_id: 'game_1',
        version_number: 1,
        total_questions: 1,
        questions: [validQuestion],
        published_at: Date.now(),
      };

      const safeVer = toSafeVersion(rawVersion);
      expect(safeVer.questions[0].correctOptionId).toBeUndefined();
      expect(safeVer.questions[0].explanation).toBeUndefined();
    });
  });

  describe('Game Lifecycle: Create, Update, Publish, Duplicate, Archive', () => {
    it('creates a new draft and publishes an immutable version', async () => {
      // 1. Create draft
      const draft = await createGame({
        title: 'Cloud & AI Stage Battle',
        description: 'Auditorium MCQ test',
        trackTarget: 'flagship-dev',
        questions: [validQuestion],
      });

      expect(draft.id).toBeDefined();
      expect(draft.status).toBe('DRAFT');
      expect(draft.questions).toHaveLength(1);

      // 2. Publish version 1
      const v1 = await publishGame(draft.id, 'admin_operator');
      expect(v1.version_number).toBe(1);
      expect(v1.total_questions).toBe(1);

      // 3. Mutating the draft does NOT mutate the published version
      await updateGame(draft.id, {
        title: 'Mutated Title',
        questions: [
          validQuestion,
          {
            ...validQuestion,
            questionId: 'q-2',
            order: 2,
            prompt: 'Second Question Prompt?',
          },
        ],
      });

      const fetchedV1 = await db.getGameVersion(v1.id);
      expect(fetchedV1.total_questions).toBe(1); // Unaffected snapshot

      // 4. Publishing again yields version 2
      const v2 = await publishGame(draft.id, 'admin_operator');
      expect(v2.version_number).toBe(2);
      expect(v2.total_questions).toBe(2);
    });

    it('rejects publishing a game with zero questions', async () => {
      const draft = await createGame({
        title: 'Empty Quiz',
        questions: [],
      });

      await expect(publishGame(draft.id)).rejects.toThrow('Cannot publish a game with 0 questions');
    });

    it('rejects questions with invalid option count (must be exactly 4)', async () => {
      await expect(
        createGame({
          title: 'Invalid Quiz',
          questions: [
            {
              ...validQuestion,
              options: [
                { id: 'opt_1', text: 'Option A' },
                { id: 'opt_2', text: 'Option B' },
              ],
            },
          ],
        })
      ).rejects.toThrow('exactly 4 choices');
    });

    it('duplicates and archives games cleanly', async () => {
      const draft = await createGame({
        title: 'DevFest Original',
        questions: [validQuestion],
      });

      const clone = await duplicateGame(draft.id);
      expect(clone.title).toBe('DevFest Original (Copy)');
      expect(clone.status).toBe('DRAFT');

      const archived = await archiveGame(draft.id);
      expect(archived.status).toBe('ARCHIVED');
    });
  });

  describe('Room Code Generation', () => {
    it('generates 6-character valid PINs without visually ambiguous letters', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateRoomCode();
        expect(code).toHaveLength(6);
        expect(isValidRoomCode(code)).toBe(true);
        expect(code).not.toMatch(/[01OI]/);
      }
    });
  });
});
