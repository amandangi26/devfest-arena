import { useState, useMemo, useCallback } from 'react';
import {
  getActivitiesCatalog,
  getTrackDefinitions,
  getLeaderboard,
} from '../services/leaderboardService';

/**
 * Custom hook to manage the Arena Leaderboard dashboard state.
 * Encapsulates activity and track selection, sidebar collapse state,
 * and data fetching via the leaderboardService.
 */
export function useLeaderboard(initialActivityId = 'find-the-bulb', initialTrackId = 'track-1') {
  const [selectedActivityId, setSelectedActivityId] = useState(initialActivityId);
  const [selectedTrackId, setSelectedTrackId] = useState(initialTrackId);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Cached catalog lists
  const activities = useMemo(() => getActivitiesCatalog(), []);
  const tracks = useMemo(() => getTrackDefinitions(), []);

  // Synchronously compute current leaderboard dataset from service
  const currentLeaderboard = useMemo(() => {
    return getLeaderboard(selectedActivityId, selectedTrackId);
  }, [selectedActivityId, selectedTrackId]);

  const selectActivity = useCallback((activityId) => {
    setSelectedActivityId(activityId);
  }, []);

  const selectTrack = useCallback((trackId) => {
    setSelectedTrackId(trackId);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const setSidebarCollapsed = useCallback((collapsed) => {
    setIsSidebarCollapsed(Boolean(collapsed));
  }, []);

  return {
    // Current selections
    selectedActivityId,
    selectedTrackId,
    isSidebarCollapsed,

    // Catalogs & Definitions
    activities,
    tracks,

    // Active Leaderboard Data
    activity: currentLeaderboard.activity,
    track: currentLeaderboard.track,
    participants: currentLeaderboard.participants,
    topThree: currentLeaderboard.topThree,
    totalCount: currentLeaderboard.totalCount,
    isMock: currentLeaderboard.isMock,

    // Actions
    selectActivity,
    selectTrack,
    toggleSidebar,
    setSidebarCollapsed,
  };
}
