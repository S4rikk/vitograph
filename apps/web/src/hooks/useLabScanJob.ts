"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LabReportExtraction } from "@/lib/api-client";

type JobStatus = "IDLE" | "UPLOADING" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

interface UseLabScanJobReturn {
  startJob: (imageBlobs: Blob[]) => Promise<void>;
  status: JobStatus;
  result: LabReportExtraction | null;
  error: string | null;
  reset: () => void;
}

// Helper: get auth token
async function getAuthToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export function useLabScanJob(): UseLabScanJobReturn {
  const [status, setStatus] = useState<JobStatus>("IDLE");
  const [result, setResult] = useState<LabReportExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
      }
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    setStatus("IDLE");
    setResult(null);
    setError(null);
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    jobIdRef.current = null;
  }, []);

  const startJob = useCallback(async (imageBlobs: Blob[]) => {
    reset();
    setStatus("UPLOADING");

    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      // Step 1: Build FormData
      const formData = new FormData();
      imageBlobs.forEach((blob, i) => {
        formData.append("files", blob, `lab_report_photo_${i}.jpg`);
      });

      // Step 2: POST to create job
      const response = await fetch("/api/v1/integration/parse-image-batch-async", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: AbortSignal.timeout(30_000), // 30s for job creation only
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Upload failed: ${response.status}`);
      }

      const { data } = await response.json();
      const jobId = data.job_id;
      jobIdRef.current = jobId;
      setStatus("PENDING");

      // Step 3: Subscribe to Realtime BEFORE the background task might finish
      const supabase = createClient();
      const channel = supabase
        .channel(`lab-scan-${jobId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "lab_scans",
            filter: `id=eq.${jobId}`,
          },
          (payload: any) => {
            const newRow = payload.new;
            if (newRow.status === "PROCESSING") {
              setStatus("PROCESSING");
            } else if (newRow.status === "COMPLETED" && newRow.result) {
              setStatus("COMPLETED");
              setResult(newRow.result as LabReportExtraction);
              // Cleanup channel
              supabase.removeChannel(channel);
              if (pollingRef.current) clearTimeout(pollingRef.current);
            } else if (newRow.status === "FAILED") {
              setStatus("FAILED");
              setError(newRow.error || "OCR processing failed");
              supabase.removeChannel(channel);
              if (pollingRef.current) clearTimeout(pollingRef.current);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      // Step 4: Fallback polling after 60 seconds
      pollingRef.current = setTimeout(async () => {
        // Only poll if job exists and channel hasn't resolved it yet
        if (jobIdRef.current) {
          try {
            const pollResp = await fetch(`/api/v1/integration/lab-scans/${jobId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (pollResp.ok) {
              const pollData = await pollResp.json();
              const scanData = pollData.data || pollData;
              if (scanData.status === "COMPLETED" && scanData.result) {
                setStatus("COMPLETED");
                setResult(scanData.result);
                if (channelRef.current) supabase.removeChannel(channelRef.current);
              } else if (scanData.status === "FAILED") {
                setStatus("FAILED");
                setError(scanData.error || "Job failed");
                if (channelRef.current) supabase.removeChannel(channelRef.current);
              }
              // Else: still processing — Realtime will handle it
            }
          } catch {
            // Polling is best-effort — Realtime is primary
          }
        }
      }, 60_000);

    } catch (err: any) {
      setStatus("FAILED");
      setError(err.message || "Failed to start job");
    }
  }, [reset]);

  return { startJob, status, result, error, reset };
}
