# 🎮 DevFest Ranchi 2026 — Live Interactive Game Engine
## Production System Architecture, Data Schema & Real-Time Engineering Blueprint

> **Status:** Architecture Approved for Implementation  
> **Target Event:** Google Developer Groups (GDG) Ranchi — DevFest 2026 (Radisson Blu, Ranchi)  
> **Target Scale:** 800+ Simultaneous Concurrent Attendees across 3 Specialized Tracks  
> **Design Philosophy:** DevFest Retro-Tech Neo-Brutalism (Ref: `THEME.md`)  
> **Deployment Target:** Serverless (Firebase or Supabase Edge Stack)

---

## 1. Executive Summary & Engine Objectives

DevFest Ranchi 2026 brings together **800+ developers, engineers, and students** across 3 parallel stages:
1. **Conference (Only)**: Senior Engineers & Tech Leaders (*More Learning, Less Building*)
2. **Beginner Track (Track 1)**: First-time builders & students (*Anybody Can Code*)
3. **Flagship Dev Track (Track 2)**: Core systems, architecture, and production scale (*Frontend Clicks to Backend Bricks*)

To deliver unforgettable interactive engagement, this document defines the end-to-end engineering architecture for the **DevFest Ranchi Live Game Engine**. The engine is built as an **extensible serverless modular platform**, kicking off with **Module 1: Live Synchronized MCQ (Kahoot-Style Stage Battle)**, engineered to withstand high burst concurrency without crashing under spotty venue network conditions.

```
       ┌────────────────────────────────────────────────────────────┐
       │             DevFest 2026 Live Game Engine                  │
       └─────────────────────────────┬──────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   Module 1: MCQ     │   │ Module 2: Buzzer    │   │ Module 3: Scavenger │
│ (Live Synced Quiz)  │   │   (Future Release)  │   │   (Future Release)  │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

---

## 2. Ingestion Subsystem & Attendee Verification

### 2.1 Raw Data Analysis & Field Sanitization
Event registrations exported from Commudle and Google Forms contain 25 columns. Running live games against raw CSV exports causes identity fragmentation and query latency.

#### Raw Column Mapping & Sanitization Strategy:

| Raw Export Field | Cleaned Field | Type | Purpose |
| :--- | :--- | :--- | :--- |
| `Unique Code` | `uniqueCode` | `STRING (PK)` | **Primary Key** (e.g., `DFR26-A9X2B`). Unambiguous ticket identifier. |
| `Name` | `name` | `STRING` | Attendee display name (title-cased, trimmed). |
| `Email` | `email` | `STRING (INDEX)` | Lowercased & trimmed for verification cross-check. |
| `Phone Number` | `phone` | `STRING (INDEX)` | Standardized 10-digit number (stripped of `+91`, spaces, hyphens). |
| `Track / Registration Status` | `trackId` | `ENUM` | `conference-only` \| `beginner-track` \| `flagship-dev` \| `all`. |
| `Organization / College & Location` | `organization` | `STRING` | College / Company for leaderboard accolades. |
| `Designation / Domain` | `designation` | `STRING` | Professional designation (optional badge). |

> **Architectural Decision: Single Unified Collection vs. 3 Track Collections**  
> **Recommendation: 1 Unified `attendees` Collection with a `trackId` Tag.**  
> *Rationale:* Splitting into 3 separate collections creates query fragmentation, prevents global unique checks on `uniqueCode`, and makes all-hands "DevFest General" trivia impossible. A single collection indexed on `(trackId, email)` and `(uniqueCode)` allows zero-latency filtering for both track-specific matches and combined battles.

### 2.2 Frictionless Self-Verification Flow (Zero Passwords)
Attendees at a live conference will not tolerate sign-up forms, OTP SMS latency, or password resets. 

```
[Attendee Visits /play]
          │
          ▼
┌──────────────────────────────────────────────────┐
│  Has Valid Session in LocalStorage?              │
└──────────────┬────────────────────────┬──────────┘
               │ YES                    │ NO
               ▼                        ▼
     [Auto-Rehydrate Session]   [Enter Ticket ID / Email / Phone]
               │                        │
               │                        ▼
               │                [Match in `attendees` DB]
               │                        │
               │                        ▼
               │                [Store in localStorage]
               ▼                        ▼
       ┌──────────────────────────────────────────┐
       │   Verified Attendee Profile Active!       │
       │   Can enter Room PIN or select Track     │
       └──────────────────────────────────────────┘
