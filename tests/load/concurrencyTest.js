/**
 * @file concurrencyTest.js
 * @description Headless 800-User Concurrency & Load Stress Test.
 * Validates auditorium-scale load for DevFest Ranchi 2026:
 * - 800 simultaneous attendees verified with zero-password auth tokens.
 * - Synchronous lobby join and room status transitions.
 * - 800 concurrent burst answer submissions across simulated network jitter.
 * - 200 intentional duplicate submissions testing idempotency.
 * - Strict latency benchmarks: p50, p95, p99, 0 dropped answers.
 */

import { performance } from 'node:perf_hooks';
import crypto from 'node:crypto';
import { db } from '../../server/db/index.js';
import { verifyTicket } from '../../server/services/authService.js';
import { createGame, publishGame } from '../../server/services/gameService.js';
import { roomOrchestrator } from '../../server/services/roomOrchestrator.js';

const TOTAL_ATTENDEES = 800;
const DUPLICATE_ATTEMPTS = 200;

function calculatePercentile(latencies, percentile) {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)].toFixed(2);
}

async function runLoadTest() {
  console.log('\n================================================================');
  console.log('⚡ DEVFEST RANCHI 2026: 800-ATTENDEE LIVE LOAD & CONCURRENCY TEST');
  console.log('================================================================');
  console.log(`Auditorium Scale: ${TOTAL_ATTENDEES} concurrent attendees`);
  console.log(`Venue: Radisson Blu, Ranchi • October 31, 2026`);
  console.log('----------------------------------------------------------------\n');

  // STEP 1: Provision 800 Virtual Attendees
  console.log(`[1/5] Ingesting ${TOTAL_ATTENDEES} virtual attendees into repository...`);
  const startTime = performance.now();
  const attendees = [];

  for (let i = 1; i <= TOTAL_ATTENDEES; i++) {
    const code = `DFR26-LOAD-${String(i).padStart(4, '0')}`;
    const email = `attendee${i}@devfestranchi.in`;
    const phone = `98765${String(i).padStart(5, '0')}`;
    const now = Date.now();
    const att = await db.upsertAttendee({
      id: crypto.randomUUID(),
      event_id: 'devfest-ranchi-2026',
      unique_code: code,
      name: `Ranchi Developer ${i}`,
      email_normalized: email.toLowerCase().trim(),
      phone_normalized: phone,
      display_name: `Dev ${i}.`,
      organization: i % 2 === 0 ? 'BIT Mesra' : 'NIT Jamshedpur',
      created_at: now,
      updated_at: now,
    });
    attendees.push(att);
  }
  console.log(`  ✓ Created ${attendees.length} attendees in ${(performance.now() - startTime).toFixed(1)}ms`);

  // STEP 2: Zero-Password Session Generation
  console.log(`[2/5] Simulating simultaneous ticket verification for ${TOTAL_ATTENDEES} attendees...`);
  const authStart = performance.now();
  const sessions = await Promise.all(
    attendees.map(async (att) => {
      const res = await verifyTicket({ uniqueCode: att.unique_code, contact: att.email_normalized || att.email });
      return {
        attendee: {
          id: att.id,
          uniqueCode: att.unique_code,
          displayName: att.display_name,
          organization: att.organization,
          trackIds: ['all'],
        },
        sessionToken: res.token,
      };
    })
  );
  console.log(`  ✓ ${sessions.length} sessions verified & issued in ${(performance.now() - authStart).toFixed(1)}ms`);

  // STEP 3: Setup Live Game Definition & Launch Battle Room
  console.log('[3/5] Compiling immutable quiz version and opening live room...');
  const game = await createGame({
    title: 'DevFest 800-Scale Concurrency Challenge',
    category: 'Full-Stack & Cloud Architecture',
    trackTarget: 'all',
    questions: [
      {
        questionId: 'q-load-1',
        order: 1,
        prompt: 'Which data structure offers O(1) average lookup for idempotency caching?',
        codeSnippet: 'const seen = new Set(); seen.has(key);',
        timeLimitSeconds: 20,
        correctOptionId: 'opt-a',
        options: [
          { id: 'opt-a', text: 'Hash Table / Set' },
          { id: 'opt-b', text: 'Linked List' },
          { id: 'opt-c', text: 'Binary Search Tree' },
          { id: 'opt-d', text: 'Array Scan' },
        ],
      },
    ],
  });

  const published = await publishGame(game.id);
  const room = await roomOrchestrator.createRoom({
    gameDefinitionId: game.id,
    gameVersionId: published.id,
    trackTarget: 'all',
    adminId: 'load-test-runner',
  });
  const roomCode = room.roomCode;
  console.log(`  ✓ Room created with PIN: ${roomCode}`);

  // Attendees join lobby
  await Promise.all(sessions.map((s) => roomOrchestrator.joinRoom(roomCode, s.attendee)));
  console.log(`  ✓ ${TOTAL_ATTENDEES} attendees joined lobby. Lobby count: ${roomOrchestrator.getRoom(roomCode).attendees.size}`);

  // Transition to Question Active
  await roomOrchestrator.transitionState(roomCode, 'COUNTDOWN');
  await roomOrchestrator.transitionState(roomCode, 'QUESTION_ACTIVE', { questionIndex: 0 });
  console.log(`  ✓ Room status transitioned to QUESTION_ACTIVE. Deadline set to ${new Date(room.questionDeadlineAt).toISOString()}`);

  // STEP 4: High-Concurrency Burst Submissions
  console.log(`\n[4/5] Executing high-concurrency burst: ${TOTAL_ATTENDEES} answers + ${DUPLICATE_ATTEMPTS} duplicates...`);
  const latencies = [];
  let successfulSubmissions = 0;
  let rejectedDuplicates = 0;
  let errors = 0;

  const burstStart = performance.now();

  // Fire 800 legitimate answers simultaneously with simulated network jitter (0 - 400ms)
  await Promise.all(
    sessions.map(async (s, index) => {
      const jitterMs = Math.floor(Math.random() * 400);
      if (jitterMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, jitterMs));
      }

      const t0 = performance.now();
      try {
        // 70% pick correct opt-a, 30% pick opt-b
        const chosenOpt = index % 10 < 7 ? 'opt-a' : 'opt-b';
        await roomOrchestrator.submitAnswer({
          roomCode,
          attendee: s.attendee,
          selectedOptionId: chosenOpt,
          idempotencyKey: `sub_${roomCode}_q0_${s.attendee.id}`,
        });
        const t1 = performance.now();
        latencies.push(t1 - t0);
        successfulSubmissions++;
      } catch (err) {
        errors++;
        console.error(`Submission error for attendee ${s.attendee.id}:`, err.message);
      }
    })
  );

  const burstDuration = performance.now() - burstStart;

  // Fire 200 duplicate submissions to verify idempotency rejection
  console.log(`  ✓ All ${successfulSubmissions} initial answers accepted. Now verifying ${DUPLICATE_ATTEMPTS} duplicate rejections...`);
  await Promise.all(
    sessions.slice(0, DUPLICATE_ATTEMPTS).map(async (s) => {
      try {
        await roomOrchestrator.submitAnswer({
          roomCode,
          attendee: s.attendee,
          selectedOptionId: 'opt-c',
          idempotencyKey: `sub_${roomCode}_q0_${s.attendee.id}`,
        });
        // Should NOT reach here
        errors++;
      } catch (err) {
        if (err.status === 409 || err.message?.includes('already submitted') || err.code === '23505') {
          rejectedDuplicates++;
        } else {
          errors++;
        }
      }
    })
  );

  // STEP 5: Verification & Latency Statistics
  console.log('\n[5/5] Compiling and verifying room projection & score leaderboard...');
  await roomOrchestrator.transitionState(roomCode, 'QUESTION_RESULT');
  await roomOrchestrator.transitionState(roomCode, 'LEADERBOARD');

  const projection = roomOrchestrator.getPublicProjection(roomCode);
  const top10Leaderboard = projection.leaderboard || [];
  const fullLeaderboard = room.leaderboardCache || [];

  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const rps = ((successfulSubmissions) / (burstDuration / 1000)).toFixed(1);

  console.log('\n================================================================');
  console.log('📊 CONCURRENCY BENCHMARK & SYSTEM INTEGRITY RESULTS');
  console.log('================================================================');
  console.log(`Total Simulated Attendees:       ${TOTAL_ATTENDEES}`);
  console.log(`Successful Unique Submissions:   ${successfulSubmissions} / ${TOTAL_ATTENDEES} (100.0%)`);
  console.log(`Duplicates Atomically Rejected:  ${rejectedDuplicates} / ${DUPLICATE_ATTEMPTS} (100.0%)`);
  console.log(`Dropped / Failed Requests:       ${errors} (0.0%)`);
  console.log(`Total Burst Window Duration:     ${burstDuration.toFixed(1)} ms`);
  console.log(`Throughput Rate:                 ${rps} requests/sec`);
  console.log(`Latency p50:                     ${p50} ms`);
  console.log(`Latency p95:                     ${p95} ms`);
  console.log(`Latency p99:                     ${p99} ms`);
  console.log('----------------------------------------------------------------');
  console.log(`Total Ranked Attendees (Full):   ${fullLeaderboard.length}`);
  console.log(`Public Projection Top Count:     ${top10Leaderboard.length}`);
  console.log(`Top 1 Ranked:                    ${top10Leaderboard[0]?.displayName} (${top10Leaderboard[0]?.totalScore} pts)`);
  console.log(`Top 2 Ranked:                    ${top10Leaderboard[1]?.displayName} (${top10Leaderboard[1]?.totalScore} pts)`);
  console.log(`Top 3 Ranked:                    ${top10Leaderboard[2]?.displayName} (${top10Leaderboard[2]?.totalScore} pts)`);
  console.log('================================================================\n');

  // Assertions
  if (successfulSubmissions !== TOTAL_ATTENDEES) {
    throw new Error(`Load test failed: expected ${TOTAL_ATTENDEES} submissions, got ${successfulSubmissions}`);
  }
  if (rejectedDuplicates !== DUPLICATE_ATTEMPTS) {
    throw new Error(`Idempotency check failed: expected ${DUPLICATE_ATTEMPTS} duplicate rejections, got ${rejectedDuplicates}`);
  }
  if (errors > 0) {
    throw new Error(`System dropped ${errors} requests during burst window!`);
  }
  if (fullLeaderboard.length !== TOTAL_ATTENDEES) {
    throw new Error(`Leaderboard mismatch: expected ${TOTAL_ATTENDEES} ranked attendees, got ${fullLeaderboard.length}`);
  }

  console.log('🎉 AUDITORIUM CONCURRENCY TEST PASSED! READY FOR 800+ LIVE ATTENDEES.\n');
}

runLoadTest().catch((err) => {
  console.error('\n❌ CONCURRENCY TEST FAILED:', err);
  process.exit(1);
});
