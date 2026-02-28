/**
 * HealthEventBus — Typed Event Emitter for Cross-Domain AI Triggers
 *
 * Implements the mediator pattern: domain services emit events,
 * AI analysis services subscribe. Decouples the "save" path from
 * the "analyze" path, enabling async AI processing without blocking
 * the API response.
 *
 * ARCHITECTURE:
 *   MealService.createMealLog()
 *       │
 *       ▼
 *   healthEventBus.emit("meal:logged", payload)
 *       │
 *       ├──▶ analyzeSymptomCorrelation()   [async, fire-and-forget]
 *       ├──▶ generateDiagnosticHypothesis() [async, fire-and-forget]
 *       └──▶ (future listeners...)
 *
 * NOTE: generatePsychologicalResponse() is called SYNCHRONOUSLY
 * by MealService, not via the event bus, because the user expects
 * an immediate chat reply.
 */

import { EventEmitter } from "events";

// ── Domain Event Payloads ───────────────────────────────────────────

/** Emitted after a meal is successfully persisted. */
export interface MealLoggedEvent {
  readonly userId: string;
  readonly mealId: number;
  readonly dishName: string;
  readonly weightGrams: number;
  readonly mealType: string;
  readonly hasSymptoms: boolean;
  readonly symptomNames: readonly string[];
  readonly timestamp: Date;
}

/** Emitted when a gut symptom is reported (standalone, not with meal). */
export interface SymptomReportedEvent {
  readonly userId: string;
  readonly symptomLogId: number;
  readonly symptoms: readonly string[];
  readonly severity: number;
  readonly linkedMealId: number | null;
  readonly timestamp: Date;
}

/** Emitted when new biomarker results are ingested. */
export interface BiomarkerUpdatedEvent {
  readonly userId: string;
  readonly sessionId: number;
  readonly biomarkerCodes: readonly string[];
  readonly timestamp: Date;
}

/** Registry of all domain events and their payload types. */
export interface HealthEventMap {
  "meal:logged": MealLoggedEvent;
  "symptom:reported": SymptomReportedEvent;
  "biomarker:updated": BiomarkerUpdatedEvent;
}

// ── Typed Event Bus ─────────────────────────────────────────────────

/**
 * Type-safe event bus for health domain events.
 *
 * Wraps Node.js EventEmitter with generic typing so listeners
 * receive correctly typed payloads without casting.
 */
class HealthEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Prevent memory leaks from too many listeners in dev
    this.emitter.setMaxListeners(20);
  }

  /**
   * Subscribe to a domain event.
   *
   * Listener errors are caught and logged to prevent one failing
   * subscriber from affecting others.
   */
  on<K extends keyof HealthEventMap>(
    event: K,
    listener: (payload: HealthEventMap[K]) => void | Promise<void>,
  ): void {
    this.emitter.on(event, async (payload: HealthEventMap[K]) => {
      try {
        await listener(payload);
      } catch (error) {
        console.error(
          `[HealthEventBus] Error in listener for "${event}":`,
          error,
        );
      }
    });
  }

  /**
   * Emit a domain event to all registered listeners.
   *
   * Returns immediately — listeners execute asynchronously.
   */
  emit<K extends keyof HealthEventMap>(
    event: K,
    payload: HealthEventMap[K],
  ): void {
    this.emitter.emit(event, payload);
  }

  /** Remove all listeners (useful for testing). */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

/** Singleton event bus instance shared across the application. */
export const healthEventBus = new HealthEventBus();
