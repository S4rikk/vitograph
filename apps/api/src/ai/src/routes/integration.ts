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

      const extraction = await pythonCore.parsePdf(
        file.buffer,
        file.originalname
      );

      // --- Database Persistence ---
      if (extraction && Array.isArray(extraction.biomarkers) && extraction.biomarkers.length > 0 && req.user?.id) {
        const token = req.headers.authorization?.split(" ")[1];
        const supabaseUrl = process.env.SUPABASE_URL;
        // We use Service Role Key to bypass RLS mapping issues if needed, or ANON_KEY + Token
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

        if (token && supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey, {
            global: {
              headers: { Authorization: `Bearer ${token}` },
            },
          });

          // 1. Fetch Biomarkers Dict
          const { data: dbBiomarkers, error: bioError } = await supabase
            .from("biomarkers")
            .select("id, name_en, name_ru, code, aliases");

          if (!bioError && dbBiomarkers) {
            // 2. Map parsed string results to actual IDs
            const insertPayloads: any[] = [];
            const unmatchedMarkers: string[] = [];

            for (const item of extraction.biomarkers) {
              // Try to find a match (the python backend passes the name it found)
              // Name matching can be tricky due to casing/spaces, so we do a generous check
              const cleanItemName = (item.original_name || "").toLowerCase().trim();
              const match = dbBiomarkers.find(b => {
                const nameEn = (b.name_en || "").toLowerCase();
                const nameRu = (b.name_ru || "").toLowerCase();
                const aliases = Array.isArray(b.aliases) ? b.aliases.map((a: string) => a.toLowerCase()) : [];

                return nameEn === cleanItemName ||
                  nameRu === cleanItemName ||
                  aliases.includes(cleanItemName);
              });

              if (match) {
                insertPayloads.push({
                  user_id: req.user.id,
                  biomarker_id: match.id,
                  value: item.value_numeric !== null && item.value_numeric !== undefined ? item.value_numeric : item.value_string,
                  unit: item.unit,
                  test_date: extraction.report_date ? new Date(extraction.report_date).toISOString() : new Date().toISOString(),
                  source: "manual", // or clinical_lab
                });
              } else {
                unmatchedMarkers.push(item.original_name);
              }
            }

            if (unmatchedMarkers.length > 0) {
              console.warn(`[VisionMatch] Dropped unmatched biomarkers: [${unmatchedMarkers.join(", ")}]`);
            }

            // 3. Create a Test Session to group these results
            let currentSessionId: number | undefined;

            if (insertPayloads.length > 0) {
              const { data: sessionData, error: sessionError } = await supabase
                .from("test_sessions")
                .insert({
                  user_id: req.user.id,
                  test_date: extraction.report_date ? new Date(extraction.report_date).toISOString() : new Date().toISOString(),
                  source_file_path: file.originalname,
                  status: "completed"
                })
                .select("id")
                .single();

              if (sessionError) {
                console.error("[POST /parse] DB Session Insert Error:", sessionError);
              } else if (sessionData) {
                currentSessionId = sessionData.id;
              }

              // 4. Attach session_id and Bulk Insert
              const finalPayloads = insertPayloads.map(p => ({
                ...p,
                session_id: currentSessionId
              }));

              const { error: insertError } = await supabase
                .from("test_results")
                .insert(finalPayloads);

              if (insertError) {
                console.error("[POST /parse] DB Insert Error:", insertError);
              }
            }
          } else {
            console.error("[POST /parse] Failed to fetch biomarkers dict:", bioError);
          }
        }
      }

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
      const extraction = await pythonCore.parseImage(file.buffer, mimeType);
      console.log(`[parse-image] ④  Python returned: biomarkers=${extraction?.biomarkers?.length ?? 0}`);

      // --- Database Persistence (best-effort — never block the response) ---
      if (extraction && Array.isArray(extraction.biomarkers) && extraction.biomarkers.length > 0 && req.user?.id) {
        try {
          const token = req.headers.authorization?.split(" ")[1];
          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

          if (token && supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey, {
              global: {
                headers: { Authorization: `Bearer ${token}` },
              },
            });

            const { data: dbBiomarkers, error: bioError } = await supabase
              .from("biomarkers")
              .select("id, name_en, name_ru, code, aliases");

            if (!bioError && dbBiomarkers) {
              const insertPayloads: any[] = [];
              const unmatchedMarkers: string[] = [];

              for (const item of extraction.biomarkers) {
                const cleanItemName = (item.original_name || "").toLowerCase().trim();
                const match = dbBiomarkers.find(b => {
                  const nameEn = (b.name_en || "").toLowerCase();
                  const nameRu = (b.name_ru || "").toLowerCase();
                  const aliases = Array.isArray(b.aliases) ? b.aliases.map((a: string) => a.toLowerCase()) : [];
                  return nameEn === cleanItemName || nameRu === cleanItemName || aliases.includes(cleanItemName);
                });

                if (match) {
                  insertPayloads.push({
                    user_id: req.user!.id,
                    biomarker_id: match.id,
                    value: item.value_numeric !== null && item.value_numeric !== undefined ? item.value_numeric : item.value_string,
                    unit: item.unit,
                    test_date: extraction.report_date ? new Date(extraction.report_date).toISOString() : new Date().toISOString(),
                    source: "manual",
                  });
                } else {
                  unmatchedMarkers.push(item.original_name);
                }
              }

              if (unmatchedMarkers.length > 0) {
                console.warn(`[VisionMatch] Dropped unmatched biomarkers: [${unmatchedMarkers.join(", ")}]`);
              }

              let currentSessionId: number | undefined;

              if (insertPayloads.length > 0) {
                const { data: sessionData, error: sessionError } = await supabase
                  .from("test_sessions")
                  .insert({
                    user_id: req.user!.id,
                    test_date: extraction.report_date ? new Date(extraction.report_date).toISOString() : new Date().toISOString(),
                    source_file_path: file.originalname || "lab_report_photo.jpg",
                    status: "completed"
                  })
                  .select("id")
                  .single();

                if (sessionError) {
                  console.error("[POST /parse-image] DB Session Insert Error:", sessionError);
                } else if (sessionData) {
                  currentSessionId = sessionData.id;
                }

                const finalPayloads = insertPayloads.map(p => ({
                  ...p,
                  session_id: currentSessionId
                }));

                const { error: insertError } = await supabase
                  .from("test_results")
                  .insert(finalPayloads);

                if (insertError) {
                  console.error("[POST /parse-image] DB Insert Error:", insertError);
                }
              }
            }
          }
        } catch (dbError) {
          // DB persistence is best-effort — log but never crash the request
          console.error("[POST /parse-image] DB persistence failed (non-fatal):", dbError);
        }
      }

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
      const extraction = await pythonCore.parseImageBatch(files);
      console.log(`[parse-image-batch] ④  Python returned: biomarkers=${extraction?.biomarkers?.length ?? 0}`);

      // --- Database Persistence (best-effort) ---
      if (extraction && Array.isArray(extraction.biomarkers) && extraction.biomarkers.length > 0 && req.user?.id) {
        try {
          const token = req.headers.authorization?.split(" ")[1];
          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

          if (token && supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey, {
              global: {
                headers: { Authorization: `Bearer ${token}` },
              },
            });

            const { data: dbBiomarkers, error: bioError } = await supabase
              .from("biomarkers")
              .select("id, name_en, name_ru, code, aliases");

            if (!bioError && dbBiomarkers) {
              const insertPayloads: any[] = [];
              const unmatchedMarkers: string[] = [];

              for (const item of extraction.biomarkers) {
                const cleanItemName = (item.original_name || "").toLowerCase().trim();
                const match = dbBiomarkers.find(b => {
                  const nameEn = (b.name_en || "").toLowerCase();
                  const nameRu = (b.name_ru || "").toLowerCase();
                  const aliases = Array.isArray(b.aliases) ? b.aliases.map((a: string) => a.toLowerCase()) : [];
                  return nameEn === cleanItemName || nameRu === cleanItemName || aliases.includes(cleanItemName);
                });

                if (match) {
                  insertPayloads.push({
                    user_id: req.user!.id,
                    biomarker_id: match.id,
                    value: item.value_numeric !== null && item.value_numeric !== undefined ? item.value_numeric : item.value_string,
                    unit: item.unit,
                    test_date: extraction.report_date ? new Date(extraction.report_date).toISOString() : new Date().toISOString(),
                    source: "manual",
                  });
                } else {
                  unmatchedMarkers.push(item.original_name);
                }
              }

              if (unmatchedMarkers.length > 0) {
                console.warn(`[VisionMatch] Dropped unmatched biomarkers: [${unmatchedMarkers.join(", ")}]`);
              }

              let currentSessionId: number | undefined;

              if (insertPayloads.length > 0) {
                const sourceFilePath = files.map(f => f.originalname).join(", ").substring(0, 255);
                const { data: sessionData, error: sessionError } = await supabase
                  .from("test_sessions")
                  .insert({
                    user_id: req.user!.id,
                    test_date: extraction.report_date ? new Date(extraction.report_date).toISOString() : new Date().toISOString(),
                    source_file_path: sourceFilePath,
                    status: "completed"
                  })
                  .select("id")
                  .single();

                if (sessionError) {
                  console.error("[POST /parse-image-batch] DB Session Insert Error:", sessionError);
                } else if (sessionData) {
                  currentSessionId = sessionData.id;
                }

                const finalPayloads = insertPayloads.map(p => ({
                  ...p,
                  session_id: currentSessionId
                }));

                const { error: insertError } = await supabase
                  .from("test_results")
                  .insert(finalPayloads);

                if (insertError) {
                  console.error("[POST /parse-image-batch] DB Insert Error:", insertError);
                }
              }
            }
          }
        } catch (dbError) {
          console.error("[POST /parse-image-batch] DB persistence failed (non-fatal):", dbError);
        }
      }

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
      const result = await pythonCore.refreshBiomarkerNotesAction(req.body.biomarkers);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export const integrationRouter = router;
