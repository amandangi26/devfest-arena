import { describe, it, expect } from 'vitest';
import { calculateScore, BASE_POINTS_PER_CORRECT_ANSWER } from '../../server/services/scoringService.js';

describe('100-Point Marking System', () => {
  const timeLimitSeconds = 20;

  it('awards 100 base points for correct answer', () => {
    const score = calculateScore({
      isCorrect: true,
      elapsedMs: 0,
      timeLimitSeconds,
    });
    expect(score).toBe(BASE_POINTS_PER_CORRECT_ANSWER);
    expect(score).toBe(100);
  });

  it('awards 100 points for correct answer submitted at any point during timer', () => {
    const score = calculateScore({
      isCorrect: true,
      elapsedMs: 10000,
      timeLimitSeconds,
    });
    expect(score).toBe(100);
  });

  it('awards 0 points for incorrect answers regardless of elapsed time', () => {
    const score = calculateScore({
      isCorrect: false,
      elapsedMs: 100,
      timeLimitSeconds,
    });
    expect(score).toBe(0);
  });

  it('applies points multiplier correctly (e.g. 1.5x -> 150 points, 2.0x -> 200 points)', () => {
    const score15 = calculateScore({
      isCorrect: true,
      elapsedMs: 500,
      timeLimitSeconds,
      pointsMultiplier: 1.5,
    });
    expect(score15).toBe(150);

    const score20 = calculateScore({
      isCorrect: true,
      elapsedMs: 500,
      timeLimitSeconds,
      pointsMultiplier: 2.0,
    });
    expect(score20).toBe(200);
  });

  it('handles negative or unusual elapsed times safely', () => {
    const score = calculateScore({
      isCorrect: true,
      elapsedMs: -500,
      timeLimitSeconds,
    });
    expect(score).toBe(100);
  });
});
