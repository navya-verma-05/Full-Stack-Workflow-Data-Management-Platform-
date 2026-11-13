import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (req, res) => {
  const conn = req.app.get("dbConnection") || mongoose.connection;
  const dbState = conn.readyState;
  const dbConnected = dbState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? "ok" : "degraded",
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbConnected ? "connected" : "disconnected",
  });
});

export default router;
