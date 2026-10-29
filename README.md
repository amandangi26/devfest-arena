# DevFest Ranchi 2026 — Gaming Arena

> Flagship interactive developer challenges, booth activities, and live auditorium leaderboard application for **DevFest Ranchi 2026** (October 31, 2026), organized by **Google Developer Groups (GDG) Ranchi**.

---

## 1. Project Overview

The **DevFest Gaming Arena** is a configurable gaming and challenge platform built for the DevFest Ranchi 2026 developer conference. It provides:

- **Auditorium Live Leaderboard (`/arena`):** A public, high-visibility scoreboard designed for large venue projection screens and mobile devices, displaying live participant rankings across conference tracks.
- **Participant Challenge Runtime (`/play/:activityId`):** An isolated sandbox runtime where conference attendees engage with interactive mini-games, booth activities, terminal puzzles, and stage challenges.
- **Event Administration Cockpit (`/admin`):** A restricted management console for track coordinators and organizers to oversee rooms, verify participants, and control challenge availability.

### Frontend Technology Stack
- **Framework:** React 19 (SPA)
- **Tooling & Bundler:** Vite v8 with `@tailwindcss/vite`
- **Styling:** Tailwind CSS v4 using CSS-first configuration and `@theme` design tokens
- **Design System:** DevFest Ranchi Playful Neo-Brutalism (Google brand pigments, Ranchi regional tones, solid black borders, hard drop shadows, tactile spring mechanics)
- **Routing:** React Router v7 (`createBrowserRouter`)
- **Typography:** Plus Jakarta Sans

### Incremental Platform Delivery
The platform is being constructed in phased milestones. The frontend foundation, neo-brutalist design system, dynamic routing, and Phase 1 Leaderboard UI are established. Subsequent phases will integrate live backend services, real-time WebSocket event streams, and community-contributed game activities.

---

## 2. Core Domain Model

The platform architecture is structured around a clear separation between gameplay engines, activity definitions, content versions, and live competition rooms:

```mermaid
flowchart TD
    subgraph CoreHierarchy ["Core Platform Domain Model"]
        GameType["<b>Game Type</b><br/>• Gameplay engine contract<br/>• Configuration schema<br/><i>e.g., MCQ Quiz, Memory, Terminal Puzzle</i>"]
        Game["<b>Game</b><br/>• Reusable activity definition<br/>• Title, rules, description"]
        Variation["<b>Variation</b><br/>• Content & configuration version<br/>• Questions, difficulty, parameters"]
        Room["<b>Room</b><br/>• Joinable live instance<br/>• Fixed variation, lifecycle & schedule"]
        Participant["<b>Participant</b><br/>• Attendee identity in room"]
        Submission["<b>Submission</b><br/>• User answers / game events"]
        Result["<b>Result</b><br/>• Authoritative score, timing & rank"]

        GameType -->|defines engine| Game
        Game -->|has versions| Variation
        Game -->|instantiated into| Room
        Variation -->|selected for (locked on live)| Room
        Room -->|joined by| Participant
        Participant -->|submits in room| Submission
        Room -->|records| Submission
        Submission -->|validated & scored by backend| Result
        Room -->|aggregates official standings| Result
    end

    subgraph MetadataLayer ["Organizational Metadata & Tags (Orthogonal)"]
        Tags["<b>Flexible Tags & Metadata</b><br/>• Conference Tracks (Cloud, Web, AI)<br/>• Booth IDs & Stage Challenges<br/>• Thematic filters & display tags<br/><i>(Categorization attributes — not rigid hierarchy levels)</i>"]
    end

    Tags -.->|categorizes & filters| Game
    Tags -.->|assigns location / track| Room
```

### Domain Concept Responsibilities

#### Game Type
- Defines a supported **gameplay engine** and its required configuration schema.
- Examples include *MCQ Quiz*, *Memory Challenge*, and *Terminal Puzzle*.
- **Engineering Boundary:** Introducing a completely new game type requires implementing both its backend validation/configuration contract and frontend gameplay runtime (UI components, game loop, timers, state management). Registering a database record alone does not implement a new gameplay engine.

#### Game
- A reusable activity definition containing a title, description, game type reference, rule set, and applicable metadata (e.g., *"Find the Bulb"*, *"Ghost Signal Decoder"*).
- Acts as the catalog blueprint from which variations and live rooms are created.

#### Variation
- A specific content or configuration version of a game.
- Contains question sets, difficulty levels, time limits, or challenge parameters.
- A game can have multiple variations (e.g., *Easy Tier*, *Advanced Cloud Questions*, *Booth Quickfire*).
- **Room Assignment Rule:** Each room must use exactly one selected variation. Different rooms running the same game may use different variations.

