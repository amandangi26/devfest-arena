-- ==============================================================================
-- DevFest Ranchi 2026 Live Game Engine — Database Schema (Supabase / PostgreSQL)
-- Target Scale: 800+ Attendees across 3 tracks
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ATTENDEES (Canonical attendee records)
CREATE TABLE IF NOT EXISTS attendees (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL DEFAULT 'devfest-ranchi-2026',
    unique_code TEXT NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email_normalized TEXT,
    phone_normalized TEXT,
    organization TEXT,
    designation TEXT,
    registration_status TEXT NOT NULL DEFAULT 'confirmed',
    attendance_status TEXT NOT NULL DEFAULT 'unknown',
    ticket_verified_at BIGINT,
    checked_in_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT uq_attendees_event_unique_code UNIQUE (event_id, unique_code)
);

CREATE INDEX IF NOT EXISTS idx_attendees_unique_code ON attendees (unique_code);
CREATE INDEX IF NOT EXISTS idx_attendees_email ON attendees (email_normalized);
CREATE INDEX IF NOT EXISTS idx_attendees_phone ON attendees (phone_normalized);
CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON attendees (event_id);

-- 2. ATTENDEE TRACKS (Many-to-many track affiliations)
CREATE TABLE IF NOT EXISTS attendee_tracks (
    id TEXT PRIMARY KEY,
    attendee_id TEXT NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    unique_code TEXT NOT NULL,
    track_id TEXT NOT NULL,
    source_import_id TEXT,
    assigned_at BIGINT NOT NULL,
    CONSTRAINT uq_attendee_track UNIQUE (attendee_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_attendee_tracks_attendee ON attendee_tracks (attendee_id);
CREATE INDEX IF NOT EXISTS idx_attendee_tracks_track_id ON attendee_tracks (track_id);
CREATE INDEX IF NOT EXISTS idx_attendee_tracks_unique_code ON attendee_tracks (unique_code);

-- 3. ATTENDEE SESSIONS (Server-issued revocable sessions)
CREATE TABLE IF NOT EXISTS attendee_sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    attendee_id TEXT NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    unique_code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    track_ids TEXT[] NOT NULL DEFAULT '{}',
    expires_at BIGINT NOT NULL,
    revoked_at BIGINT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON attendee_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_attendee_id ON attendee_sessions (attendee_id);

-- 4. GAME DEFINITIONS (Reusable Quiz definitions)
CREATE TABLE IF NOT EXISTS game_definitions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    game_type TEXT NOT NULL DEFAULT 'SYNCHRONIZED_MCQ',
    track_target TEXT NOT NULL DEFAULT 'all',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

ALTER TABLE game_definitions ADD COLUMN IF NOT EXISTS questions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 5. GAME VERSIONS (Immutable published versions)
CREATE TABLE IF NOT EXISTS game_versions (
    id TEXT PRIMARY KEY,
    game_definition_id TEXT NOT NULL REFERENCES game_definitions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 0,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    published_by TEXT NOT NULL DEFAULT 'admin',
    published_at BIGINT NOT NULL,
    CONSTRAINT uq_game_version UNIQUE (game_definition_id, version_number)
);

-- 6. GAME SESSIONS (Live room state)
CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL UNIQUE,
    game_definition_id TEXT NOT NULL REFERENCES game_definitions(id),
    game_version_id TEXT NOT NULL REFERENCES game_versions(id),
    track_target TEXT NOT NULL DEFAULT 'all',
    status TEXT NOT NULL DEFAULT 'LOBBY',
    state_version INTEGER NOT NULL DEFAULT 1,
    current_question_index INTEGER NOT NULL DEFAULT 0,
    question_started_at BIGINT,
    question_deadline_at BIGINT,
    paused_at BIGINT,
    remaining_time_ms_at_pause BIGINT,
    started_at BIGINT,
    ended_at BIGINT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_room_code ON game_sessions (room_code);

-- 7. ACCEPTED ANSWERS (Authoritative, idempotent answer records)
CREATE TABLE IF NOT EXISTS accepted_answers (
    id TEXT PRIMARY KEY, -- e.g. `${room_code}_q${question_index}_${attendee_id}`
    room_code TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    attendee_id TEXT NOT NULL REFERENCES attendees(id),
    unique_code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    selected_option_id TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    time_elapsed_ms BIGINT NOT NULL,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    server_received_at BIGINT NOT NULL,
    idempotency_key TEXT,
    CONSTRAINT uq_room_question_attendee UNIQUE (room_code, question_index, attendee_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_room_code ON accepted_answers (room_code);
CREATE INDEX IF NOT EXISTS idx_answers_attendee ON accepted_answers (attendee_id);
CREATE INDEX IF NOT EXISTS idx_answers_room_q_attendee ON accepted_answers (room_code, question_index, attendee_id);

-- 8. ADMIN AUDIT LOGS
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON admin_audit_logs (timestamp DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Lock down all tables; server backend (service_role) bypasses RLS safely.
-- ==============================================================================
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendee_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendee_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accepted_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Deny all public read/write by default; only service_role key can execute queries
