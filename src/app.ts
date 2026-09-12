import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { createVeraRoutes } from './routes/veraRoutes.js';

dotenv.config();

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/v1', createVeraRoutes());

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error(err);
    res.status(500).json({ error: 'internal_server_error' });
  });

  return app;
}
