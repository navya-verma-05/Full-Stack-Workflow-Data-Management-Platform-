import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listRecordsSchema } from '../validators/dashboardValidators.js';
import * as dashboardController from '../controllers/dashboardController.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('admin', 'manager', 'viewer'),
  validate(listRecordsSchema),
  dashboardController.getRecords
);

export default router;
