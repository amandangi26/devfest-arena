# DevFest Ranchi 2026 — Game Engine Architecture Review

**Review target:** `DevFest Ranchi 2026 — Live Interactive Game Engine`  
**Review type:** Architecture, security, data integrity, realtime concurrency, and event-readiness review  
**Verdict:** **Revise before implementation**  
**Scope:** This review evaluates the Markdown design only. It does not certify an implementation, Firebase project, or load-test result.

---

## 1. Executive verdict

The product direction is strong: unified attendee data, track-targeted games, reusable MCQ games, room codes, an operator console, stage display, and a future module system are all appropriate.

The document is **not yet safe to label “Architecture Approved for Implementation.”** It contains insecure client-session assumptions, overly broad Firebase rules, an answer-ingestion design that can lose data, and performance statements that have not been demonstrated by testing.

### Keep

- One canonical attendee dataset with track membership.
- Ticket code as the primary external attendee identifier.
- Shared email/phone handling without treating either as unique.
- Separate game definitions and live sessions.
- Correct answers kept off participant payloads until reveal.
- Server-controlled lifecycle and scoring.
- RTDB as a possible realtime transport/state projection.
- Track-specific and event-wide game modes.
- Admin audit trail, load testing, and event-day fallback procedures.

### Must change before implementation

1. Do not use browser `localStorage` as authentication or store a client-visible “HMAC signature” as proof of identity.
2. Do not allow public reads of the entire live-room object.
3. Do not allow attendee browsers to write trusted answer records or scores directly to RTDB.
4. Do not use a serverless instance's in-memory map as the authoritative score/answer store.
5. Define server-authoritative deadlines, pause/resume semantics, idempotency, and durable state transitions.
6. Replace the claim that a batch of 1,000 attendees will always import in under three seconds with a measured target.
7. Correct the Firestore write/read-limit discussion and test the actual selected Firebase plan.
8. Treat `trackId` as a many-to-many membership when a ticket holder may appear in more than one track list.
9. Define whether `attendanceVerified` means event check-in or merely successful ticket verification; these are different facts.
10. Do not publish attendee ticket codes on a public stage leaderboard.

---

## 2. Severity-ranked findings

| Severity | Finding | Required correction |
|---|---|---|
| Critical | Browser `localStorage` contains attendee identity and a purported signature | Use a server-issued, revocable session; prefer a `Secure`, `HttpOnly`, `SameSite` cookie for a same-origin web app |
| Critical | RTDB rules permit public reads of `/live_rooms/{roomCode}` | Publish only a minimal, non-sensitive public projection; protect attendee-specific and admin-only data separately |
| Critical | RTDB answer rules allow client writes based on path/state alone | Submit answers through a trusted server endpoint/Cloud Function; server verifies identity, participation, option, deadline, and idempotency |
| Critical | Client can potentially supply identity/score fields | Ignore client-supplied points, correctness, track, name, and authoritative timestamps; derive them on the server |
| Critical | In-memory aggregation is described as an authoritative worker | Persist each accepted answer durably; compute/rebuild aggregates from durable records |
| High | Question timing has no fully specified durable transition worker | Store canonical server timestamps/deadlines and use idempotent durable transition processing |
| High | Game and attendee data models mix identity, public projection, and sensitive fields | Separate restricted attendee records from safe participant and public leaderboard projections |
| High | “1,000 attendees under 3 seconds” is presented as guaranteed | Treat as a benchmark target, measure on the selected plan, and make import resumable/idempotent |
| High | The 640,000-read calculation is presented as inevitable | Model listener paths and payloads; measure actual read/download behavior rather than assuming this number |
| High | `trackId` is a single enum despite three separate source files and possible multi-track membership | Use an `attendee_tracks` relation or equivalent membership collection |
| High | Ticket verification can become an enumeration oracle | Use generic failure responses, rate limits, bounded lockouts, and monitoring |
| Medium | Room code is a six-character PIN but entropy/rotation/abuse policy is undefined | Generate unpredictable codes, hash at rest where practical, throttle attempts, and rotate/revoke |
| Medium | Scoring formula is not clamped or fully defined at boundaries | Define accepted-answer interval, clamp elapsed time, round consistently, and compute on the server |
| Medium | `attendanceVerified` is ambiguous | Separate `ticketVerifiedAt` from `checkedInAt` / attendance status |
| Medium | Public podium proposes verifiable ticket codes | Use a public display name; let authorized admins verify identity privately |