```

#### Multi-Ticket Edge Case Handling:
- **Problem**: Companies or student group leaders frequently book 3–5 tickets under one email address or one phone number.
- **Solution**: The verification form requires:
  1. **Ticket Unique Code** (e.g., `DFR-8942`), and
  2. **Email** OR **Phone Number** as a security match.
  Because each ticket issued by Commudle receives a unique ticket hash/code, multiple tickets sharing the same email are instantly disambiguated.

#### Client Session Rehydration:
Upon successful verification, the browser stores a lightweight session in `localStorage`:
```json
{
  "uniqueCode": "DFR26-9812",
  "name": "Aman Dangi",
  "email": "aman@gdgranchi.in",
  "trackId": "flagship-dev",
  "organization": "BIT Mesra",
  "verifiedAt": 1793442000000,
  "signature": "hmac_sha256_verification_token"
}
```
Attendees can refresh, switch network from 5G to venue Wi-Fi, or close their browser tab, and return directly to the game without re-verifying.

---

## 3. Game Architecture & Modular Engine

### 3.1 Module 1: Live Synchronized MCQ Engine
The MCQ engine is designed for high-energy stage quizzes:
- **Questions**: Max **15 questions** per game.
- **Time Limits**: Configurable per question (**10s, 15s, 20s, 30s**).
- **Points Engine**: Speed-weighted scoring (earlier answers get higher points).
- **Rich Media Support**:
  - Code snippets (Syntax-highlighted or JetBrains Mono blocks)
  - SVG/PNG tech architecture diagrams & UI mockups
  - Google & Lucide icons (`Cpu`, `Code2`, `Database`, `Sparkles`, etc.)
- **Room Code Protection**: 6-character uppercase PIN (e.g., `RNC2026`) preventing off-venue random link spammers from skewing leaderboards.
- **Track Isolation**: Admin can target a game strictly to `beginner-track`, `flagship-dev`, `conference-only`, or `open-to-all`.
- **Game History & Persistence**: Games are created in `DRAFT`, can be dry-run tested, reset to `LOBBY`, played live, and archived with full submission logs for audit.

```
       ┌────────────────────────────────────────────────────────┐
       │                 Admin Master Console                   │
       └───────┬──────────────────────┬──────────────────┬──────┘
               │                      │                  │
         Create Game           Control Clock       Push Question
               │                      │                  │
               ▼                      ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Real-Time State Bus                          │
│     (Firebase Realtime DB / Supabase Realtime Broadcast)        │
└───────┬──────────────────────┬──────────────────┬───────────────┘
        │                      │                  │
        ▼                      ▼                  ▼
┌───────────────┐      ┌───────────────┐  ┌───────────────┐
│ Attendee 1    │      │ Attendee 2    │  │ Main Projector│
│ (Mobile View) │      │ (Mobile View) │  │ (Stage View)  │
└───────────────┘      └───────────────┘  └───────────────┘
```

---

## 4. Real-Time State Machine & Concurrency Design

### 4.1 The Concurrency Challenge: 800 Simultaneous Attendees
In an auditorium of 800 attendees:
- When a 15-second question begins, **800 users fire responses within a 4-second window**.
- **Naive Firestore/Postgres setups WILL CRASH:**
  - Standard Firestore allows **1 write per second to a single document**. Storing responses in an array inside `game` doc will error out immediately (`RESOURCE_EXHAUSTED`).
  - Storing 800 subcollection docs in Firestore triggers 800 writes *plus* 800 snapshot read broadcasts = **640,000 document reads in 15 seconds**, blowing past free quotas and spiking billable latency.
  - Standard PostgreSQL connection pools (`max_connections=60-100`) will choke if 800 active web clients open direct DB connections.

### 4.2 The Anti-Crash Solution: Decoupled Broadcast & Queued Ingestion

```
[800 Attendees: Submitting Answers]
                  │
                  ▼  (Ultra-light payload: < 120 bytes)
┌────────────────────────────────────────────────────────┐
│  Firebase Realtime Database (In-Memory Tree)           │
│  OR Supabase Edge Function with Redis/Memory Buffer    │
│  - Instantaneous in-memory write                       │
│  - Sub-50ms latency                                    │
│  - Zero Postgres connection exhaustion                 │
└─────────────────────────┬──────────────────────────────┘
                          │
                          ▼ (Worker Aggregator)
