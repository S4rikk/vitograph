/**
 * Global Error Handler Middleware.
 *
 * Catches ALL errors thrown/passed via next(error) and returns
 * structured JSON responses. Never leaks stack traces in production.
 *
 * Pattern from nodejs-backend-patterns skill (§ Error Handling).
 */

import type { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../errors.js";

/** Determines if the current environment is production. */
const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

/**
 * Express error-handling middleware (4 args required by Express).
 *
 * @param err - Error thrown in route handler or middleware
 * @param _req - Express request (unused but required by signature)
 * @param res - Express response
 * @param _next - Next function (unused but required by signature)
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  /* ── Known operational errors ──────────────────────────────── */
  if (err instanceof AppError || ('statusCode' in err && typeof (err as any).statusCode === 'number')) {
    const statusCode = err instanceof AppError ? err.statusCode : (err as any).statusCode;
    const message = err.message;

    const payload: Record<string, unknown> = {
      error: true,
      message: message,
    };

    if (err instanceof ValidationError && err.errors.length > 0) {
      payload["details"] = err.errors;
    } else if ('errors' in err && Array.isArray((err as any).errors)) {
      payload["details"] = (err as any).errors;
    }

    res.status(statusCode).json(payload);
    return;
  }

  /* ── Unexpected errors — log and hide details ──────────────── */
  console.error("[Server] Unhandled error:", err);

  res.status(500).json({
    error: true,
    message: IS_PRODUCTION ? "Internal server error" : err.message,
  });
}
