import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  metricsSummarySchema,
  metricsTimeSeriesSchema,
} from '../validators/dashboardValidators.js';
import * as metricsController from '../controllers/metricsController.js';

const router = Router();

router.use(authenticate);

router.get(
  '/summary',
  authorize('admin', 'manager', 'viewer'),
  validate(metricsSummarySchema),
  metricsController.summary
);

router.get(
  '/timeseries',
  authorize('admin', 'manager', 'viewer'),
  validate(metricsTimeSeriesSchema),
  metricsController.timeSeries
);

export default router;

