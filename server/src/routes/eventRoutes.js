import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { replayEventSchema } from '../validators/sourceValidators.js';
import * as webhookController from '../controllers/webhookController.js';

const router = Router();

router.use(authenticate);

router.post(
  '/:id/replay',
  authorize('admin', 'manager'),
  validate(replayEventSchema),
  webhookController.replay
);

export default router;

