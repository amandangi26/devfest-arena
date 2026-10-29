# DevFest Ranchi 2026 — Live Game Engine Operator Runbook

> **Event:** DevFest Ranchi 2026  
> **Venue:** Radisson Blu, Ranchi, Jharkhand  
> **Date:** October 31, 2026  
> **Target Scale:** 800+ Simultaneous Live Attendees across 3 Specialized Tracks  
> **System Status:** Production Ready

---

## 1. Quick URL Directory & Network Ports

| Role | Interface | URL Path | Credentials / Notes |
| :--- | :--- | :--- | :--- |
| **Stage Presenter** | Auditorium LED Screen Projection (16:9) | `https://game.devfestranchi.in/stage` or `/stage/:roomCode` | Fullscreen toggle with `F` or UI button. No credentials required. |
| **Stage Operator** | Master Operator Cockpit & Battle Controller | `https://game.devfestranchi.in/admin` | Requires Admin Secret Key (`x-admin-key`). |
| **Live Arena Display** | Public Spectator Leaderboard | `https://game.devfestranchi.in/arena` | Displays active stage quiz rankings + catalog demo leaderboards. |
| **Mobile Attendee** | Player Interface (Smartphones) | `https://game.devfestranchi.in/play` or `/play/:roomCode` | Zero-password verification (Unique Ticket Code + Email/Phone cross-check). |
| **Health Check** | Systems Diagnostic Endpoint | `https://game.devfestranchi.in/api/health` | Returns database status, memory usage, and active room count. |

---

## 2. Pre-Event Preparation Checklist (T-minus 2 Hours)

### Step 2.1: Attendee Ingestion (Commudle & Google Forms CSV)
1. Open `https://game.devfestranchi.in/admin` and enter the `ADMIN_API_KEY`.
2. Navigate to the **CSV Ingestion** tab.
3. Export the latest registration roster from Commudle (or Google Forms).
4. Click **Choose File** or paste the raw CSV data into the input box.
   - *Supported Formats:* Standard 25-column Commudle export, Google Forms, or standard CSV with headers: `Unique Code`, `Name`, `Email`, `Phone Number`, `Track`.
5. Click **Execute Batch Ingestion**.
6. Verify the summary report:
   - Ensure `quarantinedCount` is 0 or inspect quarantined rows (e.g. malformed ticket codes or duplicate email entries).
   - Verify track breakdowns for `flagship-dev`, `beginner-track`, and `conference-only`.

### Step 2.2: Quiz Verification & Version Freezing
1. In the Admin console, switch to the **Game Builder** tab.
2. Select your prepared quiz (e.g. *DevFest Ranchi 2026 Flagship Battle*).
3. Review question prompts, code snippets, timers (15s–30s recommended), and verify that each question has a valid **Correct Option** selected.
4. Click **Publish Version Snapshot**.
   - *Security Guarantee:* This creates an immutable, cryptographically locked snapshot (`game_versions`). Once published, questions cannot be altered during live gameplay.

### Step 2.3: Stage Screen Setup
1. Connect the stage presentation laptop to the main auditorium HDMI/DisplayPort output.
2. Open Chrome/Edge and navigate to `/stage`.
3. Press `F11` or click the **Fullscreen** button on the top-right to enter 16:9 borderless presentation mode.

---

## 3. Live Match Execution Protocol (Stage Operator Workflow)

```
[Create Room] ──> [LOBBY] ──> [COUNTDOWN] ──> [QUESTION_ACTIVE] ──> [QUESTION_LOCKED] ──> [QUESTION_RESULT] ──> [LEADERBOARD] ──> [GAME_OVER]
                      │                                │
                      ▼                                ▼
              Attendees Enter PIN              Attendees Submit Answers
              (Live Counter on Stage)          (Speed-Weighted Points)
```

### 3.1: Room Initialization
1. In the **Live Arena Cockpit** (`/admin`), locate the **Launch Battle Room** card.
2. Select your published quiz from the dropdown.
3. Choose the target audience track:
   - `All Tracks (General Audience)` — Open to any verified attendee.
   - `Flagship Dev Track` — Restricted to Flagship Dev badge holders.
   - `Beginner Track` — Restricted to Beginner Track participants.
4. Click **Launch Live Battle Room**.
5. A 6-character room PIN is generated (e.g. `7ZR4HW`).

