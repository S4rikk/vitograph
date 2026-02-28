/**
 * Application Error Hierarchy
 *
 * Layered error classes for structured HTTP error responses.
 * Each error carries a status code and operational flag for
 * distinguishing expected business errors from unexpected crashes.
 */

/** Base application error with HTTP status code. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 400 — Input validation failure (Zod, business rules). */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly errors?: ReadonlyArray<{
      readonly field: string;
      readonly message: string;
    }>,
  ) {
    super(message, 400);
  }
}

/** 404 — Resource not found. */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

/** 401 — Missing or invalid authentication. */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

/** 409 — Conflict (duplicate, concurrent modification). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/**
 * Maps any error to a structured JSON response body.
 *
 * Operational errors expose their message; unexpected errors
 * are masked in production to prevent information leakage.
 */
export function toErrorResponse(error: unknown): {
  status: "error";
  message: string;
  errors?: ReadonlyArray<{ field: string; message: string }>;
} {
  if (error instanceof ValidationError) {
    return {
      status: "error",
      message: error.message,
      ...(error.errors && { errors: error.errors }),
    };
  }

  if (error instanceof AppError) {
    return { status: "error", message: error.message };
  }

  // Mask unexpected errors in production
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error instanceof Error
        ? error.message
        : "Unknown error";

  return { status: "error", message };
}

/**
 * Extracts HTTP status code from any error.
 *
 * Falls back to 500 for non-AppError instances.
 */
export function getStatusCode(error: unknown): number {
  return error instanceof AppError ? error.statusCode : 500;
}
