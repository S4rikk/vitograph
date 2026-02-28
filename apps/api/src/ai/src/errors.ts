/**
 * Application Error Hierarchy.
 *
 * Custom error classes for structured HTTP error responses.
 * All domain errors extend `AppError`, which carries:
 * - HTTP status code
 * - `isOperational` flag (true = expected, false = bug)
 *
 * The global error handler reads these fields to produce
 * clean JSON responses without leaking stack traces in production.
 */

/** Base application error with HTTP status code. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 — Request body or params failed Zod validation. */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly errors: readonly { field: string; message: string }[] = [],
  ) {
    super(message, 400);
  }
}

/** 404 — Requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

/** 500 — Unexpected internal failure. */
export class InternalError extends AppError {
  constructor(message: string = "Internal server error") {
    super(message, 500, false);
  }
}
