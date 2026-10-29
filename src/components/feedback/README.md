# Shared Feedback Components (`src/components/feedback`)

This directory houses user feedback states including loading screens, error notifications, and empty lists.

## Guidelines
- Follow Neo-brutalist principles: high-contrast surfaces, solid black borders, and clear typography.
- Support standard accessibility roles (`role="status"`, `role="alert"`, `aria-live`).
- Avoid jarring un-styled fallbacks during asynchronous or suspense transitions.

## Components
- [LoadingState.jsx](file:///c:/Workspace/ByteLab/game-arena/src/components/feedback/LoadingState.jsx): Accessible loading card with bouncing Google brand dots.
- [ErrorState.jsx](file:///c:/Workspace/ByteLab/game-arena/src/components/feedback/ErrorState.jsx): Neo-brutalist alert card with actionable resolution button.
- [EmptyState.jsx](file:///c:/Workspace/ByteLab/game-arena/src/components/feedback/EmptyState.jsx): Standard placeholder for empty lists and pending data.
