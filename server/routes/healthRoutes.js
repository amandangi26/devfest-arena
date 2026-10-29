import { Router } from 'express';
import { db } from '../db/index.js';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    event: 'DevFest Ranchi 2026',
    venue: 'Radisson Blu, Ranchi',
    timestamp: Date.now(),
    database: db.isSupabase() ? 'supabase' : 'memory_fallback',
  });
});
