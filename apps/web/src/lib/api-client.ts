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

export type SymptomCorrelationResult = {
  symptom: string;
  triggers: string[];
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

export interface LabelScannerOutput {
  product_name: string;
  verdict: "GREEN" | "YELLOW" | "RED";
  verdict_reason: string;
  e_codes: {
    code: string;
    name: string;
    danger_level: "LOW" | "MEDIUM" | "HIGH";
    description: string;
  }[];
  macronutrients_per_100g: {
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
  } | null;
}

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
    imageUrl?: string,
    nutritionalContext?: any,
    imageBase64?: string,
    onToken?: (token: string) => void,
  ): Promise<{ response: string }> {
    // Generate a default session thread if one isn't provided
    const sessionThread = threadId || `session-${Math.random().toString(36).substring(7)}`;

    // Route through our custom Next.js API route that has a higher maxDuration (180s)
    const directUrl = "/api/chat";
    const token = await getAuthToken();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const body = {
      message,
      threadId: sessionThread,
      userProfile,
      chatMode,
      imageUrl,
      nutritionalContext,
      imageBase64,
    };

    const response = await fetch(directUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(900_000), // 15-minute timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.status}`);
    }

    // Streaming path: when onToken callback is provided
    if (onToken && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        onToken(chunk);
      }

      return { response: fullResponse };
    }

    // Fallback: non-streaming path (for Diary mode)
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponse += decoder.decode(value, { stream: true });
      }

      // Backward compatibility: If the response is a legacy structure {"response": "..."}
      try {
        const json = JSON.parse(fullResponse);
        if (json.data && json.data.response !== undefined) return { response: json.data.response };
        if (json.response !== undefined) return { response: json.response };
      } catch (e) {
        // Plain text stream detected (Expected behavior), ignore catch
      }

      return { response: fullResponse };
    }

    const text = await response.text();
    return { response: text };
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
   * Clears the chat history for the user.
   * Routes through the Next.js /api/chat proxy which handles DELETE.
   */
  async deleteChatHistory(mode: "diary" | "assistant" = "assistant"): Promise<void> {
    try {
      const url = `/api/chat?mode=${mode}`; // Using the Next.js proxy route
      const token = await getAuthToken();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
    } catch (error) {
      console.error("[AiApiClient] deleteChatHistory error:", error);
      throw error;
    }
  }

  /**
   * Fetches the user's active supplement protocol and today's logs.
   */
  async getTodaySupplements(startIso?: string, endIso?: string): Promise<{ activeProtocol: any, medications: string[], todayLogs: any[] }> {
    const queryParams = new URLSearchParams();
    if (startIso) queryParams.append("startDate", startIso);
    if (endIso) queryParams.append("endDate", endIso);
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    
    const token = await getAuthToken();
    const url = `${this.baseUrl.replace('/ai', '/supplements')}/today${queryString}`;
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${res.status}`);
    }
    const json = await res.json();
    return json;
  }

  /**
   * Logs a supplement intake.
   */
  async logSupplement(data: { supplement_name: string, dosage: string, taken_at_iso?: string }): Promise<any> {
    const token = await getAuthToken();
    const url = `${this.baseUrl.replace('/ai', '/supplements')}/log`;
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${res.status}`);
    }
    const json = await res.json();
    return json;
  }

  /**
   * Deletes a specific supplement log by ID.
   */
  async deleteSupplementLog(id: string): Promise<void> {
    const token = await getAuthToken();
    const url = `${this.baseUrl.replace('/ai', '/supplements')}/log/${encodeURIComponent(id)}`;
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${res.status}`);
    }
  }

  /**
   * Fetches deterministic personalized nutrition targets based on profile and active diagnoses.
   */
  async getNutritionTargets(): Promise<any> {
    return this.get<any>("/nutrition-targets", {});
  }

  /**
   * Fetches aggregated macronutrients and micronutrients for the diary counter.
   */
  async getDiaryDailyMacros(startIso: string, endIso: string): Promise<any> {
    const endpoint = `/diary-macros?startDate=${encodeURIComponent(startIso)}&endDate=${encodeURIComponent(endIso)}`;
    return this.get<any>(endpoint, {});
  }

  /**
   * Deletes a specific meal log by ID (Phase 56)
   */
  async deleteMealLog(id: string): Promise<void> {
    const token = await getAuthToken();
    const url = `${this.baseUrl}/meal-log/${encodeURIComponent(id)}`;
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${res.status}`);
    }
  }

  /**
   * Updates a specific meal log weight (Phase 56)
   */
  async updateMealLog(id: string, newWeightG: number): Promise<any> {
    const token = await getAuthToken();
    const url = `${this.baseUrl}/meal-log/${encodeURIComponent(id)}`;
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ new_weight_g: newWeightG }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${res.status}`);
    }

    const json = await res.json();
    return json.data;
  }

  /**
   * Analyzes symptom correlations based on history.
   */
  async analyze(symptoms: SymptomEntry[]): Promise<CorrelationResult[]> {
    return this.post<CorrelationResult[]>("/analyze", { symptoms });
  }

  /**
   * Generates correlations between symptoms, meals and weather.
   */
  async correlateSymptoms(): Promise<SymptomCorrelationResult[]> {
    return this.post<SymptomCorrelationResult[]>("/analytics/correlate-symptoms", {});
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

    // Route through Node.js integration endpoint
    const integrationUrl = "/api/v1/integration/parse";

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

    // Route through our custom Next.js API route that has a higher maxDuration (120s)
    const integrationUrl = "/api/parse-image";

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
   * Uploads a BATCH of lab report PHOTOS for Vision-based AI extraction.
   * Uses custom proxy route with 5-minute timeout.
   */
  async uploadImageFiles(imageBlobs: Blob[]): Promise<LabReportExtraction> {
    const formData = new FormData();
    imageBlobs.forEach((blob, index) => {
      formData.append("files", blob, `lab_report_photo_${index}.jpg`);
    });

    const token = await getAuthToken();
    const headers: HeadersInit = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Route through our custom Next.js API route that has a higher maxDuration (300s)
    const integrationUrl = "/api/parse-image-batch";

    const response = await fetch(integrationUrl, {
      method: "POST",
      headers,
      body: formData,
      signal: AbortSignal.timeout(300_000), // 5-minute timeout for batch Vision OCR
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.detail || errorData.message || `Batch Upload Error: ${response.status}`;
      throw new Error(errorMessage);
    }

    const json = await response.json();
    return (json.data || json) as LabReportExtraction;
  }

  /**
   * Initiates async batch OCR via Supabase Realtime pipeline.
   * Returns job_id for tracking via useLabScanJob hook.
   */
  async uploadImageFilesAsync(imageBlobs: Blob[]): Promise<{ job_id: string; status: string }> {
    const formData = new FormData();
    imageBlobs.forEach((blob, index) => {
      formData.append("files", blob, `lab_report_photo_${index}.jpg`);
    });

    const token = await getAuthToken();
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch("/api/v1/integration/parse-image-batch-async", {
      method: "POST",
      headers,
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Async Upload Error: ${response.status}`);
    }

    const json = await response.json();
    return json.data;
  }

  /**
   * Uploads a food photo for AI recognition and nutritional analysis.
   */
  async analyzeFood(imageBase64: string): Promise<FoodRecognitionResult> {
    return this.post<FoodRecognitionResult>("/analyze-food", { imageBase64 });
  }

  /**
   * Uploads a food label photo for ingredient & E-additives analysis.
   */
  async analyzeLabel(imageBase64: string): Promise<LabelScannerOutput> {
    return this.post<LabelScannerOutput>("/vision/label", { imageBase64 });
  }

  /**
   * Runs GPT-5.4 premium diagnostic analysis on parsed biomarkers.
   * Uses DIRECT backend URL to bypass Next.js proxy timeout (~30s).
   */
  async analyzeLabReport(biomarkers: BiomarkerResult[]): Promise<LabDiagnosticReport> {
    // Route through our custom Next.js API route that has a higher maxDuration (300s)
    const directUrl = "/api/analyze-lab-report";
    const token = await getAuthToken();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(directUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ biomarkers }),
      signal: AbortSignal.timeout(600_000), // 10-minute timeout (backend timeout is 8 min)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error: any = new Error(errorData.message || `API Error: ${response.status}`);
      error.data = errorData;
      throw error;
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

  /**
   * Recalculates biomarker notes and flags for a set of biomarkers.
   */
  async refreshBiomarkerNotes(biomarkers: BiomarkerResult[]): Promise<{ index: number; ai_clinical_note: string; flag: string }[]> {
    // Route through Next.js proxy to avoid 404s and handle timeouts
    const proxyUrl = "/api/refresh-notes";
    const token = await getAuthToken();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(proxyUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ biomarkers }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to refresh biomarker notes");
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Deletes the current user's account and all associated data.
   */
  async deleteAccount(): Promise<void> {
    const url = `${this.baseUrl}/users/me`;
    const token = await getAuthToken();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error || errorData.message || `API Error: ${response.status}`;
      throw new Error(message);
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
  biomarkers?: BiomarkerResult[];
}
