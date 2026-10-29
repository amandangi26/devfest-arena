/**
 * @file leaderboardService.js
 * @description Service boundary abstraction for querying leaderboard datasets.
 *
 * ARCHITECTURAL NOTICE:
 * In Phase 1, this service returns deterministic mock data from local files.
 * In later phases, this boundary will connect to real backend endpoints via `src/services/api/client.js`
 * without requiring any UI component rewrites.
 *
 * Components (such as Podium, Leaderboard, ArenaPage) MUST query through this service
 * rather than directly importing mock arrays.
 */

import { MOCK_ACTIVITIES, TRACK_DEFINITIONS } from '../mocks/activities.mock';
import { MOCK_LEADERBOARDS } from '../mocks/leaderboard.mock';

/**
 * Fetch the list of available demo activities.
 * @returns {typeof MOCK_ACTIVITIES}
 */
export function getActivitiesCatalog() {
  return MOCK_ACTIVITIES;
}

/**
 * Fetch available track definitions.
 * @returns {typeof TRACK_DEFINITIONS}
 */
export function getTrackDefinitions() {
  return TRACK_DEFINITIONS;
}

/**
 * Retrieve metadata for a specific activity.
 * @param {string} activityId
 */
export function getActivityMetadata(activityId) {
  return MOCK_ACTIVITIES.find((a) => a.id === activityId) || MOCK_ACTIVITIES[0];
}

/**
 * Retrieve metadata for a specific track.
 * @param {string} trackId
 */
export function getTrackMetadata(trackId) {
  return TRACK_DEFINITIONS.find((t) => t.id === trackId) || TRACK_DEFINITIONS[0];
}

/**
 * Fetch leaderboard ranking dataset for a specified activity and track.
 *
 * @param {string} activityId
 * @param {string} trackId
 * @returns {{
 *   activity: object,
 *   track: object,
 *   participants: Array<object>,
 *   topThree: Array<object>,
 *   totalCount: number,
 *   isMock: boolean
 * }}
 */
export function getLeaderboard(activityId, trackId) {
  const safeActivityId = activityId || 'find-the-bulb';
  const safeTrackId = trackId || 'track-1';

  const activity = getActivityMetadata(safeActivityId);
  const track = getTrackMetadata(safeTrackId);

  const activityLeaderboards = MOCK_LEADERBOARDS[safeActivityId] || {};
  const participants = activityLeaderboards[safeTrackId] || [];

  // Derived top three for podium presentation
  const topThree = participants.slice(0, 3);

  return {
    activity,
    track,
    participants,
    topThree,
    totalCount: participants.length,
    isMock: true,
  };
}
