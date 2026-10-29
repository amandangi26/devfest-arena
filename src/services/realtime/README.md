# Realtime Integration Layer (`src/services/realtime`)

This directory houses connection interfaces and event-handling contracts for live leaderboard synchronization.

## Architectural Boundaries
1. **Deferred Transport:** WebSocket/SSE connections are deferred until backend event infrastructure is deployed. No real connections are opened during application bootstrap.
2. **Event Pub/Sub Contract:** Consumers subscribe to standardized events via [connection.js](file:///c:/Workspace/ByteLab/game-arena/src/services/realtime/connection.js) (`score:update`, `leaderboard:refresh`, etc.).
3. **Leaderboard Decoupling:** Activities must not write directly to realtime sockets; activity score reports route through authorized API endpoints, and the server broadcasts verified score changes to the arena.
