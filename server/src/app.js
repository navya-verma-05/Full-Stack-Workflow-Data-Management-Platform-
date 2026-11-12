import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    })
  );

  app.use(
    pinoHttp({
      logger,
      autoLogging: env.NODE_ENV !== 'test',
    })
  );

  app.use(
    express.json({
      limit: env.REQUEST_BODY_LIMIT,
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.use(cookieParser());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', apiLimiter, authRoutes);
  app.use('/api/users', apiLimiter, userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

