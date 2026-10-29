/**
 * In-Memory Datastore for DevFest Ranchi 2026 Game Engine.
 * Used for testing, offline development, and zero-dependency fallbacks.
 */
class MemoryStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.attendees = new Map(); // id -> attendee
    this.attendeeByUniqueCode = new Map(); // uniqueCode -> attendee
    this.attendeeTracks = new Map(); // `${attendeeId}_${trackId}` -> track
    this.sessions = new Map(); // tokenHash -> session
    this.gameDefinitions = new Map(); // id -> gameDef
    this.gameVersions = new Map(); // id -> gameVersion
    this.gameSessions = new Map(); // roomCode -> gameSession
    this.acceptedAnswers = new Map(); // `${roomCode}_q${questionIndex}_${attendeeId}` -> answer
    this.auditLogs = [];
  }

  // Attendees
  async findAttendeeByUniqueCode(uniqueCode) {
    if (!uniqueCode) return null;
    return this.attendeeByUniqueCode.get(uniqueCode.toUpperCase().trim()) || null;
  }

  async findAttendeeById(id) {
    return this.attendees.get(id) || null;
  }

  async upsertAttendee(attendee) {
    const existing = this.attendees.get(attendee.id);
    const updated = {
      ...existing,
      ...attendee,
      updated_at: Date.now(),
    };
    this.attendees.set(updated.id, updated);
    this.attendeeByUniqueCode.set(updated.unique_code.toUpperCase().trim(), updated);
    return updated;
  }

  async listAttendees(limit = 100, offset = 0) {
    const all = Array.from(this.attendees.values());
    return {
      data: all.slice(offset, offset + limit),
      total: all.length,
    };
  }

  async deleteAttendee(idOrCode) {
    if (!idOrCode) return false;
    let attendee = this.attendees.get(idOrCode);
    if (!attendee) {
      attendee = this.attendeeByUniqueCode.get(idOrCode.toUpperCase().trim());
    }
    if (!attendee) return false;

    this.attendees.delete(attendee.id);
    if (attendee.unique_code) {
      this.attendeeByUniqueCode.delete(attendee.unique_code.toUpperCase().trim());
    }

    // Clean up tracks
    for (const [key, track] of this.attendeeTracks.entries()) {
      if (track.attendee_id === attendee.id) {
        this.attendeeTracks.delete(key);
      }
    }

    // Clean up sessions
    for (const [tokenHash, session] of this.sessions.entries()) {
      if (session.attendee_id === attendee.id) {
        this.sessions.delete(tokenHash);
      }
    }

    // Clean up accepted answers
    for (const [key, ans] of this.acceptedAnswers.entries()) {
      if (ans.attendee_id === attendee.id) {
        this.acceptedAnswers.delete(key);
      }
    }

    return true;
  }

  async deleteAttendeesBulk(idsOrCodes = []) {
    let count = 0;
    for (const item of idsOrCodes) {
      const ok = await this.deleteAttendee(item);
      if (ok) count++;
    }
    return count;
  }

  // Attendee Tracks
  async addAttendeeTrack(trackAssignment) {
    const key = `${trackAssignment.attendee_id}_${trackAssignment.track_id}`;
    this.attendeeTracks.set(key, trackAssignment);
    return trackAssignment;
  }

  async getAttendeeTracks(attendeeId) {
    const tracks = [];
    for (const track of this.attendeeTracks.values()) {
      if (track.attendee_id === attendeeId) {
        tracks.push(track.track_id);
      }
    }
    return tracks;
  }

  // Sessions
  async createSession(session) {
    this.sessions.set(session.token_hash, session);
    return session;
  }

  async findSessionByTokenHash(tokenHash) {
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    if (session.revoked_at || session.expires_at < Date.now()) {
      return null;
    }
    return session;
  }

  async revokeSession(tokenHash) {
    const session = this.sessions.get(tokenHash);
    if (session) {
      session.revoked_at = Date.now();
      this.sessions.set(tokenHash, session);
    }
    return true;
  }

  // Games
  async upsertGameDefinition(gameDef) {
    this.gameDefinitions.set(gameDef.id, gameDef);
    return gameDef;
  }

  async getGameDefinition(id) {
    return this.gameDefinitions.get(id) || null;
  }

  async listGameDefinitions() {
    return Array.from(this.gameDefinitions.values());
  }

  async deleteGameDefinition(id) {
    for (const [vId, ver] of this.gameVersions.entries()) {
      if (ver.game_definition_id === id) {
        this.gameVersions.delete(vId);
      }
    }
    return this.gameDefinitions.delete(id);
  }

  // Game Versions
  async createGameVersion(version) {
    this.gameVersions.set(version.id, version);
    return version;
  }

  async getGameVersion(id) {
    return this.gameVersions.get(id) || null;
  }

  async listGameVersions(gameDefinitionId) {
    const versions = [];
    for (const ver of this.gameVersions.values()) {
      if (ver.game_definition_id === gameDefinitionId) {
        versions.push(ver);
      }
    }
    return versions.sort((a, b) => b.version_number - a.version_number);
  }

  // Game Sessions (Room State)
  async upsertGameSession(gameSession) {
    this.gameSessions.set(gameSession.room_code, gameSession);
    return gameSession;
  }

  async getGameSessionByRoomCode(roomCode) {
    if (!roomCode) return null;
    return this.gameSessions.get(roomCode.toUpperCase().trim()) || null;
  }

  async getGameSessionsByDefinitionId(gameDefinitionId) {
    const list = [];
    for (const s of this.gameSessions.values()) {
      if (s.game_definition_id === gameDefinitionId) {
        list.push(s);
      }
    }
    return list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }

  async getAllGameSessions() {
    return Array.from(this.gameSessions.values());
  }

  async clearGameSessionsAndAnswers(gameDefinitionId) {
    const roomCodes = [];
    for (const [code, s] of this.gameSessions.entries()) {
      if (s.game_definition_id === gameDefinitionId) {
        roomCodes.push(code);
        this.gameSessions.delete(code);
      }
    }
    for (const code of roomCodes) {
      for (const key of Array.from(this.acceptedAnswers.keys())) {
        if (key.startsWith(`${code}_`)) {
          this.acceptedAnswers.delete(key);
        }
      }
    }
    return true;
  }

  // Accepted Answers
  async saveAcceptedAnswer(answer) {
    const key = `${answer.room_code}_q${answer.question_index}_${answer.attendee_id}`;
    if (this.acceptedAnswers.has(key)) {
      const error = new Error('Answer already submitted for this question');
      error.code = '23505'; // PostgreSQL unique_violation code
      error.status = 409;
      throw error;
    }
    this.acceptedAnswers.set(key, answer);
    return answer;
  }

  async saveAcceptedAnswersBatch(answers) {
    if (!answers || answers.length === 0) return [];
    const saved = [];
    for (const ans of answers) {
      const key = `${ans.room_code}_q${ans.question_index}_${ans.attendee_id}`;
      this.acceptedAnswers.set(key, ans);
      saved.push(ans);
    }
    return saved;
  }

  async getAcceptedAnswersForQuestion(roomCode, questionIndex) {
    const answers = [];
    for (const ans of this.acceptedAnswers.values()) {
      if (ans.room_code === roomCode && ans.question_index === questionIndex) {
        answers.push(ans);
      }
    }
    return answers;
  }

  async getAllAcceptedAnswersForRoom(roomCode) {
    const answers = [];
    for (const ans of this.acceptedAnswers.values()) {
      if (ans.room_code === roomCode) {
        answers.push(ans);
      }
    }
    return answers;
  }

  async getAllAcceptedAnswers() {
    return Array.from(this.acceptedAnswers.values());
  }

  // Audit Logs
  async logAuditEvent(audit) {
    const record = {
      ...audit,
      timestamp: Date.now(),
    };
    this.auditLogs.push(record);
    return record;
  }
}

export const memoryStore = new MemoryStore();
