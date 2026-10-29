# DevFest Ranchi 2026 Gaming Arena — Activity Development Guide

> **Notice to Developers:** This guide describes the architectural convention for future activity development. **No activity implementations are created or registered during initial foundation setup.**

---

## 1. Activity Architecture & Isolation

Every game or interactive challenge in the DevFest Gaming Arena runs as an **isolated sub-application**. It owns its internal views, assets, game engine, and local state.

### The Activity Folder Template
When an activity ID (e.g., `ghost-signal`) is assigned, create its workspace:

```text
src/activities/<activity-id>/
├── index.jsx          # Default export React component (mounted by ActivityHost)
├── config.js          # Activity manifest and metadata definition
├── pages/             # Activity views (e.g., GameScreen, ResultScreen)
├── components/        # Internal UI elements (e.g., TargetBoard, ScorePill)
├── hooks/             # Internal custom hooks (e.g., useGameEngine, useTimer)
├── services/          # Activity network helpers (submitting scores to API)
├── assets/            # Isolated spritesheets, SFX audio files, custom SVG
└── README.md          # Game rules, mechanics, and maintainer notes
```

---

## 2. The Activity Manifest Contract

Every activity must define a manifest adhering to the JSDoc schema in [src/types/activity.js](file:///c:/Workspace/ByteLab/game-arena/src/types/activity.js):

```javascript
// src/activities/<activity-id>/config.js
import { ActivityStatus, DevFestTrack } from '../../types/activity';

/** @type {import('../../types/activity').ActivityManifest} */
export const activityConfig = {
  id: 'ghost-signal',
  title: 'Ghost Signal Decoder',
  description: 'Decode corrupted developer frequencies before the Halloween pumpkin timer expires.',
  track: DevFestTrack.FLAGSHIP,
  status: ActivityStatus.ACTIVE, // 'active' | 'draft' | 'disabled'
  author: 'Web & Cloud Squad',
  estimatedDuration: '3 mins',
  leaderboard: {
    enabled: true,
    scoreType: 'highest', // 'highest' | 'lowest' | 'fastest'
    unit: 'pts',
  },
  loadComponent: () => import('./index.jsx'),
};
```

---

## 3. How Routes & Lazy Loading Work

You **do NOT** need to edit `src/app/router.jsx`.
1. The router defines a single dynamic pattern: `/play/:activityId`.
2. When a participant visits `/play/ghost-signal`, the central [ActivityHost](file:///c:/Workspace/ByteLab/game-arena/src/activities/ActivityHost.jsx) looks up `ghost-signal` in [src/activities/registry.js](file:///c:/Workspace/ByteLab/game-arena/src/activities/registry.js).
3. If registered and active, `ActivityHost` dynamically imports your root `index.jsx` via `React.lazy()` within a standard `<Suspense>` boundary.
4. Your bundle is fetched on-demand, ensuring fast initial page loads for the main arena.

---

## 4. Permitted & Restricted Imports

### Permitted Imports (Platform Primitives)
```javascript
// ✅ UI Primitives
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

// ✅ Feedback States
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';

// ✅ Platform Networking & Utilities
import { apiClient } from '@/services/api/client';
import { cn } from '@/lib/utils';
```

### Strictly Forbidden Imports
```javascript
// ❌ Cross-Activity Imports (Enforced by ESLint)
import { alienHelpers } from '../alien-invasion/lib'; // BUILD ERROR

// ❌ Root & Platform Overrides
import { router } from '@/app/router'; // VIOLATION
```

---

## 5. Submitting Scores to the Leaderboard

To ensure integrity and prevent client-side score manipulation:
1. Activities never write directly to realtime sockets or database instances.
2. Upon game completion, submit verified scores through the centralized API client:
   ```javascript
   import { apiClient } from '../../services/api/client';

   export async function submitScore(activityId, participantId, score) {
     return apiClient('/arena/scores', {
       method: 'POST',
       body: JSON.stringify({
         activityId,
         participantId,
         score,
         completedAt: new Date().toISOString(),
       }),
     });
   }
   ```
3. The backend validates the score and broadcasts an event via the realtime service to update the live `/arena` leaderboard.

---

## 6. Step-by-Step Checklist for New Activities

1. [ ] **Claim Activity ID:** Confirm your kebab-case identifier with the track lead (e.g., `ghost-signal`).
2. [ ] **Create Folder Structure:** Build `src/activities/<activity-id>/` matching the template.
3. [ ] **Define Manifest:** Create `config.js` with the full `ActivityManifest` schema.
4. [ ] **Implement Component:** Build `index.jsx` using shared UI primitives.
5. [ ] **Register Manifest:** Add your configuration to the `ACTIVITY_REGISTRY` array in [src/activities/registry.js](file:///c:/Workspace/ByteLab/game-arena/src/activities/registry.js).
6. [ ] **Run Lint & Build Verification:**
   ```bash
   npm run lint
   npm run build
   ```
7. [ ] **Test Route Locally:** Visit `http://localhost:5173/play/<activity-id>` in your browser.
8. [ ] **Open Pull Request:** Target your feature branch `feat/activity-<activity-id>` to `main`.
