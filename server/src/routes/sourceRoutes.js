import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createSourceSchema,
  listSourcesSchema,
  sourceIdParamSchema,
  updateSourceSchema,
} from '../validators/sourceValidators.js';
import * as sourceController from '../controllers/sourceController.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('admin', 'manager', 'viewer'),
  validate(listSourcesSchema),
  sourceController.list
);

router.get(
  '/:id',
  authorize('admin', 'manager', 'viewer'),
  validate(sourceIdParamSchema),
  sourceController.getById
);

router.post(
  '/',
  authorize('admin'),
  validate(createSourceSchema),
  sourceController.create
);

router.patch(
  '/:id',
  authorize('admin'),
  validate(updateSourceSchema),
  sourceController.update
);

router.post(
  '/:id/rotate-secret',
  authorize('admin'),
  validate(sourceIdParamSchema),
  sourceController.rotateSecret
);

export default router;
