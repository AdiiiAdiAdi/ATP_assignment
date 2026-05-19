import { Router } from "express";
import { db } from "../db";

const router = Router();

// GET /health - Server health check endpoint
router.get("/", async (_, res) => {
  const startTime = Date.now();

  let dbStatus = "connected";
  try {
    await db.query("SELECT 1");
  } catch {
    dbStatus = "disconnected";
  }

  const latencyMs = Date.now() - startTime;

  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    dbLatencyMs: latencyMs,
    timestamp: new Date().toISOString(),
  });
});

export default router;
