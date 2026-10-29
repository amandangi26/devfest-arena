# Shared Utilities (`src/lib`)

This directory houses cross-cutting, pure helper functions and utilities shared across the DevFest Gaming Arena application.

## Guidelines
- **Pure Functions:** Utilities must be side-effect-free, deterministic, and easily testable.
- **No Domain Logic:** Specific leaderboard calculations or activity-specific business logic must live within `src/arena/` or the respective activity folder.
- **Dependency Minimization:** Prefer native Web APIs and modern JavaScript standard library methods over third-party micro-packages.

## Modules
- [utils.js](file:///c:/Workspace/ByteLab/game-arena/src/lib/utils.js): `cn` class name joiner, string and time formatting helpers.
