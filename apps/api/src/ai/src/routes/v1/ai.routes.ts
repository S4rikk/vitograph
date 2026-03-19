/**
 * AI Routes v1 — REST endpoints for the AI engine.
 *
 * POST /api/v1/ai/chat     → Psychological CBT response
 * POST /api/v1/ai/analyze  → Symptom correlation analysis
 * POST /api/v1/ai/diagnose → Diagnostic hypothesis generation
 *
 * Each route uses Zod validation middleware before the controller.
 */

import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import {
  ChatRequestSchema,
  AnalyzeRequestSchema,
  DiagnoseRequestSchema,
  AnalyzeSomaticRequestSchema,
  AnalyzeFoodRequestSchema,
  AnalyzeLabReportRequestSchema,
} from "../../request-schemas.js";
import {
  handleChat,
  handleAnalyze,
  handleDiagnose,
  handleAnalyzeSomatic,
  handleAnalyzeFood,
  handleGetChatHistory,
  handleClearChatHistory,
  handleAnalyzeLabReport,
  handleGetLabReportsHistory,
  handleDeleteLabReport,
  handleGetSomaticHistory,
  handleGetNutritionTargets,
} from "../../ai.controller.js";

/** AI engine router — mount at /api/v1/ai */
export const aiRouter = Router();

aiRouter.post("/chat", validate(ChatRequestSchema), handleChat);
aiRouter.get("/chat/history", handleGetChatHistory);
aiRouter.delete("/chat/history", handleClearChatHistory);

aiRouter.post("/analyze", validate(AnalyzeRequestSchema), handleAnalyze);
aiRouter.post("/diagnose", validate(DiagnoseRequestSchema), handleDiagnose);
aiRouter.post("/analyze-somatic", validate(AnalyzeSomaticRequestSchema), handleAnalyzeSomatic);
aiRouter.post("/analyze-food", validate(AnalyzeFoodRequestSchema), handleAnalyzeFood);
aiRouter.post("/analyze-lab-report", validate(AnalyzeLabReportRequestSchema), handleAnalyzeLabReport);
aiRouter.get("/lab-reports/history", handleGetLabReportsHistory);
aiRouter.delete("/lab-reports/history/:timestamp", handleDeleteLabReport);
aiRouter.get("/somatic-history", handleGetSomaticHistory);
aiRouter.get("/nutrition-targets", handleGetNutritionTargets);