┌────────────────────────────────────────────────────────┐
│  Question Results Computed in In-Memory Map           │
│  - Breakdown calculated (A: 340, B: 210, C: 150, D: 60)│
│  - Top 10 Leaderboard computed                         │
└─────────────────────────┬──────────────────────────────┘
                          │
                          ▼ (Single Broadcast to 800 Devices)
┌────────────────────────────────────────────────────────┐
│  Broadcast Node: `/rooms/{code}/state`                 │
│  - 800 devices receive ONLY 1 state update             │
│  - Read amplification eliminated completely            │
└────────────────────────────────────────────────────────┘
```

### 4.3 Live Question Lifecycle State Machine

| State | Who Triggers | What Attendees See | What Stage Screen Displays |
| :--- | :--- | :--- | :--- |
| `LOBBY` | Admin | Waiting room, live attendee counter, avatar badge | Room PIN, QR Code, animated attendee avatars |
| `COUNTDOWN` | Admin (`Start`) | 3-2-1 countdown animation with audio cue | Giant 3-2-1 visual burst |
| `QUESTION_ACTIVE` | Server Clock | Prompt text, 4 tactile colored choice cards | Question prompt, countdown bar, answer counter |
| `QUESTION_LOCKED` | Timer / Admin | Selected choice locked, "Time's Up!" haptic | "Time's Up!", countdown finishes |
| `QUESTION_RESULT` | Admin / Auto | Shows whether selected choice was Correct / Incorrect | Bar chart showing distribution across A, B, C, D |
| `LEADERBOARD` | Admin | Personal points scored + current rank | Top 5 on-stage podium + highest score jumps |
| `GAME_OVER` | Admin (`Finish`) | Final position, score card, and reward badge | Grand 3D Podium (1st, 2nd, 3rd) with confetti |

---

## 5. Anti-Cheat & Latency Compensation Algorithms

### 5.1 Preventing Client Inspection Exploits
- **Crucial Rule**: The correct answer key (`correctIndex`) is **NEVER** sent to client browsers during `QUESTION_ACTIVE`.
- Client receives only:
  ```json
  {
    "qIndex": 4,
    "prompt": "Which Google Cloud service provides fully managed serverless containers?",
    "options": ["Cloud Functions", "Cloud Run", "Compute Engine", "GKE Autopilot"],
    "timeLimit": 20,
    "startedAt": 1793442150000
  }
  ```
- The correct option is released only when the state transitions to `QUESTION_RESULT`.

### 5.2 Server-Synchronized Timer & Latency Offset
Client phone clocks can be skewed by minutes. All timing calculations use **Server Time Offset**:
```javascript
// Firebase Server Time Offset Sync
let serverTimeOffset = 0;
const offsetRef = rtdb.ref(".info/serverTimeOffset");
offsetRef.on("value", (snap) => {
  serverTimeOffset = snap.val() || 0;
});

