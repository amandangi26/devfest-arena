/**
 * @file client.js
 * @description Lightweight API HTTP client interface for DevFest Gaming Arena.
 * Pure native fetch wrapper with zero external dependencies.
 * Backend communication is currently deferred — this serves as the architectural interface.
 */

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api';

/**
 * Standard HTTP request wrapper with centralized error handling and headers.
 *
 * @param {string} endpoint - API path (e.g., '/leaderboard')
 * @param {RequestInit} [options] - Standard Fetch options
 * @returns {Promise<any>}
 */
export async function apiClient(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const storedAdminKey =
    typeof window !== 'undefined'
      ? localStorage.getItem('dfr26_admin_key') || sessionStorage.getItem('dfr26_admin_key')
      : null;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(storedAdminKey ? { 'x-admin-key': storedAdminKey } : {}),
  };

  const config = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || errorData.message || `HTTP error: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return response.json();
}
