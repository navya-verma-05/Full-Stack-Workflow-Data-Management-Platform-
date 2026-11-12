import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listAuditLogsSchema } from '../validators/dashboardValidators.js';
import * as dashboardController from '../controllers/dashboardController.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('admin'),
  validate(listAuditLogsSchema),
  dashboardController.getAuditLogs
);

export default router;

