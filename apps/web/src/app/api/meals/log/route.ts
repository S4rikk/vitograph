/**
 * POST /api/meals/log — Next.js App Router API Route
 *
 * Accepts a meal log from the Food Diary Chat UI.
 * Validates input with Zod, delegates to MealService,
 * and returns the persisted meal + AI chat response.
 *
 * REQUEST BODY (application/json):
 *   {
 *     dishName: string,       // "Грильд лосось с авокадо"
 *     weightGrams: number,    // 250
 *     mealType: "breakfast" | "lunch" | "dinner" | "snack" | "drink",
 *     notes?: string,
 *     symptoms?: [{ name: string, severity: 1-10, onsetDelayMinutes?: number }]
 *   }
 *
 * RESPONSE 201 (application/json):
 *   {
 *     mealId: number,
 *     loggedAt: ISO-8601,
 *     totalCalories: number | null,
 *     hasSymptoms: boolean,
 *     aiResponse: { message, strategy, alternatives, confidence }
 *   }
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { LogMealRequestSchema } from "@/lib/food-diary/meal.schemas";
import { createMealLog } from "@/lib/food-diary/meal.service";
import {
  AppError,
  toErrorResponse,
  getStatusCode,
} from "@/lib/errors";

/**
 * Extracts the authenticated user ID from the request.
 *
 * TODO: Replace with actual auth check (Supabase JWT / NextAuth).
 * Currently reads from `x-user-id` header for development.
 */
function getUserId(request: NextRequest): string | null {
  return request.headers.get("x-user-id");
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    // ── Auth check ──────────────────────────────────────────────
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { status: "error", message: "Missing x-user-id header" },
        { status: 401 },
      );
    }

    // ── Parse & validate request body ───────────────────────────
    const body: unknown = await request.json();
    const input = LogMealRequestSchema.parse(body);

    // ── Delegate to service layer ───────────────────────────────
    const result = await createMealLog(userId, input);

    // ── Return success response ─────────────────────────────────
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // ── Zod validation errors → 400 ─────────────────────────────
    if (error instanceof ZodError) {
      const fieldErrors = error.issues.map((e) => ({
        field: String(e.path.join(".")),
        message: String(e.message),
      }));

      return NextResponse.json(
        {
          status: "error",
          message: "Validation failed",
          errors: fieldErrors,
        },
        { status: 400 },
      );
    }

    // ── Application errors → mapped status code ─────────────────
    if (error instanceof AppError) {
      return NextResponse.json(
        toErrorResponse(error),
        { status: getStatusCode(error) },
      );
    }

    // ── Unexpected errors → 500 ─────────────────────────────────
    console.error("[POST /api/meals/log] Unexpected error:", error);
    return NextResponse.json(
      toErrorResponse(error),
      { status: 500 },
    );
  }
}
