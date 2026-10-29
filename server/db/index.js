import { supabase } from './supabaseClient.js';
import { memoryStore } from './memoryStore.js';

export const db = {
  // Check backend mode
  isSupabase() {
    return Boolean(supabase);
  },

  // Attendees
  async findAttendeeByUniqueCode(uniqueCode) {
    if (!uniqueCode) return null;
    const cleanCode = uniqueCode.toUpperCase().trim();

    if (supabase) {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .eq('unique_code', cleanCode)
        .maybeSingle();

      if (error) {
        console.error('[DB] findAttendeeByUniqueCode error:', error);
        return null;
      }
      return data;
    }

    return memoryStore.findAttendeeByUniqueCode(cleanCode);
  },

  async findAttendeeById(id) {
    if (supabase) {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[DB] findAttendeeById error:', error);
        return null;
      }
      return data;
    }

    return memoryStore.findAttendeeById(id);
  },

  async upsertAttendee(attendee) {
    if (supabase) {
      const { data, error } = await supabase
        .from('attendees')
        .upsert(attendee, { onConflict: 'event_id,unique_code' })
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    return memoryStore.upsertAttendee(attendee);
  },

  async listAttendees(limit = 100, offset = 0) {
    if (supabase) {
      const { data, count, error } = await supabase
        .from('attendees')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, total: count || 0 };
    }

    return memoryStore.listAttendees(limit, offset);
  },

  async deleteAttendee(idOrCode) {
    if (!idOrCode) return false;
    const clean = String(idOrCode).trim();

    if (supabase) {
      // Find attendee first
      let attendeeId = clean;
      let uniqueCode = clean;

      const { data: att } = await supabase
        .from('attendees')
        .select('id, unique_code')
        .or(`id.eq.${clean},unique_code.eq.${clean.toUpperCase()}`)
        .maybeSingle();

      if (att) {
        attendeeId = att.id;
        uniqueCode = att.unique_code;
      }

      // Delete child references
      await supabase.from('accepted_answers').delete().eq('attendee_id', attendeeId);
      await supabase.from('attendee_sessions').delete().eq('attendee_id', attendeeId);
      await supabase.from('attendee_tracks').delete().eq('attendee_id', attendeeId);

      const { error } = await supabase.from('attendees').delete().eq('id', attendeeId);
      if (error) {
        console.error('[DB] deleteAttendee error:', error);
        return false;
      }

      memoryStore.deleteAttendee(attendeeId);
      memoryStore.deleteAttendee(uniqueCode);
      return true;
    }

    return memoryStore.deleteAttendee(clean);
  },

  async deleteAttendeesBulk(idsOrCodes = []) {
    if (!idsOrCodes || idsOrCodes.length === 0) return 0;

    if (supabase) {
      let deleted = 0;
      for (const item of idsOrCodes) {
        const ok = await this.deleteAttendee(item);
        if (ok) deleted++;
      }
      return deleted;
    }

    return memoryStore.deleteAttendeesBulk(idsOrCodes);
  },

  // Attendee Tracks
  async addAttendeeTrack(trackAssignment) {
    if (supabase) {
      const { data, error } = await supabase
        .from('attendee_tracks')
        .upsert(trackAssignment, { onConflict: 'attendee_id,track_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    return memoryStore.addAttendeeTrack(trackAssignment);
  },

  async getAttendeeTracks(attendeeId) {
    if (supabase) {
      const { data, error } = await supabase
        .from('attendee_tracks')
        .select('track_id')
        .eq('attendee_id', attendeeId);

      if (error) {
        console.error('[DB] getAttendeeTracks error:', error);
        return [];
      }
      return (data || []).map((row) => row.track_id);
    }

    return memoryStore.getAttendeeTracks(attendeeId);
  },

  // Sessions
  async createSession(session) {
    if (supabase) {
      const { data, error } = await supabase
        .from('attendee_sessions')
        .insert(session)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    return memoryStore.createSession(session);
  },

  async findSessionByTokenHash(tokenHash) {
    if (supabase) {
      const now = Date.now();
      const { data, error } = await supabase
        .from('attendee_sessions')
        .select('*')
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .gt('expires_at', now)
        .maybeSingle();

      if (error) {
        console.error('[DB] findSessionByTokenHash error:', error);
        return null;
      }
      return data;
    }

    return memoryStore.findSessionByTokenHash(tokenHash);
  },

  async revokeSession(tokenHash) {
    if (supabase) {
      const { error } = await supabase
        .from('attendee_sessions')
        .update({ revoked_at: Date.now() })
        .eq('token_hash', tokenHash);

      if (error) console.error('[DB] revokeSession error:', error);
      return !error;
    }

    return memoryStore.revokeSession(tokenHash);
  },

  // Games
  async upsertGameDefinition(gameDef) {
    if (supabase) {
      const cleanDef = {
        id: gameDef.id,
        title: gameDef.title,
        description: gameDef.description || '',
        game_type: gameDef.game_type || gameDef.gameType || 'SYNCHRONIZED_MCQ',
        track_target: gameDef.track_target || gameDef.trackTarget || 'all',
        hall_name: gameDef.hall_name || gameDef.hallName || 'Conference Hall',
        status: gameDef.status || 'DRAFT',
        created_at: gameDef.created_at || Date.now(),
        updated_at: gameDef.updated_at || Date.now(),
      };

      try {
        const { data, error } = await supabase
          .from('game_definitions')
          .upsert(gameDef.questions ? { ...cleanDef, questions: gameDef.questions } : cleanDef)
          .select()
          .single();

        if (error) {
          if (error.message?.includes("column of 'game_definitions'") || error.message?.includes('schema cache')) {
            const { data: metaData, error: metaErr } = await supabase
              .from('game_definitions')
              .upsert(cleanDef)
              .select()
              .single();
            if (metaErr) throw metaErr;
            memoryStore.upsertGameDefinition({ ...gameDef, ...cleanDef });
            return { ...metaData, questions: gameDef.questions || [] };
          }
          throw error;
        }
        memoryStore.upsertGameDefinition({ ...gameDef, ...cleanDef });
        return data;
      } catch (err) {
        console.error('[DB] upsertGameDefinition error:', err);
        return memoryStore.upsertGameDefinition(gameDef);
      }
    }

    return memoryStore.upsertGameDefinition(gameDef);
  },

  async getGameDefinition(id) {
    if (supabase) {
      const { data, error } = await supabase
        .from('game_definitions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[DB] getGameDefinition error:', error);
        return memoryStore.getGameDefinition(id);
      }
      if (!data) return null;
      if (!data.questions || data.questions.length === 0) {
        const mem = await memoryStore.getGameDefinition(id);
        if (mem?.questions && mem.questions.length > 0) {
          data.questions = mem.questions;
        } else {
          const { data: versions } = await supabase
            .from('game_versions')
            .select('*')
            .eq('game_definition_id', id)
            .order('version_number', { ascending: false })
            .limit(1);

          if (versions && versions.length > 0 && versions[0].questions) {
            data.questions = versions[0].questions;
          }
        }
      }
      return data;
    }

    return memoryStore.getGameDefinition(id);
  },

  async listGameDefinitions() {
    if (supabase) {
      const { data, error } = await supabase
        .from('game_definitions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const games = data || [];

      const enriched = await Promise.all(
        games.map(async (g) => {
          if (g.questions && g.questions.length > 0) return g;
          try {
            const { data: vers } = await supabase
              .from('game_versions')
              .select('questions, total_questions')
              .eq('game_definition_id', g.id)
              .order('version_number', { ascending: false })
              .limit(1);
            if (vers && vers.length > 0) {
              return {
                ...g,
                questions: vers[0].questions || [],
                totalQuestions: vers[0].total_questions || vers[0].questions?.length || 0,
              };
            }
          } catch {
            // ignore
          }
          const mem = await memoryStore.getGameDefinition(g.id);
          if (mem?.questions) {
            return {
              ...g,
              questions: mem.questions,
              totalQuestions: mem.questions.length,
            };
          }
          return g;
        })
      );

      return enriched;
    }

    return memoryStore.listGameDefinitions();
  },

  async deleteGameDefinition(id) {
    if (supabase) {
      try {
        // 1. Fetch any game sessions for this game
        const { data: sessions } = await supabase
          .from('game_sessions')
          .select('room_code')
          .eq('game_definition_id', id);

        if (sessions && sessions.length > 0) {
          const roomCodes = sessions.map((s) => s.room_code).filter(Boolean);
          if (roomCodes.length > 0) {
            // Delete accepted answers associated with these room codes
            const { error: ansErr } = await supabase
              .from('accepted_answers')
              .delete()
              .in('room_code', roomCodes);
            if (ansErr) console.warn('[DB] delete accepted_answers warning:', ansErr);
          }

          // Delete game sessions
          const { error: sessErr } = await supabase
            .from('game_sessions')
            .delete()
            .eq('game_definition_id', id);
          if (sessErr) console.warn('[DB] delete game_sessions warning:', sessErr);
        }

        // 2. Delete game versions
        const { error: versErr } = await supabase
          .from('game_versions')
          .delete()
          .eq('game_definition_id', id);
        if (versErr) console.warn('[DB] delete game_versions warning:', versErr);

        // 3. Delete the canonical game definition
        const { error } = await supabase
          .from('game_definitions')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('[DB] deleteGameDefinition error:', error);
          return false;
        }

        memoryStore.deleteGameDefinition(id);
        return true;
      } catch (err) {
        console.error('[DB] deleteGameDefinition error:', err);
        return false;
      }
    }

    return memoryStore.deleteGameDefinition(id);
  },

  // Game Versions
  async createGameVersion(version) {
    if (supabase) {
      const { data, error } = await supabase
        .from('game_versions')
        .insert(version)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    return memoryStore.createGameVersion(version);
  },

  async getGameVersion(id) {
    if (supabase) {
      const { data, error } = await supabase
        .from('game_versions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[DB] getGameVersion error:', error);
        return null;
      }
      return data;
    }

    return memoryStore.getGameVersion(id);
  },

  async listGameVersions(gameDefinitionId) {
    if (supabase) {
      const { data, error } = await supabase
        .from('game_versions')
        .select('*')
        .eq('game_definition_id', gameDefinitionId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return data || [];
    }

    return memoryStore.listGameVersions(gameDefinitionId);
  },

  // Game Sessions (Live Rooms)
  async upsertGameSession(gameSession) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .upsert(gameSession, { onConflict: 'room_code' })
          .select()
          .single();

        if (error) {
          if (error.code === '23503') {
            // Foreign key violation (curated default game not yet in supabase) - fallback to memory store
            return memoryStore.upsertGameSession(gameSession);
          }
          console.error('[DB] upsertGameSession error:', error);
        }
        return data || gameSession;
      } catch {
        return memoryStore.upsertGameSession(gameSession);
      }
    }

    return memoryStore.upsertGameSession(gameSession);
  },

  async getGameSessionByRoomCode(roomCode) {
    if (supabase) {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_code', roomCode)
        .maybeSingle();

      if (error) {
        console.error('[DB] getGameSessionByRoomCode error:', error);
        return null;
      }
      return data;
    }

    return memoryStore.getGameSessionByRoomCode(roomCode);
  },

  async getGameSessionsByDefinitionId(gameDefinitionId) {
    if (supabase) {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('game_definition_id', gameDefinitionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DB] getGameSessionsByDefinitionId error:', error);
        return [];
      }
      return data || [];
    }

    return memoryStore.getGameSessionsByDefinitionId(gameDefinitionId);
  },

  async getAllGameSessions() {
    if (supabase) {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*');
      if (error) {
        console.error('[DB] getAllGameSessions error:', error);
        return [];
      }
      return data || [];
    }

    return memoryStore.getAllGameSessions();
  },

  async clearGameSessionsAndAnswers(gameDefinitionId) {
    if (supabase) {
      try {
        const { data: sessions } = await supabase
          .from('game_sessions')
          .select('room_code')
          .eq('game_definition_id', gameDefinitionId);

        if (sessions && sessions.length > 0) {
          const roomCodes = sessions.map((s) => s.room_code).filter(Boolean);
          if (roomCodes.length > 0) {
            await supabase
              .from('accepted_answers')
              .delete()
              .in('room_code', roomCodes);
          }
          await supabase
            .from('game_sessions')
            .delete()
            .eq('game_definition_id', gameDefinitionId);
        }
      } catch (err) {
        console.error('[DB] clearGameSessionsAndAnswers error:', err);
      }
    }
    await memoryStore.clearGameSessionsAndAnswers(gameDefinitionId);
    return true;
  },

  // Accepted Answers
  async saveAcceptedAnswer(answer) {
    if (supabase) {
      const { data, error } = await supabase
        .from('accepted_answers')
        .insert(answer)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          const err = new Error('Answer already submitted for this question');
          err.code = '23505';
          err.status = 409;
          throw err;
        }
        throw error;
      }
      return data;
    }

    return memoryStore.saveAcceptedAnswer(answer);
  },

  async saveAcceptedAnswersBatch(answers) {
    if (!answers || answers.length === 0) return [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('accepted_answers')
          .upsert(answers, { onConflict: 'room_code,question_index,attendee_id', ignoreDuplicates: true });

        if (error) {
          console.error('[DB] saveAcceptedAnswersBatch error:', error.message);
          return memoryStore.saveAcceptedAnswersBatch(answers);
        }
        return data || answers;
      } catch (err) {
        console.error('[DB] saveAcceptedAnswersBatch exception:', err.message);
        return memoryStore.saveAcceptedAnswersBatch(answers);
      }
    }

    return memoryStore.saveAcceptedAnswersBatch(answers);
  },

  async getAcceptedAnswersForQuestion(roomCode, questionIndex) {
    if (supabase) {
      const { data, error } = await supabase
        .from('accepted_answers')
        .select('*')
        .eq('room_code', roomCode)
        .eq('question_index', questionIndex);

      if (error) {
        console.error('[DB] getAcceptedAnswersForQuestion error:', error);
        return [];
      }
      return data || [];
    }

    return memoryStore.getAcceptedAnswersForQuestion(roomCode, questionIndex);
  },

  async getAllAcceptedAnswersForRoom(roomCode) {
    if (supabase) {
      const { data, error } = await supabase
        .from('accepted_answers')
        .select('*')
        .eq('room_code', roomCode);

      if (error) {
        console.error('[DB] getAllAcceptedAnswersForRoom error:', error);
        return [];
      }
      return data || [];
    }

    return memoryStore.getAllAcceptedAnswersForRoom(roomCode);
  },

  async getAllAcceptedAnswers() {
    if (supabase) {
      const { data, error } = await supabase
        .from('accepted_answers')
        .select('*');

      if (error) {
        console.error('[DB] getAllAcceptedAnswers error:', error);
        return [];
      }
      return data || [];
    }

    return memoryStore.getAllAcceptedAnswers();
  },

  // Audit Logs
  async logAuditEvent(audit) {
    const record = {
      ...audit,
      timestamp: Date.now(),
    };

    if (supabase) {
      const { error } = await supabase
        .from('admin_audit_logs')
        .insert(record);

      if (error) console.error('[DB] logAuditEvent error:', error);
      return record;
    }

    return memoryStore.logAuditEvent(record);
  },

  // Reset store (for testing)
  resetMemoryStore() {
    memoryStore.reset();
  },
};