### 3.2: Lobby & Audience Check-in (3 to 5 Minutes)
1. The stage screen displays the 6-character room PIN and QR code.
2. Announce over the auditorium PA:
   > *"Open your phones to game.devfestranchi.in/play and enter room PIN [PIN]. Verify with your ticket code!"*
3. Watch the **Connected Builders** counter increment live on stage.
4. When 70%+ of the auditorium is connected, prepare the stage presenter for countdown.

### 3.3: Question Lifecycle Flow
1. **Trigger Countdown:** Click **Start 3s Countdown**.
   - Stage and mobile devices synchronously play the 3-2-1 visual countdown.
2. **Question Active:** The state machine transitions to `QUESTION_ACTIVE`.
   - The question prompt, code snippet, and 4 Google-colored choices appear on all devices.
   - The server timer begins decrementing (browser timers are display-only).
   - Live submission counters show how many builders have locked in their choices.
3. **Question Locked:** When the server timer expires (plus 600ms network grace period), submissions lock automatically.
4. **Reveal Results:** Click **Reveal Answer & Distribution**.
   - The auditorium screen reveals the correct choice with a green check and shows the audience response distribution bar chart.
5. **Display Leaderboard:** Click **Show Top 10 Standings**.
   - Stage displays the top 10 rankings, scores, and fastest correct responders.
6. **Next Question:** Click **Advance to Question [N+1]** and repeat.
7. **Final Grand Finale:** After the last question, advance to `GAME_OVER`.
   - The auditorium screen displays the animated 3-step physical podium for 1st, 2nd, and 3rd place winners with confetti effects!

---

## 4. Emergency & Failure Contingency Procedures

### Scenario A: Venue Wi-Fi Congestion / High Latency
- **Symptom:** Attendees report delayed timer countdowns or slow page loads.
- **System Defense:**
  - Timer deadlines are enforced **authoritatively on the server**. A 600ms grace allowance is built into all deadline checks to absorb 4G/Wi-Fi packet delays.
  - Answers are submitted via lightweight, compressed POST requests (< 300 bytes) with client-side tap locks.
- **Operator Action:**
  - If latency spikes dramatically, pause the question using the **Pause Battle** button in the cockpit. This freezes remaining time for all participants until Wi-Fi stabilizes, then click **Resume Battle**.

### Scenario B: Accidental Operator Mis-click or Disruptive Question
- **Operator Action:**
  - Click **Pause Battle** immediately.
  - Use the cockpit to skip forward or advance to the next question.

### Scenario C: Stage Projection Laptop Reboots or Refreshes
- **System Defense:**
  - State is entirely persisted on the authoritative backend.
  - Simply re-open `/stage/:roomCode`. The presentation view immediately reconnects to the SSE stream and restores the exact live state within 200ms.

### Scenario D: Participant Claims They Submitted, But Score Missing
- **Protocol:**
  1. Go to **Roster** tab in the Admin console.
  2. Search by attendee's name or unique ticket code.
  3. Verify their `ticket_verified_at` and `attendance_status`.
  4. Inspect the audit log: Every answer is atomically stored with timestamp down to the millisecond (`server_received_at`).

### Scenario E: Database Connection Loss (Supabase Outage)
- **Automatic Fallback:**
  - If Supabase becomes unreachable or network egress drops, the engine automatically falls back to the in-memory store (`memoryStore.js`).
  - Active game sessions, attendee logins, and live scores continue operating in memory without interruption.

---

## 5. Security & Privacy Guarantees

1. **No Client-Side Secrets:** Client bundles contain zero API secret keys, database service keys, or question answer keys.
2. **Hidden Answer Keys:** Active questions stripped of `correctOptionId` and `explanation` until the operator triggers `QUESTION_RESULT`.
3. **No Ticket Codes on Screens:** Public stage displays and leaderboards strictly display sanitized public names (`Aman D.`) and organization. Ticket codes, phone numbers, and full emails are never projected.
4. **Idempotency Guarantee:** Answer submissions are uniquely keyed by `${roomCode}_q${index}_${attendeeId}`. Even if a participant taps rapidly or their mobile browser retries on flaky Wi-Fi, exactly one answer is recorded. Duplicate requests receive HTTP 409 and 0 duplicate points.

---

*DevFest Ranchi 2026 Core Organizing Team • Live Interactive Game Engine Operations*
