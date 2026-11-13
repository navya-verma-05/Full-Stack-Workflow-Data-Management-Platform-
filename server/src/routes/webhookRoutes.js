import { Router } from "express";
import { webhookLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import { webhookParamsSchema } from "../validators/webhookValidators.js";
import * as webhookController from "../controllers/webhookController.js";

const router = Router();

router.post(
  "/:sourceId",
  webhookLimiter,
  validate(webhookParamsSchema),
  webhookController.receive,
);

export default router;
