# DevFest Ranchi 2026 Gaming Arena — Contributing Guide

Welcome to the DevFest Ranchi 2026 Gaming Arena team! This guide establishes workflow conventions to ensure smooth parallel development across multiple engineering squads.

---

## 1. Team Parallelization & Folder Ownership

To prevent merge conflicts and coordination bottlenecks:
- **Activity Squads Own Their Activity Folder:** If you are building challenge `ghost-signal`, your entire work belongs inside `src/activities/ghost-signal/`.
- **Shared Code is Protected:** Modifying shared platform code requires coordination with the Core Maintainer.

### Files You Must NEVER Modify During Normal Activity Work
During routine activity development, **do NOT edit**:
- `src/app/router.jsx` (Routing is dynamic; register via `registry.js`)
- `src/app/App.jsx`
- `src/app/providers.jsx`
- `src/components/layout/*`
- `src/styles/tokens.css`
- `src/index.css`
- `vite.config.js`
- `eslint.config.js`

---

## 2. Git Workflow & Branching Strategy

### Branch Naming Conventions
- Activities: `feat/activity-<activity-id>` (e.g., `feat/activity-ghost-signal`)
- Shared UI Primitives: `feat/ui-<component-name>`
- Infrastructure / Bug Fixes: `fix/<issue-description>`

### Avoiding Git Conflicts
1. **Never edit another activity's folder.**
2. **Do not modify package.json** unless your activity requires a library explicitly approved by the Architecture Lead.
3. Keep your branch synced with `main` via rebase:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

---

## 3. Strict Module Import Boundaries

Automated ESLint rules enforce strict dependency boundaries:

```javascript
// ✅ APPROVED: Importing from your own activity
import { GameBoard } from './components/GameBoard';
import { useGameLoop } from './hooks/useGameLoop';

// ✅ APPROVED: Importing shared platform primitives
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/services/api/client';
import { cn } from '@/lib/utils';

// ❌ FORBIDDEN: Importing another activity's internal code
import { AlienSprite } from '../alien-invasion/assets/sprite'; // LINT ERROR!

// ❌ FORBIDDEN: Importing activity code into shared platform modules
import { GhostSignalConfig } from '@/activities/ghost-signal'; // LINT ERROR!
```

---

## 4. Shared Component Reuse & Proposing Changes

Before writing a custom button, card, or modal:
1. Inspect [src/components/ui/](file:///c:/Workspace/ByteLab/game-arena/src/components/ui/) and [src/components/feedback/](file:///c:/Workspace/ByteLab/game-arena/src/components/feedback/).
2. Use existing primitives with standard neo-brutalist props.
3. If you require a new shared UI element or design token:
   - Do not hack local overrides into global stylesheets.
   - Open an issue or propose a change in the `#devfest-arena-core` Slack/Discord channel.
   - The Core Maintainer will review and add the shared primitive.

---

## 5. Adding Third-Party Dependencies

The Gaming Arena is lightweight and optimized for high performance.
- **Default Policy:** Zero unapproved dependencies.
- Native browser APIs (Canvas, Web Audio, SVG, Web Workers) should be prioritized.
- Adding a package (such as a lightweight physics engine or 2D renderer) requires Architecture Lead approval before adding to `package.json`.

---

## 6. Pre-Commit & Pull Request Verification

Before opening a pull request, run the local verification suite:

```bash
# 1. Verify code formatting and architecture boundary rules
npm run lint

# 2. Verify production compilation and type safety
npm run build
```

Every PR must satisfy:
- Zero ESLint errors or boundary violations.
- Clean production build with zero compiler warnings.
- Adherence to neo-brutalist styling rules specified in `docs/DESIGN_SYSTEM.md`.
