import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: `Request payload exceeds limit of ${env.REQUEST_BODY_LIMIT}`,
      },
    });
  }

  if (err instanceof SyntaxError && err?.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON request body',
      },
    });
  }

  if (err?.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Database validation failed',
        details,
      },
    });
  }

  if (err?.name === 'CastError') {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: `Invalid ${err.path}: ${err.value}`,
      },
    });
  }

  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: fields.length
          ? `Duplicate value for ${fields.join(', ')}`
          : 'Resource already exists',
      },
    });
  }

  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
      },
    });
  }

  logger.error({ err, method: req.method, path: req.originalUrl }, 'Unhandled server error');

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error',
    },
  });
}

