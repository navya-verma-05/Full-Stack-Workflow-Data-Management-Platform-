import { Router } from 'express';
import { User } from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/authValidators.js';
import * as authController from '../controllers/authController.js';

const router = Router();

async function allowBootstrapOrAdmin(req, res, next) {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      req.isBootstrapRegistration = true;
      return next();
    }
    return authenticate(req, res, (authErr) => {
      if (authErr) return next(authErr);
      return authorize('admin')(req, res, next);
    });
  } catch (err) {
    return next(err);
  }
}

router.post(
  '/register',
  authLimiter,
  allowBootstrapOrAdmin,
  validate(registerSchema),
  authController.register
);

router.post('/login', authLimiter, validate(loginSchema), authController.login);

router.post('/refresh', authLimiter, authController.refresh);

router.post('/logout', authController.logout);

router.get('/me', authenticate, authorize('admin', 'manager', 'viewer'), authController.me);

export default router;

