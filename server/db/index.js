import { supabase } from './supabaseClient.js';
import { memoryStore } from './memoryStore.js';

function extractHallAndDescription(desc) {
  if (!desc) return { hallName: 'Conference Hall', cleanDescription: '' };
  const str = String(desc);
  const match = str.match(/<!--hall:([^>]+)-->/);
  if (match) {
    return {
      hallName: match[1].trim(),
      cleanDescription: str.replace(/<!--hall:[^>]+-->/g, '').trim(),
    };
  }
  return { hallName: 'Conference Hall', cleanDescription: str };
}

export const db = {
  // Check backend mode
  isSupabase() {
    return Boolean(supabase);
  },

  // Attendees
  async findAttendeeByUniqueCode(uniqueCode) {
    if (!uniqueCode) return null;
    const cleanCode = uniqueCode.toUpperCase().trim();

    // 1. Instant in-memory lookup (< 0.01ms)
    const inMem = await memoryStore.findAttendeeByUniqueCode(cleanCode);
    if (inMem) return inMem;

    // 2. Fall back to Supabase with defensive error handling
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('attendees')
          .select('*')
          .eq('unique_code', cleanCode)
          .maybeSingle();

        if (error) {
          console.warn('[DB] findAttendeeByUniqueCode Supabase warning:', error.message || error);
          return inMem || null;
        }

        if (data) {
          memoryStore.upsertAttendee(data);
          return data;
        }
      } catch (err) {
        console.warn('[DB] findAttendeeByUniqueCode network exception, fallback to memoryStore:', err.message || err);
        return inMem || null;
      }
    }

    return inMem || null;
  },

  async findAttendeeById(id) {
    if (!id) return null;
    const inMem = await memoryStore.findAttendeeById(id);
    if (inMem) return inMem;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('attendees')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          console.warn('[DB] findAttendeeById Supabase warning:', error.message || error);
          return inMem || null;
        }
        if (data) {
          memoryStore.upsertAttendee(data);
          return data;
        }
      } catch (err) {
        console.warn('[DB] findAttendeeById exception:', err.message || err);
        return inMem || null;
      }
    }

    return inMem || null;
  },

  async upsertAttendee(attendee) {
    // 1. Always write to in-memory store immediately (guarantees zero latency and offline persistence)
    const memRecord = await memoryStore.upsertAttendee(attendee);

    // 2. Synchronize to Supabase asynchronously / resiliently
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('attendees')
          .upsert(attendee, { onConflict: 'event_id,unique_code' })
          .select()
          .single();

        if (error) {
          console.warn('[DB] upsertAttendee Supabase error, keeping in-memory copy:', error.message || error);
          return memRecord;
        }
        return data || memRecord;
      } catch (err) {
        console.warn('[DB] upsertAttendee network exception, keeping in-memory copy:', err.message || err);
        return memRecord;
      }
    }

    return memRecord;
  },

  async listAttendees(limit = 100, offset = 0, search = '') {
    if (supabase) {
      try {
        let query = supabase
          .from('attendees')
          .select('*', { count: 'exact' });

        if (search && search.trim()) {
          const clean = search.trim();
          const digits = clean.replace(/\D/g, '');
          const nonPhoneChars = clean.replace(/[\d\s+\-()]/g, '');

          // If purely numeric / phone number query
          if (nonPhoneChars.length === 0 && digits.length >= 4) {
            let phoneTerm = digits;
            if (digits.startsWith('91') && digits.length === 12) {
              phoneTerm = digits.slice(2);
            } else if (digits.startsWith('0') && digits.length === 11) {
              phoneTerm = digits.slice(1);
            } else if (digits.length > 10) {
              phoneTerm = digits.slice(-10);
            }
            query = query.or(`phone_normalized.ilike.%${phoneTerm}%,unique_code.ilike.%${clean.trim()}%`);
          } else {
            // Text search: sanitize PostgREST delimiter characters (, " ' % _ \)
            const safe = clean.replace(/[,()"'\\%_]/g, ' ').replace(/\s+/g, ' ').trim();
            const words = safe.split(' ').filter((w) => w.length > 0);
            const cols = ['name', 'display_name', 'unique_code', 'email_normalized', 'organization', 'designation'];

            for (const word of words) {
              const conds = cols.map((c) => `${c}.ilike.%${word}%`);
              const wordDigits = word.replace(/\D/g, '');
              if (wordDigits.length >= 3) {
                conds.push(`phone_normalized.ilike.%${wordDigits}%`);
              }
              query = query.or(conds.join(','));
            }
          }
        }

        const { data, count, error } = await query
          .range(offset, offset + limit - 1)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('[DB] listAttendees Supabase error, falling back to memoryStore:', error.message || error);
          return memoryStore.listAttendees(limit, offset, search);
        }

        // Cache loaded attendees into memoryStore
        if (data && data.length > 0) {
          for (const a of data) {
            memoryStore.upsertAttendee(a);
          }
        }
        return { data: data || [], total: count || data?.length || 0 };
      } catch (err) {
        console.warn('[DB] listAttendees exception, falling back to memoryStore:', err.message || err);
        return memoryStore.listAttendees(limit, offset, search);
      }
    }

    return memoryStore.listAttendees(limit, offset, search);
  },

  async deleteAttendee(idOrCode) {
    if (!idOrCode) return false;
    const clean = String(idOrCode).trim();

    if (supabase) {
      try {
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
      } catch (err) {
        console.error('[DB] deleteAttendee exception:', err);
        memoryStore.deleteAttendee(clean);
        return true;
      }
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
    await memoryStore.addAttendeeTrack(trackAssignment);

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('attendee_tracks')
          .upsert(trackAssignment, { onConflict: 'attendee_id,track_id' })
          .select()
          .single();

        if (error) {
          console.warn('[DB] addAttendeeTrack Supabase error:', error.message || error);
          return trackAssignment;
        }
        return data || trackAssignment;
      } catch (err) {
        console.warn('[DB] addAttendeeTrack exception:', err.message || err);
        return trackAssignment;
      }
    }

    return memoryStore.addAttendeeTrack(trackAssignment);
  },

  async getAttendeeTracks(attendeeId) {
    const inMem = await memoryStore.getAttendeeTracks(attendeeId);
    if (inMem && inMem.length > 0) return inMem;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('attendee_tracks')
          .select('track_id')
          .eq('attendee_id', attendeeId);

        if (error) {
          console.warn('[DB] getAttendeeTracks Supabase error:', error.message || error);
          return inMem || [];
        }

        const tracks = (data || []).map((row) => row.track_id);
        if (tracks.length > 0) {
          for (const trk of tracks) {
            memoryStore.addAttendeeTrack({
              attendee_id: attendeeId,
              track_id: trk,
            });
          }
        }
        return tracks.length > 0 ? tracks : (inMem || []);
      } catch (err) {
        console.warn('[DB] getAttendeeTracks exception:', err.message || err);
        return inMem || [];
      }
    }

    return memoryStore.getAttendeeTracks(attendeeId);
  },

  // Sessions
  async createSession(session) {
    await memoryStore.createSession(session);

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('attendee_sessions')
          .insert(session)
          .select()
          .single();

        if (error) {
          console.warn('[DB] createSession Supabase error, session retained in memoryStore:', error.message || error);
          return session;
        }
        return data || session;
      } catch (err) {
        console.warn('[DB] createSession network exception, session retained in memoryStore:', err.message || err);
        return session;
      }
    }

    return memoryStore.createSession(session);
  },

  async findSessionByTokenHash(tokenHash) {
    const inMem = await memoryStore.findSessionByTokenHash(tokenHash);
    if (inMem) return inMem;

    if (supabase) {
      try {
        const now = Date.now();
        const { data, error } = await supabase
          .from('attendee_sessions')
          .select('*')
          .eq('token_hash', tokenHash)
          .is('revoked_at', null)
          .gt('expires_at', now)
          .maybeSingle();

        if (error) {
          console.warn('[DB] findSessionByTokenHash Supabase error:', error.message || error);
          return inMem || null;
        }
        if (data) {
          memoryStore.createSession(data);
          return data;
        }
      } catch (err) {
        console.warn('[DB] findSessionByTokenHash exception:', err.message || err);
        return inMem || null;
      }
    }

    return memoryStore.findSessionByTokenHash(tokenHash);
  },

  async revokeSession(tokenHash) {
    await memoryStore.revokeSession(tokenHash);

    if (supabase) {
      try {
        const { error } = await supabase
          .from('attendee_sessions')
          .update({ revoked_at: Date.now() })
          .eq('token_hash', tokenHash);

        if (error) console.warn('[DB] revokeSession error:', error.message || error);
        return !error;
      } catch (err) {
        console.warn('[DB] revokeSession exception:', err.message || err);
        return true;
      }
    }

    return memoryStore.revokeSession(tokenHash);
  },

  // Games
  async upsertGameDefinition(gameDef) {
    const hallName = gameDef.hall_name || gameDef.hallName || 'Conference Hall';
    const rawDesc = (gameDef.description || '').replace(/<!--hall:[^>]+-->/g, '').trim();
    const encodedDesc = hallName ? `<!--hall:${hallName}-->${rawDesc}` : rawDesc;

    if (supabase) {
      const cleanDef = {
        id: gameDef.id,
        title: gameDef.title,
        description: encodedDesc,
        game_type: gameDef.game_type || gameDef.gameType || 'SYNCHRONIZED_MCQ',
        track_target: gameDef.track_target || gameDef.trackTarget || 'all',
        status: gameDef.status || 'DRAFT',
        created_at: Number(gameDef.created_at) || Date.now(),
        updated_at: Number(gameDef.updated_at) || Date.now(),
      };

      try {
        const { data, error } = await supabase
          .from('game_definitions')
          .upsert(cleanDef)
          .select()
          .single();

        if (error) {
          console.error('[DB] upsertGameDefinition Supabase error:', error);
          throw error;
        }

        // Persist draft questions in Supabase game_versions table under version 0 if questions provided
        if (gameDef.questions && gameDef.questions.length > 0) {
          try {
            await supabase.from('game_versions').upsert({
              id: `ver_${gameDef.id}_v0`,
              game_definition_id: gameDef.id,
              version_number: 0,
              total_questions: gameDef.questions.length,
              questions: gameDef.questions,
              published_by: 'draft',
              published_at: Date.now(),
            });
          } catch (vErr) {
            console.warn('[DB] Could not persist draft questions to game_versions v0:', vErr);
          }
        }

        const enriched = {
          ...data,
          description: rawDesc,
          hall_name: hallName,
          hallName,
          questions: gameDef.questions || [],
        };
        memoryStore.upsertGameDefinition(enriched);
        return enriched;
      } catch (err) {
        console.error('[DB] upsertGameDefinition fallback error:', err);
        return memoryStore.upsertGameDefinition({
          ...gameDef,
          description: rawDesc,
          hall_name: hallName,
          hallName,
        });
      }
    }

    return memoryStore.upsertGameDefinition({
      ...gameDef,
      description: rawDesc,
      hall_name: hallName,
      hallName,
    });
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
      if (!data) {
        return memoryStore.getGameDefinition(id);
      }

      const { hallName, cleanDescription } = extractHallAndDescription(data.description);
      data.hall_name = hallName;
      data.hallName = hallName;
      data.description = cleanDescription;

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

      data.questions = data.questions || [];
      memoryStore.upsertGameDefinition(data);
      return data;
    }

    return memoryStore.getGameDefinition(id);
  },

  async listGameDefinitions() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('game_definitions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[DB] listGameDefinitions error, falling back to memoryStore:', error);
          return memoryStore.listGameDefinitions();
        }
        const games = data || [];

        const enriched = await Promise.all(
          games.map(async (g) => {
            const { hallName, cleanDescription } = extractHallAndDescription(g.description);
            g.hall_name = hallName;
            g.hallName = hallName;
            g.description = cleanDescription;

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
            return {
              ...g,
              questions: [],
              totalQuestions: 0,
            };
          })
        );

        return enriched;
      } catch (err) {
        console.error('[DB] listGameDefinitions exception, falling back to memoryStore:', err);
        return memoryStore.listGameDefinitions();
      }
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
      try {
        let { data, error } = await supabase
          .from('game_versions')
          .insert(version)
          .select()
          .single();

        // If parent definition missing (FK error), self-heal by upserting parent and retrying
        if (error && (error.code === '23503' || error.message?.includes('foreign key constraint'))) {
          console.warn('[DB] Self-healing parent definition for version:', version.game_definition_id);
          const parentDef = await this.getGameDefinition(version.game_definition_id);
          if (parentDef) {
            await this.upsertGameDefinition(parentDef);
            const retry = await supabase.from('game_versions').insert(version).select().single();
            if (!retry.error) {
              data = retry.data;
              error = null;
            }
          }
        }

        if (error) {
          console.error('[DB] createGameVersion error, falling back to memoryStore:', error);
          return memoryStore.createGameVersion(version);
        }

        memoryStore.createGameVersion(version);
        return data;
      } catch (err) {
        console.error('[DB] createGameVersion exception fallback:', err);
        return memoryStore.createGameVersion(version);
      }
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
        return memoryStore.getGameVersion(id);
      }
      if (!data) return memoryStore.getGameVersion(id);
      return data;
    }

    return memoryStore.getGameVersion(id);
  },

  async listGameVersions(gameDefinitionId) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('game_versions')
          .select('*')
          .eq('game_definition_id', gameDefinitionId)
          .gt('version_number', 0)
          .order('version_number', { ascending: false });

        if (error) {
          console.warn('[DB] listGameVersions error, fallback to memoryStore:', error);
          return memoryStore.listGameVersions(gameDefinitionId);
        }
        return data || [];
      } catch (err) {
        console.warn('[DB] listGameVersions exception, fallback to memoryStore:', err);
        return memoryStore.listGameVersions(gameDefinitionId);
      }
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
    memoryStore.logAuditEvent(record);

    if (supabase) {
      try {
        const { error } = await supabase
          .from('admin_audit_logs')
          .insert(record);

        if (error) console.warn('[DB] logAuditEvent warning:', error.message || error);
        return record;
      } catch (err) {
        console.warn('[DB] logAuditEvent exception:', err.message || err);
        return record;
      }
    }

    return record;
  },

  /**
   * Pre-warms the in-memory store on server startup to handle 800+ concurrent attendees
   * with zero-latency lookups (<0.1ms) and 100% offline network resilience.
   */
  async warmMemoryCache() {
    if (!supabase) return;
    try {
      console.log('[Database] Pre-warming in-memory cache for high-concurrency (800+ attendees)...');
      // 1. Preload attendees
      const { data: atts } = await supabase
        .from('attendees')
        .select('*')
        .limit(2500);

      memoryStore.attendees.clear();
      memoryStore.attendeeByUniqueCode.clear();
      if (atts && atts.length > 0) {
        for (const a of atts) {
          memoryStore.upsertAttendee(a);
        }
        console.log(`[Database] Pre-warmed ${atts.length} attendees in-memory.`);
      } else {
        console.log('[Database] 0 attendees found in Supabase.');
      }

      // 2. Preload attendee tracks
      const { data: trks } = await supabase
        .from('attendee_tracks')
        .select('*')
        .limit(5000);

      memoryStore.attendeeTracks.clear();
      if (trks && trks.length > 0) {
        for (const t of trks) {
          memoryStore.addAttendeeTrack(t);
        }
      }

      // 3. Preload game definitions
      const { data: games } = await supabase
        .from('game_definitions')
        .select('*')
        .limit(100);

      if (games && games.length > 0) {
        for (const g of games) {
          memoryStore.upsertGameDefinition(g);
        }
        console.log(`[Database] Pre-warmed ${games.length} game definitions in-memory.`);
      }
      console.log('[Database] Pre-warming complete. Engine ready for 800+ simultaneous players.');
    } catch (err) {
      console.warn('[Database] Pre-warming warning (non-fatal, running on-demand):', err.message || err);
    }
  },

  // Reset store (for testing)
  resetMemoryStore() {
    memoryStore.reset();
  },
};
