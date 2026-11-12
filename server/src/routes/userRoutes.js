import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listUsersSchema,
  updateUserSchema,
  userIdParamSchema,
} from '../validators/userValidators.js';
import * as userController from '../controllers/userController.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin'), validate(listUsersSchema), userController.list);
router.get('/:id', authorize('admin'), validate(userIdParamSchema), userController.getById);
router.patch('/:id', authorize('admin'), validate(updateUserSchema), userController.update);

export default router;

