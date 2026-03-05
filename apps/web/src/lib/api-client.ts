import type { SupabaseClient } from "@supabase/supabase-js";

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    // Client-side: use relative path to hit Next.js rewrites proxy.
    // This is needed for non-AI routes (profiles, analytics) that are
    // proxied to Python (port 8000) via separate rewrite rules.
    return "/api/v1/ai";
  }
  // Server-side fallback 
  return process.env.AI_API_URL || "http://localhost:3001/api/v1/ai";
};

/**
 * Returns direct backend URL for long-running AI requests that would
 * exceed the Next.js proxy's ~30s connection timeout.
 * Used only by uploadImageFile() and analyzeLabReport().
 */
const getDirectAiUrl = () => {
  return process.env.NEXT_PUBLIC_AI_DIRECT_URL || "http://localhost:3001/api/v1/ai";
};

// Client-side auth dependency (lazy load to avoid build errors if used on server)
let supabaseClient: SupabaseClient | null = null;
let tokenPromise: Promise<string | null> | null = null;

const getAuthToken = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null;

  // Deduplicate concurrent token requests to prevent Supabase LockManager timeouts
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      if (!supabaseClient) {
        const { createClient } = await import("@/lib/supabase/client");
        supabaseClient = createClient();
      }

      const { data } = await supabaseClient.auth.getSession();
      return data.session?.access_token ?? null;
    } finally {
      // Clear the promise so future calls fetch fresh tokens,
      // but debounce concurrent calls happening in within the same event loop/render cycle
      setTimeout(() => {
        tokenPromise = null;
      }, 1000);
    }
  })();

  return tokenPromise;
};

/* ── Type Definitions (Mirrors API Schemas) ────────────────────────── */

export type PsychologicalResponse = {
  message: string;
  strategy: string;
  alternatives: string[];
  confidence: number;
};

export type CorrelationResult = {
  foodName: string;
  symptomName: string;
  occurrenceCount: number;
  confidence: number;
  explanation: string;
};

export type DiagnosticHypothesis = {
  hypothesis: string;
  evidenceLevel: "strong" | "moderate" | "weak";
  recommendedTests: {
    biomarkerCode: string;
    testName: string;
    rationale: string;
    priority: "urgent" | "routine" | "optional";
  }[];
  reasoning: string;
};

export type SymptomEntry = {
  foodName: string;
  symptomName: string;
  severity: number;
  onsetDelayMinutes: number | null;
  loggedAt: string;
};

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
  flag?: 'Normal' | 'Low' | 'High' | 'Abnormal' | string | null;
  ai_clinical_note?: string | null;
}

export interface LabReportExtraction {
  report_date?: string | null;
  context?: string | null;
  biomarkers: BiomarkerResult[];
  general_recommendations: string[];
}

export interface SomaticHistoryItem {
  timestamp: string;
  imageUrl: string;
  analysis: {
    markers: string[];
    interpretation: string;
    confidence: number;
  };
}

export type SomaticHistoryResponse = Record<string, SomaticHistoryItem[]>;

/* ── API Client ────────────────────────────────────────────────────── */

class AiApiClient {
  private get baseUrl() {
    return getApiBaseUrl();
  }