---

## 3. Corrected attendee verification design

### Do not use this design

The original flow stores this in `localStorage`:

```json
{
  "uniqueCode": "DFR26-9812",
  "name": "Aman Dangi",
  "email": "aman@example.com",
  "trackId": "flagship-dev",
  "verifiedAt": 1793442000000,
  "signature": "hmac_sha256_verification_token"
}
```

A signature created or validated only in browser code is not a trust boundary. Anything stored in `localStorage` can be read or modified by the user and by injected JavaScript running in the origin. A client-visible signature must not be treated as a credential unless it is a properly issued, server-validated token with an appropriate threat model; even then, storing a bearer token in `localStorage` increases exposure to XSS.

### Recommended flow

1. Attendee enters the ticket unique code and one allowed contact cross-check (email or phone), plus name if required by the event policy.
2. Server normalizes the inputs and performs the match against the imported record.
3. Server returns the same generic failure response for invalid combinations; it does not say which field matched or whether the ticket exists.
4. On success, server creates a random, revocable session and stores only a hash of its token server-side.
5. Server sets the session cookie with `Secure`, `HttpOnly`, and an appropriate `SameSite` policy; apply CSRF protection to cookie-authenticated state-changing requests as required by the deployment.
6. The browser may cache non-sensitive display state, but the server session is the proof of verification.
7. Every join/answer request rechecks the attendee session, track eligibility, participation, session state, and deadline.
8. Provide session expiry, revocation, and a device-reset/rebind process.

**Important:** Ticket verification and venue check-in are separate. Do not set `attendanceVerified = true` just because the user passed ticket verification unless the field is explicitly renamed to reflect that meaning.

### Shared email or phone

Do not enforce unique email or phone. Use `(eventId, uniqueCode)` as the unique external ticket key when the source guarantees uniqueness. If a ticket code is missing or conflicts between imports, quarantine that row for admin review; never guess which attendee it represents.

---

## 4. Corrected Firebase data-access boundary

### Recommended responsibility split

**Firestore (durable records):**
- Attendee records and track membership.
- Game definitions and immutable published versions.
- Question and option content, including server-only answer keys.
- Game sessions and participation.
- Accepted answers and scoring outcomes.
- Audit events and final result records.

**Realtime Database (live transport/projection):**
- Minimal live session state: lifecycle status, current question index, public question payload, server deadline, state version, and non-sensitive counters.
- Public leaderboard projection containing only the approved display name and score/rank.
- No raw attendee collection, full email/phone, ticket ID, correct answer, or private answer history in a publicly readable node.

**Trusted server/Cloud Functions:**
- Verify attendee ticket details.
- Issue/revoke sessions.
- Create/join rooms.
- Start/pause/resume/advance/end sessions.
- Validate and accept answers.
- Compute scores and rankings.
- Write authoritative state and audit events.

### Do not let clients write trusted scores

The attendee client should submit only a minimal command such as:

```json
{
  "questionId": "q-04",
  "selectedOptionId": "opt-2",
  "idempotencyKey": "random-per-submission-value"
}
```

The server derives the attendee identity from the validated session, checks the active session and question deadline, verifies that the option belongs to the question, calculates correctness and points, and persists the result atomically/idempotently.

Do not accept these as authoritative client values:

- `uniqueCode`
- `name`
- `trackId`
- `serverReceivedAt`
- `timeElapsedMs`
- `pointsEarned`
- `isCorrect`
- `rank`

The server may use a client-provided idempotency key, but it must scope and validate it and must not use it as identity.

### RTDB rules posture