#### Room
- A joinable, scheduled instance of a configured game.
- References a game and exactly one variation, maintaining its own schedule, access mechanism (room code or direct URL), active participants, lifecycle status, submissions, and results.
- **Immutability Invariant:** A room's selected variation **must not be changed** after the room goes live to preserve fair scoring and historical result consistency.

#### Metadata and Tags
- Conference tracks (e.g., *Flagship*, *Cloud*, *Beginner*), booths (e.g., *Booth A*, *Community Stage*), themes (e.g., *Halloween*, *Retro*), and standalone labels are **organizational metadata** rather than rigid hierarchical layers.
- Flexible tags enable dynamic filtering, search, and presentation across the UI.
- Explicit database fields and foreign keys are reserved for system-enforced relationships, such as room assignments, access controls, and ranking partitions.

#### Participants, Submissions, and Results
- Attendees join specific rooms as participants.
- In-game submissions (answers, moves, completion timestamps) belong to the specific room.
- The **backend remains strictly authoritative** for validating answers, calculating official timings, computing scores, and determining leaderboard rankings. The frontend never computes or persists final standings directly.

---

## 3. Frontend Architecture

The frontend is organized into modular domains with strict boundaries to ensure parallel feature development without merge conflicts or cross-module coupling:

```text
game-arena/
├── public/                     # Static web assets (favicon.svg, icons.svg)
├── docs/                       # Architecture & developer specifications
│   ├── ARCHITECTURE.md         # Master frontend architecture blueprint
│   ├── CONTRIBUTING.md         # Team workflow, branching & import boundaries
│   ├── DESIGN_SYSTEM.md        # Neo-brutalist design tokens & UI rules
│   └── ACTIVITY_DEVELOPMENT.md # Guide for developing new game activities
│
├── src/
│   ├── app/                    # Application bootstrap & routing
│   │   ├── App.jsx             # Root React shell
│   │   ├── router.jsx          # Centralized React Router definition
│   │   └── providers.jsx       # Global context provider tree
│   │
│   ├── arena/                  # Live Leaderboard domain
│   │   ├── pages/              # /arena route screen (ArenaPage, NotFoundPage)
│   │   ├── components/         # Podium, Leaderboard, ChallengeDrawer, DraggableTab
│   │   ├── hooks/              # useLeaderboard presentation hooks
│   │   ├── mocks/              # Deterministic mock datasets for Phase 1 UI
│   │   └── services/           # leaderboardService boundary abstraction
│   │
│   ├── activities/             # Isolated activity sandboxes
│   │   ├── registry.js         # Central activity manifest registry
│   │   ├── ActivityHost.jsx    # Dynamic lazy-loading host for /play/:activityId
│   │   └── README.md           # Sandboxing rules & folder template
│   │
│   ├── admin/                  # Event administration domain
│   │   ├── pages/              # /admin route placeholder (AdminPage)
│   │   └── README.md           # Administration portal scope
│   │
│   ├── components/             # Shared platform UI primitives
│   │   ├── ui/                 # Neo-brutalist primitives (Button, Card, Badge)
│   │   ├── layout/             # Master ArenaLayout, Navbar
│   │   └── feedback/           # Accessible LoadingState, ErrorState, EmptyState
│   │
│   ├── services/               # Shared networking infrastructure
│   │   ├── api/                # Native fetch client wrapper (client.js)
│   │   └── realtime/           # Pub/sub connection manager contract (connection.js)
│   │
│   ├── hooks/                  # Cross-application shared React hooks
│   ├── lib/                    # Pure utility functions (cn, formatters)
│   ├── types/                  # JSDoc schemas (ActivityManifest, DevFestTrack)
│   ├── assets/                 # Brand assets, logos, and graphic elements
│   ├── styles/                 # Design token CSS custom properties
│   │   └── tokens.css          # Brand colors, brutalist shadows, borders, radii
│   │
│   ├── index.css               # Tailwind v4 import, theme mappings, base styles
│   └── main.jsx                # Application DOM entry point
│
├── eslint.config.js            # Boundary lint enforcement & React 19 rules
├── index.html                  # HTML5 shell & Plus Jakarta Sans typography
├── package.json                # React 19, Tailwind v4, React Router v7
└── vite.config.js              # Vite bundler configuration
```

