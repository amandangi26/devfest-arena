/**
 * @file leaderboard.mock.js
 * @description Deterministic mock rankings for the DevFest Ranchi 2026 Gaming Arena.
 *
 * ARCHITECTURAL NOTICE:
 * All entries use neutral fictional demo identities ('Demo Participant XX').
 * No real attendee data, competition claims, or live backend requests are represented.
 * Each activity-track pair maintains an independent, deterministic ranking array.
 */

export const MOCK_LEADERBOARDS = {
  // ==========================================
  // Primary Demo: Find the Bulb
  // ==========================================
  'find-the-bulb': {
    'track-1': [
      { id: 'DEMO-TB1-01', rank: 1, name: 'Demo Participant 01', score: 1280, time: '01:12', track: 'track-1', badge: 'Gold' },
      { id: 'DEMO-TB1-02', rank: 2, name: 'Demo Participant 02', score: 1220, time: '01:25', track: 'track-1', badge: 'Silver' },
      { id: 'DEMO-TB1-03', rank: 3, name: 'Demo Participant 03', score: 1190, time: '01:34', track: 'track-1', badge: 'Bronze' },
      { id: 'DEMO-TB1-04', rank: 4, name: 'Demo Participant 04', score: 1140, time: '01:46', track: 'track-1' },
      { id: 'DEMO-TB1-05', rank: 5, name: 'Demo Participant 05', score: 1090, time: '02:01', track: 'track-1' },
      { id: 'DEMO-TB1-06', rank: 6, name: 'Demo Participant 06', score: 1030, time: '02:15', track: 'track-1' },
      { id: 'DEMO-TB1-07', rank: 7, name: 'Demo Participant 07', score: 980, time: '02:30', track: 'track-1' },
      { id: 'DEMO-TB1-08', rank: 8, name: 'Demo Participant 08', score: 940, time: '02:44', track: 'track-1' },
      { id: 'DEMO-TB1-09', rank: 9, name: 'Demo Participant 09', score: 890, time: null, track: 'track-1' }, // Tests null time fallback
      { id: 'DEMO-TB1-10', rank: 10, name: 'Demo Participant 10', score: 850, time: '03:12', track: 'track-1' },
    ],
    'track-2': [
      { id: 'DEMO-TB2-01', rank: 1, name: 'Demo Participant 11', score: 1350, time: '01:05', track: 'track-2', badge: 'Gold' },
      { id: 'DEMO-TB2-02', rank: 2, name: 'Demo Participant 12', score: 1310, time: '01:18', track: 'track-2', badge: 'Silver' },
      { id: 'DEMO-TB2-03', rank: 3, name: 'Demo Participant 13', score: 1260, time: '01:29', track: 'track-2', badge: 'Bronze' },
      { id: 'DEMO-TB2-04', rank: 4, name: 'Demo Participant 14', score: 1210, time: '01:41', track: 'track-2' },
      { id: 'DEMO-TB2-05', rank: 5, name: 'Demo Participant 15', score: 1170, time: '01:58', track: 'track-2' },
      { id: 'DEMO-TB2-06', rank: 6, name: 'Demo Participant 16', score: 1120, time: '02:11', track: 'track-2' },
      { id: 'DEMO-TB2-07', rank: 7, name: 'Demo Participant 17', score: 1060, time: '02:22', track: 'track-2' },
      { id: 'DEMO-TB2-08', rank: 8, name: 'Demo Participant 18', score: 1010, time: '02:39', track: 'track-2' },
      { id: 'DEMO-TB2-09', rank: 9, name: 'Demo Participant 19', score: 960, time: '02:55', track: 'track-2' },
      { id: 'DEMO-TB2-10', rank: 10, name: 'Demo Participant 20', score: 920, time: null, track: 'track-2' },
    ],
    'track-3': [
      { id: 'DEMO-TB3-01', rank: 1, name: 'Demo Participant 21', score: 1420, time: '00:58', track: 'track-3', badge: 'Gold' },
      { id: 'DEMO-TB3-02', rank: 2, name: 'Demo Participant 22', score: 1390, time: '01:09', track: 'track-3', badge: 'Silver' },
      { id: 'DEMO-TB3-03', rank: 3, name: 'Demo Participant 23', score: 1340, time: '01:19', track: 'track-3', badge: 'Bronze' },
      { id: 'DEMO-TB3-04', rank: 4, name: 'Demo Participant 24', score: 1280, time: '01:33', track: 'track-3' },
      { id: 'DEMO-TB3-05', rank: 5, name: 'Demo Participant 25', score: 1240, time: '01:45', track: 'track-3' },
      { id: 'DEMO-TB3-06', rank: 6, name: 'Demo Participant 26', score: 1190, time: '02:02', track: 'track-3' },
      { id: 'DEMO-TB3-07', rank: 7, name: 'Demo Participant 27', score: 1130, time: '02:18', track: 'track-3' },
      { id: 'DEMO-TB3-08', rank: 8, name: 'Demo Participant 28', score: 1080, time: '02:35', track: 'track-3' },
    ],
  },

  // ==========================================
  // Preview Challenge: Ghost Signal Decoder
  // ==========================================
  'ghost-signal': {
    'track-1': [
      { id: 'DEMO-GS1-01', rank: 1, name: 'Demo Participant 29', score: 990, time: '02:14', track: 'track-1', badge: 'Gold' },
      { id: 'DEMO-GS1-02', rank: 2, name: 'Demo Participant 30', score: 940, time: '02:31', track: 'track-1', badge: 'Silver' },
      { id: 'DEMO-GS1-03', rank: 3, name: 'Demo Participant 31', score: 900, time: '02:49', track: 'track-1', badge: 'Bronze' },
      { id: 'DEMO-GS1-04', rank: 4, name: 'Demo Participant 32', score: 860, time: '03:02', track: 'track-1' },
      { id: 'DEMO-GS1-05', rank: 5, name: 'Demo Participant 33', score: 810, time: '03:22', track: 'track-1' },
    ],
    'track-2': [
      { id: 'DEMO-GS2-01', rank: 1, name: 'Demo Participant 34', score: 1040, time: '01:59', track: 'track-2', badge: 'Gold' },
      { id: 'DEMO-GS2-02', rank: 2, name: 'Demo Participant 35', score: 990, time: '02:10', track: 'track-2', badge: 'Silver' },
      { id: 'DEMO-GS2-03', rank: 3, name: 'Demo Participant 36', score: 950, time: '02:28', track: 'track-2', badge: 'Bronze' },
      { id: 'DEMO-GS2-04', rank: 4, name: 'Demo Participant 37', score: 910, time: '02:44', track: 'track-2' },
      { id: 'DEMO-GS2-05', rank: 5, name: 'Demo Participant 38', score: 870, time: '03:01', track: 'track-2' },
    ],
    'track-3': [
      { id: 'DEMO-GS3-01', rank: 1, name: 'Demo Participant 39', score: 1120, time: '01:45', track: 'track-3', badge: 'Gold' },
      { id: 'DEMO-GS3-02', rank: 2, name: 'Demo Participant 40', score: 1080, time: '01:55', track: 'track-3', badge: 'Silver' },
      { id: 'DEMO-GS3-03', rank: 3, name: 'Demo Participant 41', score: 1020, time: '02:12', track: 'track-3', badge: 'Bronze' },
      { id: 'DEMO-GS3-04', rank: 4, name: 'Demo Participant 42', score: 970, time: '02:26', track: 'track-3' },
    ],
  },

  // ==========================================
  // Preview Challenge: Human CAPTCHA Rush
  // ==========================================
  'human-captcha': {
    'track-1': [
      { id: 'DEMO-HC1-01', rank: 1, name: 'Demo Participant 43', score: 880, time: '00:44', track: 'track-1', badge: 'Gold' },
      { id: 'DEMO-HC1-02', rank: 2, name: 'Demo Participant 44', score: 840, time: '00:52', track: 'track-1', badge: 'Silver' },
      { id: 'DEMO-HC1-03', rank: 3, name: 'Demo Participant 45', score: 800, time: '01:03', track: 'track-1', badge: 'Bronze' },
      { id: 'DEMO-HC1-04', rank: 4, name: 'Demo Participant 46', score: 760, time: '01:14', track: 'track-1' },
    ],
    'track-2': [
      { id: 'DEMO-HC2-01', rank: 1, name: 'Demo Participant 47', score: 920, time: '00:39', track: 'track-2', badge: 'Gold' },
      { id: 'DEMO-HC2-02', rank: 2, name: 'Demo Participant 48', score: 870, time: '00:48', track: 'track-2', badge: 'Silver' },
      { id: 'DEMO-HC2-03', rank: 3, name: 'Demo Participant 49', score: 830, time: '00:59', track: 'track-2', badge: 'Bronze' },
    ],
    'track-3': [
      { id: 'DEMO-HC3-01', rank: 1, name: 'Demo Participant 50', score: 960, time: '00:33', track: 'track-3', badge: 'Gold' },
      { id: 'DEMO-HC3-02', rank: 2, name: 'Demo Participant 51', score: 910, time: '00:42', track: 'track-3', badge: 'Silver' },
      { id: 'DEMO-HC3-03', rank: 3, name: 'Demo Participant 52', score: 860, time: '00:51', track: 'track-3', badge: 'Bronze' },
    ],
  },

  // ==========================================
  // Preview Challenge: Binary Blitz
  // ==========================================
  'binary-blitz': {
    'track-1': [
      { id: 'DEMO-BB1-01', rank: 1, name: 'Demo Participant 53', score: 1540, time: '01:10', track: 'track-1', badge: 'Gold' },
      { id: 'DEMO-BB1-02', rank: 2, name: 'Demo Participant 54', score: 1480, time: '01:21', track: 'track-1', badge: 'Silver' },
      { id: 'DEMO-BB1-03', rank: 3, name: 'Demo Participant 55', score: 1420, time: '01:35', track: 'track-1', badge: 'Bronze' },
    ],
    'track-2': [
      { id: 'DEMO-BB2-01', rank: 1, name: 'Demo Participant 56', score: 1610, time: '00:59', track: 'track-2', badge: 'Gold' },
      { id: 'DEMO-BB2-02', rank: 2, name: 'Demo Participant 57', score: 1560, time: '01:14', track: 'track-2', badge: 'Silver' },
      { id: 'DEMO-BB2-03', rank: 3, name: 'Demo Participant 58', score: 1490, time: '01:28', track: 'track-2', badge: 'Bronze' },
    ],
    'track-3': [
      { id: 'DEMO-BB3-01', rank: 1, name: 'Demo Participant 59', score: 1680, time: '00:51', track: 'track-3', badge: 'Gold' },
      { id: 'DEMO-BB3-02', rank: 2, name: 'Demo Participant 60', score: 1620, time: '01:03', track: 'track-3', badge: 'Silver' },
      { id: 'DEMO-BB3-03', rank: 3, name: 'Demo Participant 61', score: 1550, time: '01:18', track: 'track-3', badge: 'Bronze' },
    ],
  },
};
