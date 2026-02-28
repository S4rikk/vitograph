/**
 * MealService — Core Business Logic for Food Diary
 *
 * Orchestrates the meal logging workflow:
 *   1. Validate & resolve food item (find or create in DB)
 *   2. Persist MealLog + MealItem + optional GutSymptomLog in a transaction
 *   3. Generate synchronous psychological response (CBT)
 *   4. Emit async event for background AI analysis
 *
 * ARCHITECTURE DECISION: The psychological response is generated
 * SYNC (before API returns) because the user expects immediate
 * chat feedback. Correlation analysis and diagnostics are ASYNC
 * via the HealthEventBus.
 */

import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

import type {
  LogMealRequest,
  LogMealResponse,
  AiChatResponse,
} from "./meal.schemas";
import { healthEventBus } from "./health-event-bus";
import {
  generatePsychologicalResponse,
  type FoodContext,
  type UserProfileContext,
} from "./ai-triggers";

// ── Internal Types ──────────────────────────────────────────────────

/**
 * Result of food item resolution (find or create).
 * Uses plain types to avoid coupling to Prisma runtime internals.
 */
interface ResolvedFood {
  readonly id: number;
  readonly nameEn: string;
  readonly category: string;
  readonly caloriesPer100g: { toNumber(): number } | number;
  readonly glycemicIndex: number | null;
  readonly commonAllergens: unknown;
}

// ═══════════════════════════════════════════════════════════════════════
// §1  FOOD RESOLUTION — Find or create FoodItem by name
// ═══════════════════════════════════════════════════════════════════════

/**
 * Resolves a dish name to a FoodItem record.
 *
 * Strategy:
 *   1. Exact match on nameEn or nameRu (case-insensitive)
 *   2. If not found, create a minimal stub record
 *      (AI enrichment fills in nutrition data later)
 *
 * @param dishName - Free-text dish name from user input
 * @returns The resolved or newly created FoodItem
 */
async function resolveFood(dishName: string): Promise<ResolvedFood> {
  const normalizedName = dishName.trim().toLowerCase();

  // Try to find an existing food item
  const existing = await prisma.foodItem.findFirst({
    where: {
      OR: [
        { nameEn: { equals: normalizedName, mode: "insensitive" } },
        { nameRu: { equals: normalizedName, mode: "insensitive" } },
      ],
      isActive: true,
    },
    select: {
      id: true,
      nameEn: true,
      category: true,
      caloriesPer100g: true,
      glycemicIndex: true,
      commonAllergens: true,
    },
  });

  if (existing) {
    return existing;
  }

  // Create a stub food item — AI enrichment will fill in details later
  const created = await prisma.foodItem.create({
    data: {
      nameEn: dishName.trim(),
      nameRu: dishName.trim(),
      category: "uncategorized",
      caloriesPer100g: 0,
      proteinG: 0,
      fatG: 0,
      carbsG: 0,
      fiberG: 0,
    },
    select: {
      id: true,
      nameEn: true,
      category: true,
      caloriesPer100g: true,
      glycemicIndex: true,
      commonAllergens: true,
    },
  });

  return created;
}

// ═══════════════════════════════════════════════════════════════════════
// §2  USER PROFILE — Fetch minimal context for AI personalization
// ═══════════════════════════════════════════════════════════════════════

/**
 * Loads the minimal user profile needed for AI personalization.
 *
 * @param userId - UUID from auth
 * @returns Profile context or throws NotFoundError
 */