### Architectural Boundaries & Experience Separation
1. **Activity Sandboxing:** Every game lives in its own folder under `src/activities/<activity-id>/`. An activity **must never import another activity's internal files**. Violations are blocked by ESLint import boundaries.
2. **Downward Dependency Flow:** Activities consume shared platform primitives (`components/ui/`, `services/api/`, `lib/`), but shared platform code never imports activity implementations.
3. **Experience Separation:**
   - **Auditorium Leaderboard (`/arena`):** Optimized for public display and audience engagement; consumes aggregated leaderboard data via `leaderboardService`.
   - **Participant Gameplay (`/play/:activityId`):** Sandboxed, interactive game runtime loaded on demand via `ActivityHost` without router modification.
   - **Admin Cockpit (`/admin`):** Separate administrative experience for challenge coordinators with distinct access control and operational workflows.

---

## 4. API Resource Organization & Collaboration

### Proposed API Resource Boundaries
As the platform backend evolves, endpoints should be organized around the following cohesive resource boundaries:

| Resource Group | Scope & Responsibilities |
| :--- | :--- |
| **Authentication & Authorization** | Organizer login, session verification, coordinator role permissions. |
| **Participants** | Attendee registration, participant profiles, check-in status verification. |
| **Game Types** | Catalog of supported gameplay engines, parameter schemas, and engine rules. |
| **Games** | Reusable activity definitions, descriptions, assigned game engines, and metadata. |
| **Game Variations & Content** | Variation configurations, difficulty levels, content payloads, and versioning. |
| **Questions & Bulk Import** | Question bank management, bulk CSV/JSON question import, and validation. |
| **Rooms & Room Lifecycle** | Room creation, lifecycle transitions (`scheduled` → `active` → `closed`), access codes, and schedule controls. |
| **Room Participants** | Room joining, active participant rosters, and lobby status. |
| **Submissions** | Participant answer payloads, move telemetry, and client completion timestamps. |
| **Leaderboards** | Room-specific scoreboards, track-level standings, and event-wide leaderboards. |

> [!NOTE]
> The resource groups above represent proposed architectural boundaries for platform planning. Refer to Section 5 for the distinction between currently confirmed routes and planned endpoints.

### Frontend-Backend Collaboration Workflow
To ensure dependable integration across distributed teams:

1. **Contract-First Definition:** Backend engineers author and maintain the canonical API contract before client development begins.
2. **Implementation Against Contract:** Frontend engineers implement UI services and state management against the agreed contract.
3. **Pre-Implementation Schema Agreement:** Both teams review and align on request parameters, JSON body structures, status codes, and error formats before writing integration code.
4. **Maintained Examples & Fixtures:** Realistic sample request and response fixtures are committed alongside API documentation to enable reliable mock testing.
5. **Proactive Change Communication:** Any changes to endpoints, field names, or validation rules must be communicated in advance before modifying dependent client code.

---

## 5. Existing APIs vs. Planned Capabilities

### Existing Backend Capabilities
Based on the backend documentation provided by the team, the following capabilities are currently documented:

- **Authentication:** Admin authentication and session management.
- **Participants:** Participant creation and participant retrieval endpoints.
- **Games:** Game activity creation and game retrieval endpoints.
- **Game Lifecycle:** Game activation and game closing operations.

> [!IMPORTANT]
> The exact HTTP methods, URL paths, query parameters, and payload schemas reside in the backend repository. The backend repository is the single source of truth for all live API specifications.

### Planned Capabilities (Pending Backend Confirmation)
The following resource groups are **planned** and subject to future backend contract confirmation:

- **Room Management:** Room creation, scheduling, and live room lifecycle state transitions.
- **Variation Management:** Variation creation, content payload configuration, and room-to-variation binding.
- **Question Management:** Question bank CRUD operations and bulk question import endpoints.
- **Answer Submission:** In-room answer submission, event validation, and real-time score processing.
- **Live Leaderboard Feeds:** Official room score calculation, track aggregation, and real-time standings.

---

## 6. API Documentation & Environment Strategy

### Recommended API Documentation Toolchain
- **OpenAPI Specification (OAS 3.0+):** The authoritative, machine-readable contract defining all endpoints, parameters, request schemas, response codes, and error structures.
- **Swagger UI:** Interactive web-based documentation interface for browsing endpoints and testing live requests.
- **Bruno Collection:** A Git-friendly, runnable API collection maintained with environment variables and sample requests/responses for developer testing.

**Repository Ownership:** The backend repository owns and publishes the canonical OpenAPI specification and Bruno collection. The frontend repository consumes and links to these assets rather than maintaining diverging copies.

### Environment Separation
The frontend uses environment-based configuration to support local development, testing, and production deployments:

