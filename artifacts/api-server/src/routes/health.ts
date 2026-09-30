import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (req, res) => {
  if (req.query.check === "db") {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", db: "connected" });
      return;
    } catch (err: any) {
      res.status(503).json({ status: "error", error: "Database connection failed", details: err?.message });
      return;
    }
  }

  res.json({ status: "ok" });
});

router.get("/readyz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err: any) {
    res.status(503).json({ status: "error", error: "Database connection failed", details: err?.message });
  }
});

export default router;
