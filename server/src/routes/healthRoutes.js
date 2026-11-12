import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbConnected = dbState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbConnected ? 'connected' : 'disconnected',
  });
});

export default router;

