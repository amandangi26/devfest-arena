# API Service Layer (`src/services/api`)

This directory contains shared HTTP client utilities, API endpoint definitions, and future domain-specific networking services.

## Architectural Boundaries
1. **Centralized Transport:** All outbound HTTP calls should route through [client.js](file:///c:/Workspace/ByteLab/game-arena/src/services/api/client.js) rather than direct `fetch` invocations.
2. **Deferred Backend Integration:** Backend endpoints will be deployed in a separate service. Frontend activities must not hardcode third-party API keys or unverified hostnames.
3. **No Redux / Axios:** Keep frontend networking lightweight by relying on native Web Fetch and simple async utilities.
