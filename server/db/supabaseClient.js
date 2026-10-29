import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let supabase = null;

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

if (!isTest && config.supabaseUrl && config.supabaseServiceRoleKey) {
  try {
    supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('[Database] Supabase client initialized with service role.');
  } catch (err) {
    console.error('[Database] Failed to initialize Supabase client:', err.message);
  }
} else {
  console.log(`[Database] ${isTest ? 'Running in Test Mode' : 'Supabase credentials not provided'}. Operating in MemoryStore mode.`);
}

export { supabase };

