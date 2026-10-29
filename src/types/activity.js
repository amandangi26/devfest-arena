/**
 * @file activity.js
 * @description Standard Activity Contract Specification for DevFest Ranchi 2026 Gaming Arena.
 * Every independent activity must conform to this schema when registered with the arena manifest.
 */

/**
 * Activity Status enumeration.
 * @readonly
 * @enum {string}
 */
export const ActivityStatus = {
  ACTIVE: 'active',     // Live and accessible to participants
  DRAFT: 'draft',       // In development, restricted from general public
  DISABLED: 'disabled', // Temporarily disabled by event admins
};

/**
 * DevFest Tracks enumeration.
 * @readonly
 * @enum {string}
 */
export const DevFestTrack = {
  FLAGSHIP: 'flagship',   // Full-Stack & Cloud Architecture
  BEGINNER: 'beginner',   // Code Labs & Foundations
  KEYNOTE: 'keynote',     // Conference & AI Innovations
  BOOTH: 'booth',         // MicroBooths & Hardware
  GENERAL: 'general',     // Cross-track / Open Carnival
};

/**
 * @typedef {Object} LeaderboardConfig
 * @property {boolean} enabled - Whether activity reports to the global leaderboard
 * @property {'highest' | 'lowest' | 'fastest'} scoreType - How rankings are determined
 * @property {string} unit - Display unit for scores (e.g., 'pts', 'ms', 'stars')
 */

/**
 * @typedef {Object} ActivityManifest
 * @property {string} id - Unique kebab-case identifier (e.g., 'ghost-signal')
 * @property {string} title - Human-readable display title (e.g., 'Ghost Signal')
 * @property {string} description - Brief summary of challenge mechanics
 * @property {DevFestTrack} track - Conference track category
 * @property {ActivityStatus} status - Current availability status
 * @property {() => Promise<{ default: import('react').ComponentType<any> }>} loadComponent - Dynamic import factory for lazy loading
 * @property {LeaderboardConfig} [leaderboard] - Optional leaderboard configuration
 * @property {string} [author] - Lead developer or maintainer name/team
 * @property {string} [estimatedDuration] - Estimated time to play (e.g., '5 mins')
 */

/**
 * Type guard / validator to verify an activity definition conforms to the contract.
 * @param {any} manifest
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateActivityManifest(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null object.'] };
  }

  if (!manifest.id || typeof manifest.id !== 'string' || !/^[a-z0-9-]+$/.test(manifest.id)) {
    errors.push('Activity "id" is required and must be lowercase alphanumeric with hyphens (kebab-case).');
  }

  if (!manifest.title || typeof manifest.title !== 'string') {
    errors.push('Activity "title" is required and must be a string.');
  }

  if (!manifest.description || typeof manifest.description !== 'string') {
    errors.push('Activity "description" is required and must be a string.');
  }

  if (!manifest.status || !Object.values(ActivityStatus).includes(manifest.status)) {
    errors.push(`Activity "status" must be one of: ${Object.values(ActivityStatus).join(', ')}.`);
  }

  if (typeof manifest.loadComponent !== 'function') {
    errors.push('Activity "loadComponent" must be a function returning a dynamic import promise.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
