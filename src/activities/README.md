# Activities Directory (`src/activities`)

This directory is the designated workspace for independent game and challenge modules for DevFest Ranchi 2026.

## Current Architectural State
> **NOTICE:** Under the initial architecture foundation, **zero** playable activities are registered or implemented. This directory establishes isolation rules, contract schemas, and registration mechanisms for future contributors.

## Future Activity Folder Template
When an activity is assigned (e.g., `ghost-signal`), it will be built in an isolated folder:

```text
src/activities/<activity-id>/
├── index.jsx        # Lazy-loaded default export component
├── config.js        # ActivityManifest definition
├── pages/           # Activity-specific screen views
├── components/      # Activity-specific internal UI components
├── hooks/           # Activity-specific game loops and state hooks
├── services/        # Activity-specific network/scoring logic
├── assets/          # Isolated sprites, audio, and SVG graphics
└── README.md        # Activity game rules and contributor notes
```

## Strict Architectural Rules
1. **Zero Cross-Activity Imports:** An activity must NEVER import files from `src/activities/<another-activity>/`.
2. **Shared Dependency Direction:** Activities may import approved shared primitives from:
   - `src/components/ui/`
   - `src/components/feedback/`
   - `src/services/api/`
   - `src/services/realtime/`
   - `src/lib/`
   - `src/types/`
3. **No Global Mutation:** Activities must not modify `router.jsx`, `App.jsx`, `tokens.css`, or shared layout wrappers.
4. **Registration:** To expose an activity, add its manifest to [registry.js](file:///c:/Workspace/ByteLab/game-arena/src/activities/registry.js).