function getAccurateServerTime() {
  return Date.now() + serverTimeOffset;
}
```

### 5.3 Speed-Weighted Scoring Formula
Points are calculated dynamically on the server:
- Maximum base points per question: **1,000 points**.
- Time taken formula ($t$ = seconds elapsed, $T$ = total time limit):
  $$\text{Points} = \text{round}\left( 1000 \times \left( 1 - \frac{t}{2 \times T} \right) \right)$$
- If an attendee answers correctly in 0.5 seconds on a 20s question:  
  $\text{Points} = 1000 \times (1 - 0.5/40) \approx \mathbf{988\text{ pts}}$.
- If an attendee answers correctly at the last second (19.9s):  
  $\text{Points} = 1000 \times (1 - 19.9/40) \approx \mathbf{502\text{ pts}}$.
- Incorrect answer: **0 points**.

---

## 6. Database Schema Specification

### 6.1 Database Choice: Firebase Stack (Recommended for 0ms In-Memory Latency)
- **Firestore**: Master storage for `attendees`, `games`, `questions`, and `historical_leaderboards`.
- **Firebase Realtime Database (RTDB)**: Ultra-fast in-memory tree for live `active_rooms`, active question timers, and attendee answer submissions.

---

### 6.2 Data Models (Firestore Document Structure)

#### Collection: `attendees`
```typescript
interface AttendeeDoc {
  uniqueCode: string;          // PK: "DFR26-9812"
  name: string;                // "Rohan Sharma"
  email: string;               // "rohan@example.com"
  phone: string;               // "9876543210"
  trackId: "conference-only" | "beginner-track" | "flagship-dev";
  organization: string;        // "BIT Mesra"
  designation: string;         // "Android Developer"
  attendanceVerified: boolean; // true
  verifiedAt: number;          // Timestamp
}
```

#### Collection: `games`
```typescript
interface GameDoc {
  gameId: string;              // "mcq-cloud-run-battle"
  title: string;               // "Google Cloud & AI Architecture Battle"
  description: string;         // "Fastest fingers first for Cloud & Android experts"
  gameType: "SYNCHRONIZED_MCQ";
  trackTarget: "all" | "conference-only" | "beginner-track" | "flagship-dev";
  status: "DRAFT" | "READY" | "LIVE" | "COMPLETED" | "ARCHIVED";
  roomCode: string;            // "DFR420"
  totalQuestions: number;      // 10
  createdAt: number;
  updatedAt: number;
}
```

#### Subcollection: `games/{gameId}/questions/{questionId}`
```typescript
interface QuestionDoc {
  questionId: string;          // "q-01"
  order: number;               // 1
  prompt: string;              // "What is the primary difference between Gemini 1.5 Pro and Flash?"
  mediaUrl?: string;           // Optional photo / diagram URL
  icon?: string;               // "Sparkles" / "Cpu"
  options: {
    id: string;                // "opt_1", "opt_2", "opt_3", "opt_4"
    text: string;
    mediaUrl?: string;
  }[];
  correctOptionId: string;     // "opt_2" (Kept server-side during gameplay)
  timeLimitSeconds: number;    // 15
  pointsMultiplier: number;    // 1.0
  explanation: string;         // Brief tech explanation shown on breakdown
}
```

---

### 6.3 Real-Time State Tree (Firebase RTDB Schema)

#### Node: `/live_rooms/{roomCode}`
```json
{
  "roomCode": "DFR420",
  "gameId": "mcq-cloud-run-battle",
  "trackTarget": "flagship-dev",
  "status": "QUESTION_ACTIVE",
  "currentQuestionIndex": 3,
  "totalQuestions": 10,
  "questionStartedAt": 1793442150000,
  "timeLimitSeconds": 15,
  "isPaused": false,
  "attendeeCount": 428,
  "activeQuestion": {
    "order": 4,
    "prompt": "What is the primary difference between Gemini 1.5 Pro and Flash?",
    "mediaUrl": "https://devfest.ranchi/diagrams/gemini-arch.png",
    "options": [
      { "id": "opt_1", "text": "Pro is open-source; Flash is proprietary" },
      { "id": "opt_2", "text": "Flash is optimized for low-latency & high-frequency tasks" },
      { "id": "opt_3", "text": "Flash only accepts text inputs" },
      { "id": "opt_4", "text": "Pro does not support 1M+ token context" }
    ]
  }
}
```

#### Node: `/room_submissions/{roomCode}/{questionIndex}/{uniqueCode}`
```json
{
  "uniqueCode": "DFR26-9812",
  "name": "Rohan Sharma",
  "trackId": "flagship-dev",
  "selectedOptionId": "opt_2",
  "clientSubmittedAt": 1793442152400,
  "serverReceivedAt": 1793442152430,
  "timeElapsedMs": 2430,
  "pointsEarned": 919
}
```

---

## 7. Neo-Brutalist UI & Visual Styling Blueprint

All screens must strictly comply with `THEME.md`:
- **Canvas Background**: `#FFFBF0` (Ranchi Sand)
- **High-Contrast Borders**: Solid `border-2 border-black` or `border-[3px] border-black`
- **Offset Drop Shadows**: `shadow-[3px_3px_0_0_#000]` and `shadow-[5px_5px_0_0_#000]`
- **Google 4-Color Action Matrix**:
  - Choice A: `bg-gdgRed` (`#EA4335`) with white bold text
  - Choice B: `bg-gdgBlue` (`#4285F4`) with white bold text
  - Choice C: `bg-gdgYellow` (`#FBBC05`) with black bold text
  - Choice D: `bg-gdgGreen` (`#34A853`) with white bold text

