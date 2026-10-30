import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/authRoutes.js';
import { attendeeRouter } from './routes/attendeeRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { gameRouter } from './routes/gameRoutes.js';
import { roomRouter } from './routes/roomRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Middleware pipeline
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(cookieParser());

  // Security & DoS Protection: Restrict body parser limits
  // 1. High-capacity parser specifically for large CSV imports & image uploads
  app.use('/api/attendees/import', express.json({ limit: '15mb' }));
  app.use('/api/attendees/import', express.urlencoded({ extended: true, limit: '15mb' }));
  app.use('/api/games/upload-media', express.json({ limit: '10mb' }));
  app.use('/api/games/upload-media', express.urlencoded({ extended: true, limit: '10mb' }));

  // 2. Strict 1MB limit for all other API endpoints (auth, room joining, answer submission)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Routes
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/attendees', attendeeRouter);
  app.use('/api/games', gameRouter);
  app.use('/api/rooms', roomRouter);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
