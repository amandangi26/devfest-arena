/**
 * @file connection.js
 * @description Realtime connection interface contract for future leaderboard updates.
 * Provides pub/sub event registration without opening real network sockets at this stage.
 */

/**
 * Realtime Event Types enumeration.
 * @readonly
 * @enum {string}
 */
export const RealtimeEvents = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  SCORE_UPDATE: 'score:update',
  LEADERBOARD_REFRESH: 'leaderboard:refresh',
  ACTIVITY_STATUS_CHANGE: 'activity:status',
};

/**
 * Lightweight in-memory event emitter providing the architectural contract for future WebSockets/SSE.
 */
class RealtimeConnectionManager {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
    this.isConnected = false;
  }

  /**
   * Subscribe to a realtime topic.
   * @param {string} event
   * @param {(data: any) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Dispatch an incoming event to registered subscribers.
   * @param {string} event
   * @param {any} payload
   */
  emit(event, payload) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in realtime subscriber for event "${event}":`, err);
        }
      });
    }
  }

  /**
   * Stub connection lifecycle methods.
   */
  connect() {
    // Realtime transport deferred until backend infrastructure is ready
    this.isConnected = false;
  }

  disconnect() {
    this.isConnected = false;
  }
}

export const realtimeManager = new RealtimeConnectionManager();