```
┌─────────────────────────────────────────────────────────┐
│ [4-Color Stripe Top Border]                             │
│ Q. 04 of 10                       ⏳ 00:08 (Pulsing)    │
│ ─────────────────────────────────────────────────────── │
│ Which Google Cloud service provides fully managed       │
│ serverless containers with automated scaling?           │
│                                                         │
│ [ Diagram / Code Snippet Card with 2px Black Border ]   │
│                                                         │
│ ┌───────────────────────────┐ ┌───────────────────────┐ │
│ │ ▲ A. Compute Engine       │ │ ◆ B. Cloud Run        │ │
│ │ (Red Card, 3px Shadow)    │ │ (Blue Card, 3px Shadow│ │
│ └───────────────────────────┘ └───────────────────────┘ │
│ ┌───────────────────────────┐ ┌───────────────────────┐ │
│ │ ● C. Cloud Functions      │ │ ■ D. GKE Standard     │ │
│ │ (Yellow Card, 3px Shadow) │ │ (Green Card, 3px Shado│ │
│ └───────────────────────────┘ └───────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Admin Control Deck (Master Operations Panel)

The Admin Deck is built for the GDG Stage Operator running on a laptop connected to the auditorium control booth:

1. **Attendee CSV / Sheet Drag-and-Drop Ingester**:
   - Parses Commudle/Google Forms export in real-time.
   - Cleans duplicate names/phone numbers.
   - Validates that `uniqueCode` exists for every ticket.
   - Batch writes up to 1,000 attendees into Firestore in under 3 seconds.

2. **Question Bank & Game Builder**:
   - Add/edit up to 15 questions per quiz.
   - Upload diagram images or paste public image URLs.
   - Set custom time limits (10s – 60s).
   - "Test Run Simulator" mode (simulate 50 fake answering bots to verify sync before stage launch).

3. **In-Flight Stage Controls**:
   - **`START COUNTDOWN`**: Triggers synchronised 3s countdown on all devices.
   - **`PAUSE GAME`**: Instantly freezes client clocks and locks options (useful if speakers are explaining a concept or if there is an audio delay).
   - **`RESUME GAME`**: Resumes remaining time.
   - **`NEXT QUESTION`**: Advances the room.
   - **`REVEAL LEADERBOARD`**: Displays top 5 participants.
   - **`FINISH & SHOW PODIUM`**: Confetti cannon + stage-wide winners display with verifiable ticket codes.

---

## 9. Security & Access Rules

### 9.1 Database Security Rules (Firebase RTDB Example)
```json
{
  "rules": {
    "live_rooms": {
      "$roomCode": {
        ".read": true,
        ".write": "auth != null && auth.token.admin === true"
      }
    },
    "room_submissions": {
      "$roomCode": {
        "$questionIndex": {
          "$uniqueCode": {
            ".read": "auth != null && auth.token.admin === true",
            ".write": "
              !data.exists() && 
              newData.exists() &&
              root.child('live_rooms').child($roomCode).child('status').val() === 'QUESTION_ACTIVE' &&
              root.child('live_rooms').child($roomCode).child('currentQuestionIndex').val() == $questionIndex
            "
          }
        }
      }
    }
  }
}
```
*Guarantees:*
- Attendees can only submit **once per question** (`!data.exists()`).
- Submissions are rejected if the room state is not `QUESTION_ACTIVE`.
- No participant can view or inspect other attendees' submissions.

---

## 10. Step-by-Step Implementation Roadmap

```
Phase 1: Ingestion & Verification (Day 1 - 2)
├── Build CSV Ingestion utility in Admin panel
├── Firestore schema setup & batch insertion script
└── Attendee self-verification screen & localStorage persistence

Phase 2: Question Management & Game Creation (Day 3 - 4)
├── Game Creator UI with Neo-Brutalist design tokens
├── Question Editor with media upload & icon selectors
└── Room code generation & track assignment logic

Phase 3: Real-Time Engine & Live Synchronizer (Day 5 - 6)
├── Firebase RTDB room orchestrator & state broadcaster
├── Server-clock synchronization & latency compensation
└── Admin Control Deck (Start, Pause, Resume, Next, Finish)

Phase 4: Client Player & Stage Presentation (Day 7 - 8)
├── Mobile Attendee Gameplay UI (haptic feedback, sound cues)
├── Stage 16:9 Projector / LED Screen Display with live charts
└── Real-time leaderboard aggregation & Grand 3D Podium

Phase 5: Load Testing & Venue Dry-Run (Day 9)
├── 800-bot headless artillery load test
└── Network latency & offline reconnection validation
```

---

*Authored for GDG Ranchi Tech Team — DevFest 2026 Live Operations.*