  /**
   * Generic fetch wrapper with error handling.
   */
  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`[AiClient] Calling ${url}`, body);

      const token = await getAuthToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // Try to parse error details
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message ||
          `API Error: ${response.status} ${response.statusText}`;
        console.error(`[AiClient] Error: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const json = await response.json();
      // The API returns { success: true, data: T }
      return json.data as T;
    } catch (error) {
      console.error(`[AiApiClient] Network/Parse Error:`, error);
      throw error;
    }
  }

  /**
   * Generic GET request handler
   */
  private async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`[AiClient] Calling GET ${url}`);

      const token = await getAuthToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message ||
          `API Error: ${response.status} ${response.statusText}`;
        console.error(`[AiClient] Error: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const json = await response.json();
      return json.data as T;
    } catch (error) {
      console.error(`[AiApiClient] GET Network/Parse Error:`, error);
      throw error;
    }
  }

  /**
   * Sends a message to the AI LangGraph agent (supports conversational memory).
   */
  async chat(
    message: string,
    threadId?: string,
    userProfile?: {
      biologicalSex?: string | null;
      dietType?: string | null;
      chronicConditions?: string[];
    },
    chatMode: "diary" | "assistant" = "diary",
    imageUrl?: string
  ): Promise<{ response: string }> {
    // Generate a default session thread if one isn't provided
    const sessionThread = threadId || `session-${Math.random().toString(36).substring(7)}`;
    return this.post<{ response: string }>("/chat", {
      message,
      threadId: sessionThread,
      userProfile,
      chatMode,
      imageUrl,
    });
  }

  /**
   * Fetches the global chat history for the user from the database.
   */
  async getChatHistory(mode: "diary" | "assistant" = "assistant", startIso?: string, endIso?: string): Promise<{ history: any[] }> {
    try {
      let url = `${this.baseUrl}/chat/history?mode=${mode}`;
      if (startIso && endIso) {
        url += `&startDate=${encodeURIComponent(startIso)}&endDate=${encodeURIComponent(endIso)}`;
      }

      const token = await getAuthToken();

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(url, { method: "GET", headers });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const json = await response.json();
      return json.data;
    } catch (error) {
      console.error("[AiApiClient] getChatHistory error:", error);
      return { history: [] }; // Safe fallback
    }
  }

  /**
   * Fetches deterministic personalized nutrition targets based on profile and active diagnoses.
   */
  async getNutritionTargets(): Promise<any> {
    return this.get<any>("/nutrition-targets", {});
  }

  /**
   * Analyzes symptom correlations based on history.
   */
  async analyze(symptoms: SymptomEntry[]): Promise<CorrelationResult[]> {
    return this.post<CorrelationResult[]>("/analyze", { symptoms });
  }

  /**
   * Generates diagnostic hypotheses.
   */
  async diagnose(
    symptoms: SymptomEntry[],
    biomarkers?: { code: string; name: string; value: number }[],
  ): Promise<DiagnosticHypothesis[]> {
    return this.post<DiagnosticHypothesis[]>("/diagnose", {
      symptoms,
      biomarkers,
    });
  }

  /**
   * Analyzes an image of a body part (nails, tongue, or skin) for visual markers.
   */
  async analyzeSomatic(imageBase64: string, type: "nails" | "tongue" | "skin"): Promise<any> {
    return this.post<any>("/analyze-somatic", { imageBase64, type });
  }

  /**
   * Fetches the persisted history of somatic analyses.
   */
  async getSomaticHistory(): Promise<SomaticHistoryResponse> {
    return this.get<SomaticHistoryResponse>("/somatic-history", {});
  }

  /**
   * Uploads a PDF file for biomarker AI extraction.
   */
  async uploadFile(file: File): Promise<LabReportExtraction> {
    const formData = new FormData();
    formData.append("file", file);

    const token = await getAuthToken();
    const headers: HeadersInit = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // On localhost, bypass Next.js proxy (which has ~30s timeout) and go directly to Node.js.
    // On production, use relative URL so nginx handles the proxying.
    const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";
    const integrationUrl = isLocal
      ? "http://localhost:3001/api/v1/integration/parse"
      : "/api/v1/integration/parse";

    const response = await fetch(integrationUrl, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `Upload Error: ${response.status}`;
      throw new Error(errorMessage);
    }

    const json = await response.json();
    // The backend does not wrap this in 'data' anymore; it returns the LabReportExtraction directly.
    // Ensure we handle both scenarios safely
    return (json.data || json) as LabReportExtraction;
  }

  /**
   * Uploads a lab report PHOTO for Vision-based AI extraction.
   * Uses DIRECT backend URL to bypass Next.js proxy timeout (~30s).
   */
  async uploadImageFile(imageBlob: Blob): Promise<LabReportExtraction> {
    const formData = new FormData();
    formData.append("file", imageBlob, "lab_report_photo.jpg");

    const token = await getAuthToken();
    const headers: HeadersInit = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // On localhost, bypass Next.js proxy (which has ~30s timeout) and go directly to Node.js.
    // On production, use relative URL so nginx handles the proxying.
    const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";
    const integrationUrl = isLocal
      ? "http://localhost:3001/api/v1/integration/parse-image"
      : "/api/v1/integration/parse-image";

    const response = await fetch(integrationUrl, {
      method: "POST",
      headers,
      body: formData,
      signal: AbortSignal.timeout(120_000), // 2-minute timeout for Vision OCR
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || errorData.message || `Upload Error: ${response.status}`;
      throw new Error(errorMessage);
    }

    const json = await response.json();
    return (json.data || json) as LabReportExtraction;
  }
  /**
   * Uploads a food photo for AI recognition and nutritional analysis.
   */
  async analyzeFood(imageBase64: string): Promise<FoodRecognitionResult> {
    return this.post<FoodRecognitionResult>("/analyze-food", { imageBase64 });
  }

  /**
   * Runs GPT-5.2 premium diagnostic analysis on parsed biomarkers.
   * Uses DIRECT backend URL to bypass Next.js proxy timeout (~30s).
   */
  async analyzeLabReport(biomarkers: BiomarkerResult[]): Promise<LabDiagnosticReport> {
    const directUrl = `${this.baseUrl}/analyze-lab-report`;
    const token = await getAuthToken();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(directUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ biomarkers }),
      signal: AbortSignal.timeout(180_000), // 3-minute timeout for GPT-5.2 analysis
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.status}`);
    }

    const json = await response.json();
    return (json.data || json) as LabDiagnosticReport;
  }

  async getLabReportsHistory(): Promise<StoredDiagnosticReport[]> {
    return this.get<StoredDiagnosticReport[]>("/lab-reports/history", {});
  }

  /**
   * Deletes a specific lab diagnostic report by its timestamp.
   */
  async deleteLabReport(timestamp: string): Promise<void> {
    const token = await getAuthToken();
    const url = `${this.baseUrl}/lab-reports/history/${encodeURIComponent(timestamp)}`;

    console.log(`[AiClient] Calling DELETE ${url}`);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        errorData.error ||
        `API Error: ${res.status} ${res.statusText}`;
      console.error(`[AiClient] Delete Error: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Fetches user profile data.
   */
  async getProfile(userId: string): Promise<any> {
    try {
      const url = this.baseUrl.replace("/ai", `/profiles/${userId}`);
      const token = await getAuthToken();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(url, { method: "GET", headers });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("[ApiClient] getProfile error:", error);
      throw error;
    }
  }

  /**
   * Updates user profile fields.
   */
  async updateProfile(userId: string, data: any): Promise<any> {
    try {
      // Route is /api/v1/profiles/{id}
      const url = this.baseUrl.replace("/ai", `/profiles/${userId}`);
      const token = await getAuthToken();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("[ApiClient] updateProfile error:", error);
      throw error;
    }
  }

  /**
   * Gets micronutrient trends over N days.
   */
  async getMicronutrientTrends(userId: string, days: number = 30): Promise<any[]> {
    try {
      // Route is /api/v1/analytics/{id}/micronutrient-trends
      const url = this.baseUrl.replace("/ai", `/analytics/${userId}/micronutrient-trends?days=${days}`);
      const token = await getAuthToken();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(url, { method: "GET", headers });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("[ApiClient] getMicronutrientTrends error:", error);
      return [];
    }
  }

  /**
   * Gets predictive lab testing schedule.
   */
  async getLabSchedule(userId: string): Promise<any[]> {
    try {
      // Route is /api/v1/analytics/{id}/lab-schedule
      const url = this.baseUrl.replace("/ai", `/analytics/${userId}/lab-schedule`);
      const token = await getAuthToken();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(url, { method: "GET", headers });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("[ApiClient] getLabSchedule error:", error);
      return [];
    }
  }

  /**
   * Submits user feedback (bug/suggestion)
   */
  async sendFeedback(category: string, message: string, attachmentUrl?: string): Promise<any> {
    try {
      // Route is /api/v1/users/me/feedback
      const url = this.baseUrl.replace("/ai", `/users/me/feedback`);
      const token = await getAuthToken();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const payload: any = { category, message };
      if (attachmentUrl) {
        payload.attachment_url = attachmentUrl;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("429"); // Special marker for UI toast
        }
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("[ApiClient] sendFeedback error:", error);
      throw error;
    }
  }
}

