import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[GameEngine Server] Running on http://localhost:${config.port}`);
  console.log(`[GameEngine Server] Environment: ${config.nodeEnv}`);
});

