# Cross-Application React Hooks (`src/hooks`)

This directory is strictly reserved for shared, cross-application custom React hooks.

## Rules
- **No Activity Hooks:** Activity-specific custom hooks (e.g., game loops, timer controllers, canvas interactions) must reside inside `src/activities/<activity-id>/hooks/`.
- **General Purpose Only:** Examples of acceptable shared hooks include `useMediaQuery`, `useDocumentTitle`, or `useKeyboardShortcuts`.