export type FoodRecognitionResult = {
  items: {
    name_ru: string;
    name_en: string;
    estimated_weight_g: number;
    confidence: number;
    per_100g: {
      calories_kcal: number;
      protein_g: number;
      fat_g: number;
      carbs_g: number;
      fiber_g: number;
    };
    estimated_total: {
      calories_kcal: number;
      protein_g: number;
      fat_g: number;
      carbs_g: number;
    };
  }[];
  meal_summary: {
    total_calories_kcal: number;
    total_protein_g: number;
    total_fat_g: number;
    total_carbs_g: number;
  };
  meal_quality_score: number;
  meal_quality_reason: string;
  health_reaction: string;
  reaction_type: "positive" | "neutral" | "warning" | "restriction_violation";
  imageUrl: string;
  llmError?: string;
};

export const apiClient = new AiApiClient();

/* ── Lab Diagnostic Report Type ────────────────────────────────────── */

export type LabDiagnosticReport = {
  summary: string;
  biomarker_assessments: {
    name: string;
    value: number;
    unit: string;
    reference_range: string;
    status: "critical_low" | "low" | "normal" | "high" | "critical_high";
    clinical_significance: string;
  }[];
  diagnostic_patterns: {
    pattern_name: string;
    involved_markers: string[];
    explanation: string;
    severity: "mild" | "moderate" | "significant";
    recommendations: string[];
  }[];
  priority_actions: {
    priority: "urgent" | "important" | "routine";
    action: string;
    reasoning: string;
  }[];
  recommended_additional_tests: {
    test_name: string;
    reason: string;
  }[];
  dietary_recommendations: {
    recommendation: string;
    target_markers: string[];
  }[];
  disclaimer: string;
};

export interface StoredDiagnosticReport {
  timestamp: string;
  biomarkers_count: number;
  data_hash?: string;
  report: LabDiagnosticReport;
}
