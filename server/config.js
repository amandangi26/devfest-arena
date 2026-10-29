import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Session Security
  sessionSecret: process.env.SESSION_SECRET || 'devfest-ranchi-2026-default-dev-secret-change-in-prod',
  sessionCookieName: 'dfr26_session',
  sessionTtlMs: 24 * 60 * 60 * 1000, // 24 hours

  // Admin Security
  adminApiKey: process.env.ADMIN_API_KEY || 'devfest-admin-2026',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@devfest.in',
  adminPassword: process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY || 'devfest-admin-2026',

  // Supabase Configuration
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',

  // Event Context (Configurable via Environment or DB)
  eventId: process.env.EVENT_ID || 'devfest-ranchi-2026',
  venueName: process.env.VENUE_NAME || 'Radisson Blu, Ranchi',
  eventDate: process.env.EVENT_DATE || '2026-10-31',
  targetAttendeeCapacity: parseInt(process.env.TARGET_ATTENDEE_CAPACITY || '800', 10),
};

// Production security guards & integrity verification
if (config.isProduction) {
  if (config.adminApiKey === 'devfest-admin-2026') {
    console.error('[SECURITY WARNING] ADMIN_API_KEY is using default dev value in production. Set ADMIN_API_KEY in environment.');
  }
  if (config.sessionSecret.includes('default-dev-secret')) {
    console.error('[SECURITY WARNING] SESSION_SECRET is using default dev secret in production. Set SESSION_SECRET in environment.');
  }
}
