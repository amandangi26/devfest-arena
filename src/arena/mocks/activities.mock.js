/**
 * @file activities.mock.js
 * @description Mock Activity Catalog for the DevFest Ranchi 2026 Gaming Arena UI.
 *
 * ARCHITECTURAL NOTICE:
 * This mock catalog is strictly for Arena leaderboard UI demonstration and layout testing.
 * It is completely decoupled from `src/activities/registry.js` (which holds real, registered games).
 * When actual activities are developed and registered, this mock catalog will be replaced by
 * metadata queried from the platform activity registry.
 */

export const MOCK_ACTIVITIES = [
  {
    id: 'find-the-bulb',
    title: 'Find the Bulb',
    shortName: 'Bulb Hunt',
    tagline: 'Locate hidden circuit bulbs across the arena matrix under time pressure',
    category: 'Core Dev Track',
    icon: '💡',
    status: 'Demo Ready',
    isPrimaryDemo: true,
    accentColor: '#FBBC05', // Google Yellow
    scoreUnit: 'pts',
  },
  {
    id: 'ghost-signal',
    title: 'Ghost Signal Decoder',
    shortName: 'Ghost Signal',
    tagline: 'Decode corrupted Halloween radio frequencies before the timer expires',
    category: 'Cloud & Systems',
    icon: '📻',
    status: 'Preview',
    isPrimaryDemo: false,
    accentColor: '#4285F4', // Google Blue
    scoreUnit: 'pts',
  },
  {
    id: 'human-captcha',
    title: 'Human CAPTCHA Rush',
    shortName: 'CAPTCHA Rush',
    tagline: 'Beat fast-paced neural puzzle prompts to verify developer reflexes',
    category: 'AI / ML Labs',
    icon: '🧩',
    status: 'Preview',
    isPrimaryDemo: false,
    accentColor: '#EA4335', // Google Red
    scoreUnit: 'pts',
  },
  {
    id: 'binary-blitz',
    title: 'Binary Blitz',
    shortName: 'Binary Blitz',
    tagline: 'Rapid-fire bitwise arithmetic challenge for speed builders',
    category: 'Foundations Track',
    icon: '⚡',
    status: 'Preview',
    isPrimaryDemo: false,
    accentColor: '#34A853', // Google Green
    scoreUnit: 'pts',
  },
];

export const TRACK_DEFINITIONS = [
  {
    id: 'track-1',
    name: 'Track 1',
    label: 'Track 1 · Full-Stack & Cloud',
    shortLabel: 'Track 1',
    accentColor: '#4285F4', // Google Blue
    description: 'Flagship Dev & Distributed Systems Arena',
  },
  {
    id: 'track-2',
    name: 'Track 2',
    label: 'Track 2 · Code Labs & Web',
    shortLabel: 'Track 2',
    accentColor: '#EA4335', // Google Red
    description: 'Interactive Code Labs & Frontend Challenges',
  },
  {
    id: 'track-3',
    name: 'Track 3',
    label: 'Track 3 · AI & Innovations',
    shortLabel: 'Track 3',
    accentColor: '#34A853', // Google Green
    description: 'Next-Gen Intelligence & Algorithmic Trials',
  },
];
