/**
 * @file registry.js
 * @description Central Activity Manifest Registry for DevFest Ranchi 2026 Gaming Arena.
 * Activities register their metadata and lazy-loading entry points here.
 * NOTE: As per architecture specifications, this registry contains NO playable games initially.
 */

import { validateActivityManifest } from '../types/activity';

/**
 * @type {import('../types/activity').ActivityManifest[]}
 */
export const ACTIVITY_REGISTRY = [
  // Future activities will register here conforming to ActivityManifest schema.
  // Example future entry:
  // {
  //   id: 'sample-challenge',
  //   title: 'Sample Challenge',
  //   description: 'Interactive developer challenge.',
  //   track: 'flagship',
  //   status: 'draft',
  //   loadComponent: () => import('./sample-challenge'),
  // }
];

/**
 * Retrieve manifest for a specific activity ID.
 * @param {string} id
 * @returns {import('../types/activity').ActivityManifest | undefined}
 */
export function getActivityManifest(id) {
  if (!id) return undefined;
  return ACTIVITY_REGISTRY.find((activity) => activity.id === id);
}

/**
 * Retrieve all registered activities.
 * @returns {import('../types/activity').ActivityManifest[]}
 */
export function getAllRegisteredActivities() {
  return [...ACTIVITY_REGISTRY];
}

/**
 * Retrieve only active, public activities.
 * @returns {import('../types/activity').ActivityManifest[]}
 */
export function getActiveActivities() {
  return ACTIVITY_REGISTRY.filter((activity) => activity.status === 'active');
}

/**
 * Register a new activity manifest with runtime validation.
 * Used for dynamic or compile-time registration.
 * @param {import('../types/activity').ActivityManifest} manifest
 */
export function registerActivity(manifest) {
  const { valid, errors } = validateActivityManifest(manifest);
  if (!valid) {
    throw new Error(`Activity registration failed for "${manifest?.id}": ${errors.join(', ')}`);
  }

  if (ACTIVITY_REGISTRY.some((item) => item.id === manifest.id)) {
    throw new Error(`Activity ID "${manifest.id}" is already registered.`);
  }

  ACTIVITY_REGISTRY.push(manifest);
}
