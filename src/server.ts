import { createApp } from './app.js';
import { config } from './config/index.js';
import dotenv from 'dotenv';

dotenv.config();

const app = createApp();

app.listen(config.port, () => {
  console.log(`Vera listening on port ${config.port}`);
});