The original example rules are **not suitable for production**. In particular, public read access to an entire room node can expose fields added there in the future, and the proposed submission rule does not validate the complete payload or establish trusted identity.

For a server-mediated design, begin with a deny-by-default posture for private RTDB paths and allow only the minimal read access needed for authenticated participants. Use server code for writes to authoritative paths. If a public display needs unauthenticated reads, create a separate deliberately public projection that contains only safe fields and is independently reviewed.

Illustrative restrictive starting point—not a complete deployable policy:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "live_public": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": false
      }
    }
  }
}
```

This is only a posture illustration. The actual rules must match the chosen authentication design, room access policy, and whether the stage display is public. Test the exact rules with the Firebase Emulator Suite. Remember that privileged Admin SDK code bypasses Firebase Security Rules and therefore needs its own authorization and validation.

---

## 5. Corrected real-time engine

### Authoritative session fields

Persist the following for each session/question transition:

- `status`
- `stateVersion`
- `currentQuestionId` / `currentQuestionIndex`
- `questionStartedAt` (server/database timestamp)
- `questionDeadlineAt` (server/database timestamp)
- `pausedAt` (nullable)
- `remainingTimeMsAtPause` (nullable)
- `endedAt` (nullable)
- `transitionId` or another idempotency guard

All state changes should be validated against an allowed state-transition table and committed durably. A retry must not start a second countdown, award duplicate points, or advance two questions.

### Question timing

1. Server commits the active question and canonical deadline.
2. Server broadcasts the safe question payload and deadline.
3. Clients display a countdown derived from server-synchronized time.
4. The server decides whether an answer is on time using its own receive/acceptance policy.
5. A durable transition processor locks the question and moves to results/next question once.
6. On reconnect, the client fetches current state before resuming realtime subscriptions.

The browser timer is a display. It must never decide correctness or final acceptance.

### Pause and resume

Recommended semantics:

- Pause is committed server-side and rejects new answers after the pause transition.
- Store the remaining duration at the moment of pause.
- Resume computes a new deadline using server time and the saved remaining duration.
- The client receives a new `stateVersion` and deadline.
- Duplicate pause/resume requests are idempotent or return a conflict response.

### Durable answers and aggregation

Do not use an in-memory map as the sole score store. Serverless instances are not a shared durable process; concurrent requests can land on different instances and an instance restart can lose state.

Use one durable accepted-answer record per attendee/question/session, protected by a unique constraint or equivalent transaction guard. Derive aggregates from accepted records. A cached/RTDB leaderboard is a projection that can be rebuilt from durable data.

For this audience size, do not assume a separate queue is required from day one. First implement correct durable writes, idempotency, bounded writes, and targeted broadcasts; load-test it. Introduce a queue or worker only if measured throughput, retries, or ranking computation justify it.

---

## 6. Scoring corrections

The proposed formula is:

`round(1000 × (1 − t / (2 × T)))`

It produces approximately 500 points for a correct answer at the deadline and 1000 near zero elapsed time. That is a reasonable possible policy, but specify its boundary behavior.

Recommended definition:

- If the answer is wrong: `0`.
- If the answer is late, submitted after the question is locked, or submitted while paused: reject it; do not score it.
- For accepted correct answers, compute elapsed time using trusted server-side timestamps.
- Clamp elapsed time to `[0, T]` before applying the formula.
- Clamp the result to `[0, 1000]` and round using one documented method.
- Apply a question multiplier only if it is bounded and included in the published game version.
- Do not calculate speed from `Date.now()` supplied by the client.
- Define the deadline grace policy explicitly. If there is a small server-processing allowance, document it and use the same rule consistently.

Example:

```ts
function scoreCorrectAnswer(elapsedMs: number, timeLimitMs: number): number {
  const safeLimit = Math.max(1, timeLimitMs);
  const safeElapsed = Math.min(safeLimit, Math.max(0, elapsedMs));
  const raw = 1000 * (1 - safeElapsed / (2 * safeLimit));
  return Math.max(0, Math.min(1000, Math.round(raw)));
}
```

This function is only the deterministic scoring calculation. The caller must first establish that the answer was accepted, correct, and on time using trusted server-side state.

---

## 7. Data-model changes

### Attendees

Use a canonical record with a stable internal ID and unique event ticket code:

```ts
interface Attendee {
  id: string;
  eventId: string;
  uniqueCode: string;
  name: string;
  emailNormalized?: string;
  phoneNormalized?: string;
  organization?: string;
  designation?: string;
  registrationStatus?: string;
  attendanceStatus?: "unknown" | "checked_in" | "not_attending";
  ticketVerifiedAt?: number;
  createdAt: number;
  updatedAt: number;
}
```

Do not make email or phone unique. Store track membership separately:

```ts
interface AttendeeTrack {
  attendeeId: string;
  trackId: "conference-only" | "beginner-track" | "flagship-dev";
  sourceImportId: string;
}
```

This avoids losing a legitimate multi-track attendee and supports an overall event game.

### Games and versions

Separate the reusable game definition from each live run:

- `gameDefinitions`: title, module type, visibility, allowed tracks, lifecycle/archive state.
- `gameVersions`: immutable published question/scoring configuration.
- `gameSessions`: one run bound to one immutable version.
- `participations`: one attendee's participation in a session.
- `acceptedAnswers`: one accepted response per configured submission scope.
- `auditEvents`: admin actions and manual corrections.

Do not overwrite the published question set for an active session. Create a new draft/version instead.

### Question payload security

Keep `correctOptionId` and any answer explanation that must remain hidden in a server-only record or protected field. Participant reads should use an explicit safe DTO containing only the question prompt, media, option IDs/text/media, time limit, and deadline metadata.

Do not serialize a full question database object and hope that frontend code hides the correct answer.

---

## 8. Import pipeline corrections

Replace “batch writes up to 1,000 attendees in under 3 seconds” as a guarantee with a measured objective.

Required import behavior:

1. Admin uploads a supported file to a restricted endpoint/storage location.
2. Validate file size, row count, expected columns, and file format.
3. Preview normalized rows and conflicts before commit.
4. Use stable idempotency keys for import jobs and row processing.
5. Keep valid rows, rejected rows, and conflicts separately reported.
6. Never merge records only because email/phone/name matches.
7. Preserve ticket codes as strings to avoid losing leading zeroes.
8. Use a resumable batch process with bounded concurrency and retries.
9. Audit the operator, source file, track mapping, counts, and result.
10. Delete temporary source uploads according to the agreed retention policy.

Do not use title-casing as an identity operation; preserve the source name and use a separate display transformation if needed.

---

## 9. Corrected performance assumptions for 800 attendees

- 800 active connections are not inherently beyond Firebase RTDB's published Blaze-plan connection limit, but the selected plan, concurrent response/broadcast rate, bandwidth, listener structure, and write rate still matter.
- The stated 640,000 reads are not an automatic outcome of 800 submissions. The actual cost and workload depend on where listeners subscribe and what data is returned.
- A single broadcast may reduce repeated per-client state writes, but it does not prove low latency or eliminate bandwidth/response fan-out.
- A single shared mutable counter or leaderboard document can become a contention hotspot.
- Do not write all answers into one array or one hot room document.
- Keep attendee answer writes independent and durable; broadcast aggregate updates on a controlled cadence.
- Keep live public state small and separate from sensitive records.
- Test 800 connected clients, a burst of answers within four seconds, reconnect storms, multiple simultaneous track games, and temporary database/realtime failure.
- Measure p50/p95/p99 API latency, answer acceptance rate, duplicate rejection, realtime propagation, database load, egress, and error rate.
- Confirm Firebase plan limits and cost assumptions in the project console before launch.

Suggested initial acceptance targets (to validate in the deployed environment, not guaranteed performance):

- 800 simulated connected clients stay within plan limits.
- No duplicate accepted answer creates duplicate points.
- No accepted answer is lost after a successful server confirmation.
- Reconnect restores current authoritative state.
- Final leaderboard matches durable accepted-answer records.
- Operators can pause/end a session and recover from a temporary realtime outage.

---

## 10. Product and UX refinements

- Keep public leaderboard identity to a chosen display name or safe first-name/initial format. Never show ticket codes as public verification evidence.
- Give admins a restricted identity lookup to verify winners against the imported ticket record.
- Make the public stage display consume only the public leaderboard projection.
- Provide an accessible reduced-motion mode; confetti and haptics must be optional enhancements, not requirements.
- Avoid exposing full attendee count or attendee identity details if event policy considers them private.
- Keep SVG handling strict: sanitize/allowlist uploaded SVGs or prefer raster images for user-uploaded media. Never inject arbitrary SVG/HTML.
- Support mobile browsers, reconnect states, duplicate submit feedback, and low-bandwidth behavior.
- Include a clear operator runbook and offline/manual fallback.

---

## 11. Implementation order

### Phase 1 — Security and data foundation
- Choose Firebase-only architecture or Supabase; do not mix data authority between two stacks without a clear need.
- Configure environments, secrets, roles, and deny-by-default rules.
- Build canonical attendee schema, track memberships, and audited import preview.
- Implement secure ticket verification and revocable session handling.

### Phase 2 — Game builder
- Create module registry and MCQ schema validation.
- Build drafts, preview/test mode, publish/version, duplicate, and archive.
- Keep answer keys server-only.
- Validate question count and timing bounds.

### Phase 3 — Session engine
- Implement durable state machine, room access, track eligibility, and admin controls.
- Add server-authoritative deadline and idempotent transitions.
- Add trusted answer endpoint and durable accepted-answer records.

### Phase 4 — Live UI and leaderboard
- Implement targeted RTDB public projection and client state resync.
- Implement answer feedback, results reveal, and leaderboard.
- Reconcile final scores from durable accepted answers.

### Phase 5 — Hardening and rehearsal
- Test rules in Firebase Emulator Suite.
- Test all role boundaries and data leakage.
- Run the 800-client load scenario on the actual production plan.
- Test database/realtime outages and reconnect storms.
- Rehearse operator pause/end, support flow, and manual fallback.
- Freeze features before event day.

---

## 12. Go-live checklist

- [ ] `localStorage` is not used as the authentication authority.
- [ ] Attendee session is revocable and expires.
- [ ] Ticket verification is rate-limited and has generic failure responses.
- [ ] Attendee email/phone are not unique constraints.
- [ ] Multi-track membership is supported.
- [ ] Public room state contains no private attendee data or answer key.
- [ ] Client cannot directly write trusted scores or accepted-answer records.
- [ ] Server validates the session, track, participation, question, option, and deadline.
- [ ] Answer writes are durable and idempotent.
- [ ] Question transitions are durable and idempotent.
- [ ] Pause/resume preserves remaining time correctly.
- [ ] Published game versions are immutable.
- [ ] Admin actions and manual score corrections are audited.
- [ ] RTDB/Firestore security rules are tested in emulators.
- [ ] Admin SDK code independently enforces authorization.
- [ ] 800-client test has been run on the intended production plan.
- [ ] Realtime reconnect and server recovery have been rehearsed.
- [ ] Public leaderboard does not expose ticket codes or contact information.
- [ ] Event-day fallback and operator contacts are documented.

---

## 13. Official references to consult

- Firebase Realtime Database limits: https://firebase.google.com/docs/database/usage/limits
- Firebase Realtime Database security: https://firebase.google.com/docs/database/security
- Firebase guidance on insecure rules: https://firebase.google.com/docs/rules/insecure-rules
- Firebase Admin SDK and rule behavior: https://firebase.google.com/docs/database/admin/start
- Firebase Realtime Database performance optimization: https://firebase.google.com/docs/database/usage/optimize

**Final decision:** Keep the product design and visual direction, but revise the security/session model, authoritative answer path, and durable state engine before development. Do not describe 800-user stability as achieved until the deployed system passes a representative load test.