| Environment | Configuration File | Description |
| :--- | :--- | :--- |
| **Local Development** | `.env.local` | Local Vite dev server, typically proxying to a local backend instance or mock server. |
| **Staging / Preview** | `.env.staging` | Staged pre-event testing with conference network and staging backend. |
| **Production** | `.env.production` | Deployed production build for the live DevFest event day. |

### Configuration Rules & Secret Safety
- **Configurable Base URL:** Outbound HTTP requests use [src/services/api/client.js](file:///c:/Workspace/ByteLab/game-arena/src/services/api/client.js), reading the base URL from `VITE_API_BASE_URL` (defaulting to `/api`).
- **No Hardcoded URLs:** Endpoints must never be hardcoded inside components or activity modules.
- **Zero Secrets in Frontend:** The frontend bundle is fully public and client-facing. **Never** place private API keys, backend secret keys, database credentials, or admin passwords in frontend environment variables or source files.
- **No Committed Credentials:** Sample tokens, cookies, and production credentials must never be committed to repository documentation or code.

---

## 7. Implementation Status

The table below summarizes the implementation status across platform areas:

| Area | Status | Details |
| :--- | :--- | :--- |
| **Frontend Foundation** | **Implemented** | Vite + React 19 setup, React Router v7 with dynamic `/play/:activityId`, Tailwind CSS v4 design tokens, and neo-brutalist UI primitives. |
| **Arena Leaderboard UI** | **Implemented (Mock Data)** | Complete Phase 1 public scoreboard UI with Top 3 Podium, Live Standings table, Track Switcher, and Slide-out Challenge Drawer. Driven by deterministic mock datasets in [src/arena/mocks/](file:///c:/Workspace/ByteLab/game-arena/src/arena/mocks/). |
| **Admin Portal UI** | **Placeholder** | Route shell exists at `/admin` ([src/admin/pages/AdminPage.jsx](file:///c:/Workspace/ByteLab/game-arena/src/admin/pages/AdminPage.jsx)) displaying a restricted preparation notice. Full administrative console is deferred. |
| **Playable Activities** | **Foundation Ready** | Activity sandbox architecture, [ActivityHost.jsx](file:///c:/Workspace/ByteLab/game-arena/src/activities/ActivityHost.jsx), and [registry.js](file:///c:/Workspace/ByteLab/game-arena/src/activities/registry.js) are established. **Zero playable games** are registered; challenge implementations will be added in subsequent phases. |
| **Backend Integration** | **Deferred** | Lightweight HTTP client wrapper ([client.js](file:///c:/Workspace/ByteLab/game-arena/src/services/api/client.js)) is established. Live backend network communication is intentionally deferred until backend contracts are confirmed. |
| **Realtime Networking** | **Pub/Sub Contract** | Event contract and in-memory pub/sub manager ([connection.js](file:///c:/Workspace/ByteLab/game-arena/src/services/realtime/connection.js)) are in place. Active WebSocket transport is deferred until backend streaming services are deployed. |

---

## 8. Quick Start & Development Scripts

### Prerequisites
- Node.js (v18+ recommended)
- npm (v9+)

### Installation
```bash
# Clone the repository and install dependencies
npm install
```

### Development Server
```bash
# Start Vite development server with Hot Module Replacement (HMR)
npm run dev
```
Open [http://localhost:5173/arena](http://localhost:5173/arena) to view the live Arena Leaderboard.

### Code Quality & Build Verification
```bash
# Run ESLint (enforces React 19 rules and architectural boundary constraints)
npm run lint

# Build production bundle to /dist
npm run build

# Preview production build locally
npm run preview
```

---

## 9. Key Documentation Links

For in-depth architectural guidelines, contributor rules, and design specifications, refer to the project documentation:

1. [docs/ARCHITECTURE.md](file:///c:/Workspace/ByteLab/game-arena/docs/ARCHITECTURE.md): Architectural boundaries, module dependency graph, routing lifecycle, and deferred concerns.
2. [docs/CONTRIBUTING.md](file:///c:/Workspace/ByteLab/game-arena/docs/CONTRIBUTING.md): Git branching conventions, team ownership rules, and pull request verification.
3. [docs/DESIGN_SYSTEM.md](file:///c:/Workspace/ByteLab/game-arena/docs/DESIGN_SYSTEM.md): DevFest Ranchi Neo-Brutalist design tokens, Google brand palette, and tactile button mechanics.
4. [docs/ACTIVITY_DEVELOPMENT.md](file:///c:/Workspace/ByteLab/game-arena/docs/ACTIVITY_DEVELOPMENT.md): Step-by-step guide for implementing, sandboxing, and registering new game activities.
