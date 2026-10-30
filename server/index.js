import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[GameEngine Server] Running on http://localhost:${config.port}`);
  console.log(`[GameEngine Server] Environment: ${config.nodeEnv}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [PORT IN USE] Port ${config.port} is already being used by another process!`);
    console.error(`Run this command to clear it: lsof -ti :${config.port} | xargs kill -9\n`);
    process.exit(1);
  } else {
    console.error('[GameEngine Server] Server error:', err);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});


