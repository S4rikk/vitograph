import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { pythonCore, ProfileSchema } from "../lib/python-core.js";
import { AppError } from "../errors.js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const router = Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// ── Schemas ─────────────────────────────────────────────────────────

const NormRequestSchema = z.object({
  biomarker: z.string().min(1),
  profile: ProfileSchema,
});

// ── Handlers ────────────────────────────────────────────────────────

/**
 * POST /api/v1/integration/norms
 * Calculate dynamic norms via Python Engine
 */
router.post(
  "/norms",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = NormRequestSchema.parse(req.body);

      const result = await pythonCore.calculateNormsAction(
        body.biomarker,
        body.profile
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/integration/parse
 * Parse lab report file (PDF, DOCX, or TXT) via Python Engine
 */
const ALLOWED_MIMETYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

router.post(
  "/parse",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file;

      if (!file) {
        throw new AppError("No file uploaded", 400);
      }

      // Accept PDF, TXT, and DOCX — also check extension as fallback for TXT MIME detection
      const isAllowedMime = ALLOWED_MIMETYPES.includes(file.mimetype);
      const isAllowedExt = /\.(pdf|txt|docx)$/i.test(file.originalname || "");
      if (!isAllowedMime && !isAllowedExt) {
        throw new AppError("Supported formats: PDF, DOCX, TXT", 400);
      }

      const locale = req.headers["accept-language"]?.split(",")[0].trim() || "ru";

      const extraction = await pythonCore.parsePdf(
        file.buffer,
        file.originalname,
        locale
      );

      res.json({ success: true, data: extraction });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/integration/parse-image
 * Parse lab report PHOTO (JPEG/PNG/HEIC) via Python Vision Engine
 */
router.post(
  "/parse-image",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("[parse-image] ①  Handler entered");
      const file = (req as any).file;

      if (!file) {
        throw new AppError("No file uploaded", 400);
      }

      console.log(`[parse-image] ②  File received: ${file.originalname || 'unknown'}, size=${file.size || file.buffer?.length}, mime=${file.mimetype}`);

      const mimeType: string = file.mimetype || "";
      if (!mimeType.startsWith("image/")) {
        throw new AppError("Expected an image file (JPEG, PNG, HEIC)", 400);
      }

      console.log("[parse-image] ③  Calling Python parseImage...");
      const locale = req.headers["accept-language"]?.split(",")[0].trim() || "ru";
      const extraction = await pythonCore.parseImage(file.buffer, mimeType, locale);
      console.log(`[parse-image] ④  Python returned: biomarkers=${extraction?.biomarkers?.length ?? 0}`);

      console.log("[parse-image] ⑤  Sending response...");
      res.json({ success: true, data: extraction });
      console.log("[parse-image] ⑥  Response sent successfully");
    } catch (error: unknown) {
      console.error("[parse-image] ❌ CRASH:", error instanceof Error ? error.stack : error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/integration/parse-image-batch
 * Parse a BATCH of lab report PHOTOS (JPEG/PNG/HEIC) via Python Vision Engine
 */
router.post(
  "/parse-image-batch",
  upload.array("files", 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("[parse-image-batch] ①  Handler entered");
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new AppError("No files uploaded", 400);
      }

      if (files.length > 10) {
        throw new AppError("Максимальное количество файлов для пакетной загрузки — 10.", 400);
      }

      console.log(`[parse-image-batch] ②  Files received: ${files.length}`);

      for (const file of files) {
        const mimeType: string = file.mimetype || "";
        if (!mimeType.startsWith("image/")) {
          throw new AppError(`Expected an image file, got ${mimeType} for ${file.originalname}`, 400);
        }
      }

      console.log("[parse-image-batch] ③  Calling Python parseImageBatch...");
      const locale = req.headers["accept-language"]?.split(",")[0].trim() || "ru";
      const extraction = await pythonCore.parseImageBatch(files, locale);
      console.log(`[parse-image-batch] ④  Python returned: biomarkers=${extraction?.biomarkers?.length ?? 0}`);

      console.log("[parse-image-batch] ⑤  Sending response...");
      res.json({ success: true, data: extraction });
      console.log("[parse-image-batch] ⑥  Response sent successfully");
    } catch (error: unknown) {
      console.error("[parse-image-batch] ❌ CRASH:", error instanceof Error ? error.stack : error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/integration/refresh-notes
 * Recalculate biomarker notes and flags via Python Engine
 */
router.post(
  "/refresh-notes",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const locale = req.headers["accept-language"]?.split(",")[0].trim() || "ru";
      const result = await pythonCore.refreshBiomarkerNotesAction(req.body.biomarkers, locale);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/integration/parse-image-batch-async
 * Initiate async batch OCR via Python BackgroundTasks
 */
router.post(
  "/parse-image-batch-async",
  upload.array("files", 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("[parse-image-batch-async] ①  Handler entered");
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new AppError("No files uploaded", 400);
      }
      if (files.length > 10) {
        throw new AppError("Max 10 files", 400);
      }

      for (const file of files) {
        if (!file.mimetype?.startsWith("image/")) {
          throw new AppError(`Expected image, got ${file.mimetype}`, 400);
        }
      }

      // Extract auth token
      const authToken = req.headers.authorization?.split(" ")[1];
      if (!authToken) {
        throw new AppError("Missing Authorization token", 401);
      }

      console.log(`[parse-image-batch-async] ②  Files: ${files.length}, forwarding to Python...`);
      const locale = req.headers["accept-language"]?.split(",")[0].trim() || "ru";
      const result = await pythonCore.parseImageBatchAsync(files, authToken, locale);
      console.log(`[parse-image-batch-async] ③  Job created: ${result.job_id}`);

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("[parse-image-batch-async] ❌ CRASH:", error instanceof Error ? error.stack : error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/integration/lab-scans/:jobId
 * Polling fallback for async OCR job status
 */
router.get(
  "/lab-scans/:jobId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authToken = req.headers.authorization?.split(" ")[1];
      if (!authToken) {
        throw new AppError("Missing Authorization token", 401);
      }
      const result = await pythonCore.getLabScanStatus(String(req.params.jobId), authToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export const integrationRouter = router;