async function loadUserProfile(
  userId: string,
): Promise<UserProfileContext> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      biologicalSex: true,
      dietType: true,
      chronicConditions: true,
      activityLevel: true,
    },
  });

  if (!profile) {
    throw new NotFoundError(`Profile not found for user ${userId}`);
  }

  return {
    userId,
    biologicalSex: profile.biologicalSex,
    dietType: profile.dietType,
    chronicConditions: Array.isArray(profile.chronicConditions)
      ? (profile.chronicConditions as string[])
      : [],
    activityLevel: profile.activityLevel,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// §3  CREATE MEAL LOG — Main orchestration method
// ═══════════════════════════════════════════════════════════════════════

/**
 * Creates a complete meal log entry with all side effects.
 *
 * Workflow:
 *   1. Resolve food item (find or create)
 *   2. Load user profile for AI context
 *   3. Prisma transaction: MealLog + MealItem + GutSymptomLog(s)
 *   4. Generate SYNC psychological response
 *   5. Emit ASYNC event for background AI analysis
 *   6. Return structured response
 *
 * @param userId - Authenticated user's UUID
 * @param input - Validated LogMealRequest from Zod
 * @returns Complete response with meal data + AI chat message
 */
export async function createMealLog(
  userId: string,
  input: LogMealRequest,
): Promise<LogMealResponse> {
  // §3.1 — Resolve food item
  const food = await resolveFood(input.dishName);

  // §3.2 — Load user profile for AI personalization
  const userProfile = await loadUserProfile(userId);

  // §3.3 — Calculate calories from food DB
  const caloriesPer100g = Number(food.caloriesPer100g);
  const totalCalories =
    caloriesPer100g > 0
      ? Math.round((caloriesPer100g * input.weightGrams) / 100)
      : null;

  // §3.4 — Prisma transaction: MealLog + MealItem + GutSymptomLog(s)
  const now = new Date();
  const hasSymptoms = Boolean(input.symptoms && input.symptoms.length > 0);

  const mealLog = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
    // Create the meal log
    const meal = await tx.mealLog.create({
      data: {
        userId,
        loggedAt: now,
        mealType: input.mealType,
        totalCalories,
        notes: input.notes ?? null,
        items: {
          create: {
            foodItemId: food.id,
            foodName: input.dishName.trim(),
            portionGrams: input.weightGrams,
            calories: totalCalories,
          },
        },
      },
      select: {
        id: true,
        loggedAt: true,
        totalCalories: true,
      },
    });

    // Create symptom logs if provided
    if (input.symptoms && input.symptoms.length > 0) {
      for (const symptom of input.symptoms) {
        await tx.gutSymptomLog.create({
          data: {
            userId,
            loggedAt: now,
            symptoms: [symptom.name],
            severity: symptom.severity,
            onsetDelayMinutes: symptom.onsetDelayMinutes ?? null,
            linkedMealId: meal.id,
          },
        });
      }
    }

    return meal;
  });

  // §3.5 — Synchronous AI response (user expects immediate chat reply)
  const foodContext: FoodContext = {
    name: food.nameEn,
    category: food.category,
    glycemicIndex: food.glycemicIndex,
    commonAllergens: Array.isArray(food.commonAllergens)
      ? (food.commonAllergens as string[])
      : [],
    caloriesPer100g: Number(food.caloriesPer100g),
  };

  const psychResponse =
    await generatePsychologicalResponse(foodContext, userProfile);

  const aiResponse: AiChatResponse = {
    message: psychResponse.message,
    strategy: psychResponse.strategy,
    alternatives: [...psychResponse.alternatives],
    confidence: psychResponse.confidence,
  };

  // §3.6 — Async event for background AI analysis (fire-and-forget)
  const symptomNames = input.symptoms
    ? input.symptoms.map((s) => s.name)
    : [];

  healthEventBus.emit("meal:logged", {
    userId,
    mealId: mealLog.id,
    dishName: input.dishName,
    weightGrams: input.weightGrams,
    mealType: input.mealType,
    hasSymptoms,
    symptomNames,
    timestamp: now,
  });

  // §3.7 — Build and return response
  return {
    mealId: mealLog.id,
    loggedAt: mealLog.loggedAt.toISOString(),
    totalCalories: mealLog.totalCalories
      ? Number(mealLog.totalCalories)
      : null,
    hasSymptoms,
    aiResponse,
  };
}
