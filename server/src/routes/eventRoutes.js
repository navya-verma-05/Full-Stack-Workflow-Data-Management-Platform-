import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { replayEventSchema } from "../validators/sourceValidators.js";
import {
  eventIdParamSchema,
  listEventsSchema,
} from "../validators/dashboardValidators.js";
import * as webhookController from "../controllers/webhookController.js";
import * as dashboardController from "../controllers/dashboardController.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("admin", "manager", "viewer"),
  validate(listEventsSchema),
  dashboardController.getEvents,
);

router.get(
  "/:id",
  authorize("admin", "manager", "viewer"),
  validate(eventIdParamSchema),
  dashboardController.getEvent,
);

router.post(
  "/:id/replay",
  authorize("admin", "manager"),
  validate(replayEventSchema),
  webhookController.replay,
);

export default router;
