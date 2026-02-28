/**
 * Zod Validation Middleware.
 *
 * Generic middleware that validates `req.body` against a Zod schema.
 * On failure, returns 400 with field-level error details.
 * On success, passes validated data forward.
 *
 * Usage:
 *   router.post('/chat', validate(ChatRequestSchema), handleChat);
 */

import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import type { ZodSchema } from "zod";
import { ValidationError } from "../errors.js";

/**
 * Creates Express middleware that validates req.body against a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const fieldErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        next(new ValidationError("Request validation failed", fieldErrors));
        return;
      }
      next(error);
    }
  };
}
