import { z } from "zod";

// ── Configuration ───────────────────────────────────────────────────

const PYTHON_CORE_URL =
  process.env.PYTHON_CORE_URL || "http://localhost:8000";

// ── Types ───────────────────────────────────────────────────────────

export const ProfileSchema = z.object({
  age: z.number().min(0).max(120),
  is_smoker: z.boolean().default(false),
  is_pregnant: z.boolean().default(false),
  biological_sex: z.enum(["male", "female"]).optional(),
});

export const CalculationRequestSchema = z.object({
  biomarker: z.string(),
  profile: ProfileSchema,
});

export type CalculationRequest = z.infer<typeof CalculationRequestSchema>;

export interface NormResult {
  biomarker: string;
  low: number;
  high: number;
  unit: string;
  reason: string;
}

export interface ReferenceRange {
  low?: number | null;
  high?: number | null;
  text?: string | null;
}

export interface BiomarkerResult {
  original_name: string;
  standardized_slug: string;
  value_numeric?: number | null;
  value_string?: string | null;
  unit?: string | null;
  reference_range?: ReferenceRange | null;
  flag?: string | null;
  ai_clinical_note?: string | null;
}

export interface LabReportExtraction {
  report_date?: string | null;
  context?: string | null;
  biomarkers: BiomarkerResult[];
  general_recommendations: string[];
}

// ── Client ──────────────────────────────────────────────────────────

class PythonCoreClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  /**
   * Generic fetch wrapper with error handling
   */
  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 90_000
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[PythonCore] Calling ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Python Core Error (${response.status}): ${errorText}`);
        (error as any).statusCode = response.status;
        throw error;
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error("[PythonCore] Request failed:", error);
      throw error;
    }
  }

  /**
   * Calculate dynamic norms via Python Engine
   */
  async calculateNorms(payload: CalculationRequest): Promise<NormResult> {
    return this.request<NormResult>("/calculate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Flatten the structure for the Python API which expects query param + body
      // actually, let's check the python API.
      // Python API: POST /calculate?biomarker=X Body: { age, ... }
      // So we need to separate them.
    });
  }

  // Correction: The Python API is defined as:
  // @app.post("/calculate")
  // async def calculate_norm(biomarker: str, profile: UserProfile):

  async calculateNormsAction(biomarker: string, profile: z.infer<typeof ProfileSchema>): Promise<NormResult> {
    const params = new URLSearchParams({ biomarker });
    return this.request<NormResult>(`/calculate?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
  }

  /**
   * Parse lab report file (PDF, DOCX, or TXT) via Python Engine
   */
  async parsePdf(fileBuffer: Buffer, filename: string): Promise<LabReportExtraction> {
    const formData = new FormData();
    // In Node.js environment, FormData from 'undici' (global in Node 18+) 
    // requires a Blob. We can use `new Blob([buffer])`.

    // Determine MIME type from extension
    const ext = filename.split(".").pop()?.toLowerCase() || "pdf";
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      txt: "text/plain",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const mimeType = mimeMap[ext] || "application/octet-stream";

    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append("file", blob, filename);

    return this.request<LabReportExtraction>("/parse", {
      method: "POST",
      body: formData,
    });
  }

  /**
   * Parse lab report IMAGE (JPEG/PNG/HEIC) via Python Vision endpoint
   */
  async parseImage(imageBuffer: Buffer, mimeType: string): Promise<LabReportExtraction> {
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append("file", blob, "lab_report_photo.jpg");

    return this.request<LabReportExtraction>("/parse-image", {
      method: "POST",
      body: formData,
    });
  }

  /**
   * Parse a BATCH of lab report PHOTOS (JPEG/PNG/HEIC) via Python Vision endpoint
   */
  async parseImageBatch(files: Express.Multer.File[]): Promise<LabReportExtraction> {
    const formData = new FormData();

    for (const file of files) {
      const mimeType = file.mimetype || "application/octet-stream";
      const blob = new Blob([file.buffer], { type: mimeType });
      formData.append("files", blob, file.originalname || "lab_report_photo.jpg");
    }

    return this.request<LabReportExtraction>(
      "/parse-image-batch",
      {
        method: "POST",
        body: formData,
      },
      300_000 // 5 minute timeout for batch processing
    );
  }

  /**
   * Recalculate biomarker notes and flags via Python Engine
   */
  async refreshBiomarkerNotesAction(biomarkers: BiomarkerResult[]): Promise<{ index: number; ai_clinical_note: string; flag: string }[]> {
    return this.request<{ markers: { index: number; ai_clinical_note: string; flag: string }[] }>("/refresh-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ biomarkers })
    }).then(res => res.markers);
  }
}

export const pythonCore = new PythonCoreClient(PYTHON_CORE_URL);
