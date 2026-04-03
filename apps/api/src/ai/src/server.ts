/**
 * Express Server Entry Point — VITOGRAPH AI Engine.
 *
 * Middleware stack (in order):
 * 1. helmet     — Security headers
 * 2. cors       — Cross-Origin (allow all for dev)
 * 3. morgan     — HTTP request logging
 * 4. json       — Body parser (1mb limit)
 * 5. routes     — Business logic
 * 6. errorHandler — Global catch-all
 *
 * Health check: GET /health
 * AI routes:    POST /api/v1/ai/{chat,analyze,diagnose}
 */

import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { requireAuth } from "./middleware/auth.js";
import { aiRouter } from "./routes/v1/ai.routes.js";
import { supplementRouter } from "./routes/v1/supplement.routes.js";
import { profilesRouter } from "./routes/v1/profiles.routes.js";
import { integrationRouter } from "./routes/integration.js";
import { errorHandler } from "./middleware/error-handler.js";
import { initCheckpointer } from "./graph/checkpointer.js";

// ── Configuration ───────────────────────────────────────────────────

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const VERSION = "0.1.0";

// ── Express App ─────────────────────────────────────────────────────

const app = express();

/* §1 Security headers */
app.use(helmet());

/* §2 CORS — allow all origins for development */
app.use(cors());

/* §3 Request logging */
app.use(morgan("dev"));

/* §4 Body parser */
app.use(express.json({ limit: "1mb" }));

// ── Health Check ────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: VERSION,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──────────────────────────────────────────────────────

app.use("/api/v1/ai", requireAuth, aiRouter);
app.use("/api/v1/supplements", requireAuth, supplementRouter);
app.use("/api/v1/profiles", requireAuth, profilesRouter);
app.use("/api/v1/integration", requireAuth, integrationRouter);

// ── 404 fallback ────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    error: true,
    message: "Route not found",
  });
});

// ── Global Error Handler (must be last) ─────────────────────────────

app.use(errorHandler);

// ── Start ───────────────────────────────────────────────────────────

async function startServer() {
  // Initialize persistent checkpointer (creates tables if needed)
  await initCheckpointer();

  app.listen(PORT, () => {
    const hasKey = Boolean(process.env["OPENAI_API_KEY"]);
    console.log(`
╔══════════════════════════════════════════╗
║  VITOGRAPH AI Engine v${VERSION}             ║
║  Port: ${PORT}                              ║
║  OpenAI: ${hasKey ? "✅ configured" : "❌ not set (fallbacks)"}        ║
╚══════════════════════════════════════════╝
    `);

    // Keep the process alive explicitly 
    process.stdin.resume();
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export { app };
