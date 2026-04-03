"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import UploadZone from "./UploadZone";
import PhotoUploader from "./PhotoUploader";
import SomaticAnalysisCard from "./SomaticAnalysisCard";
import DiagnosticReportCard from "./DiagnosticReportCard";
import { apiClient, type BiomarkerResult, type LabReportExtraction, type StoredDiagnosticReport, type SomaticHistoryResponse, type SomaticHistoryItem } from "@/lib/api-client";
import { compressImageToBlob } from "@/lib/image-utils";
import SymptomTrackerWidget from "./SymptomTrackerWidget";
import { useLabScanJob } from "@/hooks/useLabScanJob";

/**
 * Medical Results view — orchestrates:
 * 1. PDF upload zone
 * 2. Loading skeleton
 * 3. Grid of Biomarker cards
 * 4. General Recommendations and GPT-5.4 diagnostic report
 */
export default function MedicalResultsView() {
  const [uploadState, setUploadState] = useState<
    "idle" | "hover" | "loading" | "done" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [results, setResults] = useState<LabReportExtraction | null>(null);
  const [editableBiomarkers, setEditableBiomarkers] = useState<BiomarkerResult[] | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [dirtyIndexes, setDirtyIndexes] = useState<Set<number>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { startJob, status: jobStatus, result: jobResult, error: jobError, reset: resetJob } = useLabScanJob();

  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (uploadState === "done" && editableBiomarkers && editableBiomarkers.length > 0) {
      const timer = setTimeout(() => {
        controlsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [uploadState, editableBiomarkers]);

  // ── Somatic Analysis State ───────────────────────────────────
  const [somaticHistory, setSomaticHistory] = useState<SomaticHistoryResponse>({});

  const handleSomaticComplete = useCallback((type: string, result: any) => {
    const historyKey = `${type}_analysis_history`;
    const newItem: SomaticHistoryItem = {
      timestamp: new Date().toISOString(),
      imageUrl: result.imageUrl,
      analysis: {
        markers: result.markers,
        interpretation: result.interpretation,
        confidence: result.confidence,
      }
    };

    setSomaticHistory((prev) => {
      const existing = prev[historyKey] || [];
      return { ...prev, [historyKey]: [newItem, ...existing] };
    });
  }, []);

  // ── Diagnostic Report State ───────────────────────────────
  const [reportHistory, setReportHistory] = useState<StoredDiagnosticReport[]>([]);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [reportAlreadyGenerated, setReportAlreadyGenerated] = useState(false); // ← НОВОЕ
  const [diagnosisError, setDiagnosisError] = useState<string | undefined>();

  useEffect(() => {
    async function fetchHistory() {
      try {
        setIsLoadingHistory(true);
        const [history, somatic] = await Promise.all([
          apiClient.getLabReportsHistory(),
          apiClient.getSomaticHistory()
        ]);

        setReportHistory(history || []);
        if (history && history.length > 0) {
          setSelectedTimestamp(history[0].timestamp);
          setReportAlreadyGenerated(true); // ← НОВОЕ: отчёт уже существует в БД
          
          // Restore biomarker cards from the latest report (if saved)
          const latest = history[0];
          if (latest.biomarkers && latest.biomarkers.length > 0) {
            setEditableBiomarkers(latest.biomarkers);
            setResults({ biomarkers: latest.biomarkers, general_recommendations: [] });
            setUploadState("done");
          }
        } else {
          setSelectedTimestamp(null);
        }

        setSomaticHistory(somatic || {});
      } catch (error) {
        console.error("Failed to load report history", error);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    fetchHistory();
  }, []);

  /**
   * Triggers GPT-5.4 diagnostic analysis after biomarker parsing.
   * Fires automatically when ≥3 biomarkers are detected.
   */
  const runDiagnosticAnalysis = useCallback(async (biomarkers: BiomarkerResult[]) => {
    if (biomarkers.length < 3) return;

    setIsDiagnosing(true);
    setDiagnosisError(undefined);

    try {
      await apiClient.analyzeLabReport(biomarkers);

      // Re-fetch history to get the true state from DB (prevents fake duplicates)
      const history = await apiClient.getLabReportsHistory();
      setReportHistory(history || []);
      if (history && history.length > 0) {
        setSelectedTimestamp(history[0].timestamp);
        setReportAlreadyGenerated(true); // ← НОВОЕ: заблокировать кнопку навсегда
      }
    } catch (err) {
      console.error("[MedicalResults] Diagnostic analysis failed:", err);
      setDiagnosisError((err as Error).message || "Ошибка диагностического анализа");
    } finally {
      setIsDiagnosing(false);
    }
  }, []);

  const handleFilesAccepted = useCallback(async (files: File[], type: "document" | "image") => {
    setUploadState("loading");
    setErrorMessage(undefined);
    setResults(null);
    setDiagnosisError(undefined);
    setReportAlreadyGenerated(false); // ← НОВОЕ: новый файл — кнопка снова активна
    resetJob();

    try {
      let data: LabReportExtraction;

      if (type === "image") {
        const compressedBlobs = await Promise.all(
          files.map(f => compressImageToBlob(f, 2048))
        );

        if (compressedBlobs.length > 1) {
          // Use ASYNC pipeline for batch uploads (>1 file)
          await startJob(compressedBlobs);
          // Status will be tracked via jobStatus — no data returned here
          return; // Exit early — useEffect below will handle completion
        } else {
          data = await apiClient.uploadImageFile(compressedBlobs[0]);
        }
      } else {
        data = await apiClient.uploadFile(files[0]);
      }

      if (!data.biomarkers || data.biomarkers.length === 0) {
        setErrorMessage("Анализы не найдены. Пожалуйста, убедитесь, что тексты/фото читаемы.");
        setUploadState("error");
        return;
      }

      setResults(data);
      setEditableBiomarkers(data.biomarkers);
      setUploadState("done");

      // Auto-trigger disabled: users now review first
      // runDiagnosticAnalysis(data.biomarkers);

    } catch (error) {
      console.error("Upload failed", error);
      setErrorMessage((error as Error).message || "Failed to parse files");
      setUploadState("error");
    }
  }, [runDiagnosticAnalysis, startJob, resetJob]);

  // Handle async job completion via Realtime
  useEffect(() => {
    if (jobStatus === "COMPLETED" && jobResult) {
      setResults(jobResult);
      setEditableBiomarkers(jobResult.biomarkers || null);
      setUploadState("done");
    } else if (jobStatus === "FAILED" && jobError) {
      setErrorMessage(jobError);
      setUploadState("error");
    } else if (jobStatus === "UPLOADING" || jobStatus === "PENDING" || jobStatus === "PROCESSING") {
      setUploadState("loading");
    }
  }, [jobStatus, jobResult, jobError]);

  const handleMarkerChange = (index: number, field: keyof BiomarkerResult | 'ref_text', value: any) => {
    if (!editableBiomarkers) return;
    const next = [...editableBiomarkers];
    const item = { ...next[index] };

    if (field === 'ref_text') {
      item.reference_range = { ...item.reference_range, text: value };
    } else if (field === 'value_numeric') {
      item.value_numeric = value === '' ? null : parseFloat(value);
    } else {
      (item as any)[field] = value;
    }

    next[index] = item;
    setEditableBiomarkers(next);
    setIsDirty(true);
    setDirtyIndexes(prev => new Set(prev).add(index));
  };

  const handleRefreshNotes = async () => {
    if (!editableBiomarkers || dirtyIndexes.size === 0) return;
    
    setIsRefreshing(true);
    try {
      // Build array of only changed markers, remembering their original positions
      const dirtyEntries = Array.from(dirtyIndexes)
        .sort((a, b) => a - b)
        .map(idx => ({ originalIndex: idx, marker: editableBiomarkers[idx] }))
        .filter(entry => entry.marker != null);
      
      // Send only the dirty markers to the API
      const refreshed = await apiClient.refreshBiomarkerNotes(
        dirtyEntries.map(e => e.marker)
      );
      
      // Merge results back using original indexes
      const next = [...editableBiomarkers];
      refreshed.forEach((result, i) => {
        const origIdx = dirtyEntries[i]?.originalIndex;
        if (origIdx != null && next[origIdx]) {
          next[origIdx] = {
            ...next[origIdx],
            ai_clinical_note: result.ai_clinical_note,
            flag: result.flag
          };
        }
      });
      
      setEditableBiomarkers(next);
      setIsDirty(false);
      setDirtyIndexes(new Set());
    } catch (error) {
      console.error("Refresh notes failed", error);
      alert("Не удалось обновить показатели. Попробуйте еще раз.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!selectedTimestamp) return;
    const targetTimestamp = selectedTimestamp;

    const isConfirmed = window.confirm("Вы уверены, что хотите безвозвратно удалить этот диагностический отчёт?");
    if (!isConfirmed) return;

    try {
      await apiClient.deleteLabReport(targetTimestamp);

      // Update local state
      const newHistory = reportHistory.filter(r => r.timestamp !== targetTimestamp);
      setReportHistory(newHistory);

      // Reset selection
      if (newHistory.length === 0) {
        setSelectedTimestamp(null);
      } else {
        setSelectedTimestamp(newHistory[0].timestamp);
      }
    } catch (error) {
      console.error("Delete failed", error);
      alert("Не удалось удалить отчёт.");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Symptom Tracker ─────────────────────────────────── */}
      <SymptomTrackerWidget />

      {/* ── Upload Zone ─────────────────────────────────── */}
      <UploadZone
        onFilesAccepted={handleFilesAccepted}
        state={uploadState}
        errorMessage={errorMessage}
      />

      {/* ── Photo Uploaders (Somatic Diagnostics) ───────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PhotoUploader type="nails" onAnalysisComplete={(res) => handleSomaticComplete("nails", res)} />
        <PhotoUploader type="tongue" onAnalysisComplete={(res) => handleSomaticComplete("tongue", res)} />
        <PhotoUploader type="skin" onAnalysisComplete={(res) => handleSomaticComplete("skin", res)} />
      </div>

      {/* ── Somatic Analysis Results ─────────────────────────── */}
      {(somaticHistory["nails_analysis_history"]?.length > 0 || somaticHistory["tongue_analysis_history"]?.length > 0 || somaticHistory["skin_analysis_history"]?.length > 0) && (
        <div className="space-y-4">
          {somaticHistory["nails_analysis_history"]?.length > 0 && (
            <SomaticAnalysisCard title="Анализ ногтей" items={somaticHistory["nails_analysis_history"]} />
          )}
          {somaticHistory["tongue_analysis_history"]?.length > 0 && (
            <SomaticAnalysisCard title="Анализ языка" items={somaticHistory["tongue_analysis_history"]} />
          )}
          {somaticHistory["skin_analysis_history"]?.length > 0 && (
            <SomaticAnalysisCard title="Анализ кожи" items={somaticHistory["skin_analysis_history"]} />
          )}
        </div>
      )}

      {/* ── Loading Skeleton ─────────────────────────────── */}
      {uploadState === "loading" && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-8 shadow-sm">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-cyan-200 border-t-cyan-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-cyan-800">
              {jobStatus === "UPLOADING" && "Загружаем файлы..."}
              {jobStatus === "PENDING" && "Запрос принят, ожидаем обработку..."}
              {jobStatus === "PROCESSING" && "AI анализирует ваши анализы..."}
              {!["UPLOADING", "PENDING", "PROCESSING"].includes(jobStatus) && "Обработка..."}
            </p>
            <p className="mt-1 text-xs text-cyan-600">
              {jobStatus === "PROCESSING"
                ? "GPT-4o Vision распознаёт показатели на фото"
                : "Это может занять до 2 минут"}
            </p>
          </div>
          {/* Progress steps */}
          <div className="flex items-center gap-2 mt-2">
            {["UPLOADING", "PENDING", "PROCESSING"].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                  ["UPLOADING", "PENDING", "PROCESSING"].indexOf(jobStatus) >= i
                    ? "bg-cyan-500 scale-110"
                    : "bg-slate-200"
                }`} />
                {i < 2 && <div className={`h-0.5 w-6 transition-all duration-500 ${
                  ["UPLOADING", "PENDING", "PROCESSING"].indexOf(jobStatus) > i
                    ? "bg-cyan-400"
                    : "bg-slate-200"
                }`} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Results grid ──────────────────────────────────── */}
      {editableBiomarkers && editableBiomarkers.length > 0 && uploadState === "done" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">
              Результаты анализа {results?.report_date ? `(От ${results.report_date})` : ""}
            </h2>
            <span className="text-sm text-ink-muted">
              {editableBiomarkers.length} показателей
            </span>
          </div>
          {results?.context && (
            <p className="text-sm text-ink-faint italic mb-2">Контекст: {results.context}</p>
          )}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {editableBiomarkers.map((marker, index) => (
              <div
                key={`${marker.standardized_slug}_${index}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-md flex flex-col justify-between"
              >
                {/* Accent line top */}
                <div className={`absolute left-0 top-0 h-1 w-full ${marker.flag === 'Normal' ? 'bg-emerald-400' : marker.flag ? 'bg-rose-400' : 'bg-slate-200'} opacity-70 transition-opacity group-hover:opacity-100`} />

                <div>
                  {/* Название */}
                  <div className="flex justify-between items-start gap-3 mt-1">
                    <h3 className="font-semibold text-slate-800 leading-tight" title={marker.original_name}>{marker.original_name}</h3>
                    {/* Бейдж статуса (Flag) */}
                    {marker.flag && (
                      <span className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-wide ${marker.flag === 'Normal'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                        {marker.flag === 'Normal' ? (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                        ) : (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                        )}
                        {marker.flag}
                      </span>
                    )}
                  </div>

                  {/* Значение (число или строка) */}
                  <div className="mt-4 flex items-baseline gap-1.5">
                    {(() => {
                      const isValueMissing = marker.value_numeric === null && marker.value_string === null;
                      return (
                        <input
                          type={marker.value_numeric !== null ? "number" : "text"}
                          value={marker.value_numeric !== null ? (marker.value_numeric ?? "") : (marker.value_string ?? "")}
                          onChange={(e) => handleMarkerChange(index, marker.value_numeric !== null ? 'value_numeric' : 'value_string', e.target.value)}
                          step="any"
                          className={`w-full max-w-[120px] rounded-lg px-2 py-1 text-2xl font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all ${
                            isValueMissing 
                              ? "bg-rose-50 border-2 border-rose-400 text-rose-900 animate-pulse shadow-[0_0_10px_rgba(251,113,133,0.3)]" 
                              : "bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                          }`}
                        />
                      );
                    })()}
                    {marker.unit && <span className="text-sm font-medium text-slate-500">{marker.unit}</span>}
                  </div>

                  {/* Референс */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Норма:</span>
                    {(() => {
                      const isNormMissing = !marker.reference_range?.text || marker.reference_range?.text === "нет данных";
                      return (
                        <input
                          type="text"
                          value={marker.reference_range?.text ?? ""}
                          onChange={(e) => handleMarkerChange(index, 'ref_text', e.target.value)}
                          placeholder="нет данных"
                          className={`flex-1 border-b px-1 py-0.5 text-sm transition-all focus:outline-none ${
                            isNormMissing
                              ? "bg-rose-50/50 border-rose-300 text-rose-700 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] placeholder:text-rose-300"
                              : "bg-transparent border-slate-100 hover:border-slate-200 focus:border-cyan-400 text-slate-600"
                          }`}
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* Пояснение от ИИ */}
                {marker.ai_clinical_note && (
                  <div className="mt-5 rounded-xl bg-cyan-50/80 p-3.5 border border-cyan-100/50">
                    <p className="text-sm leading-relaxed text-cyan-900">
                      <span className="font-semibold text-cyan-700 mr-1.5">AI:</span>
                      {marker.ai_clinical_note}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Control Buttons ────────────────────────────────── */}
          <div ref={controlsRef} className="mt-8 flex flex-wrap items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <button
              onClick={handleRefreshNotes}
              disabled={!isDirty || isRefreshing}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                isDirty && !isRefreshing
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-200 hover:bg-cyan-600 hover:-translate-y-0.5 active:translate-y-0" 
                  : "bg-slate-100 text-slate-400 cursor-default"
              }`}
            >
              {isRefreshing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-white" />
                  Обновляем...
                </>
              ) : "Обновить показатели"}
            </button>
            <button
              onClick={() => editableBiomarkers && runDiagnosticAnalysis(editableBiomarkers)}
              disabled={isDirty || isDiagnosing || isRefreshing || reportAlreadyGenerated}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                !isDirty && !isDiagnosing && !isRefreshing && !reportAlreadyGenerated
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.6)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] hover:bg-purple-700 hover:-translate-y-0.5 active:translate-y-0"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-70"
              }`}
            >
              {isDiagnosing ? "Анализируем..." : "Сформировать отчёт"}
            </button>
            {isDirty ? (
              <div className="ml-auto w-full lg:w-auto flex-1 max-w-md flex items-start gap-3 rounded-xl bg-amber-50/80 p-3.5 border border-amber-200 shadow-sm transition-all duration-300">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="text-xs font-medium leading-relaxed text-amber-700 pt-1">
                  <span className="font-bold text-amber-900 block mb-0.5">Несохраненные изменения</span>
                  Нажмите «Обновить показатели», чтобы применить ваши правки.
                </div>
              </div>
            ) : (
              <div className="ml-auto w-full lg:w-auto flex items-center justify-center rounded-xl bg-amber-50/50 px-5 py-3 border border-amber-200/30 transition-all duration-300 hover:bg-amber-50 hover:border-amber-200/60">
                <div className="text-sm font-semibold text-amber-700">
                  ⚠️ Внимание! Сверьте данные с оригиналом.
                </div>
              </div>
            )}
          </div>

          {/* ── Общие Рекомендации ───────────────────────────────────── */}
          {results?.general_recommendations && results.general_recommendations.length > 0 && (
            <div className="mt-10 overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white shadow-sm">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Медицинский анализ AI</h3>
                </div>

                <ul className="space-y-3">
                  {results.general_recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-3 text-slate-700 leading-relaxed">
                      <span className="mt-1.5 flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400"></span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Empty State ───────────────────────────────────── */}
      {(!results || (results.biomarkers?.length ?? 0) === 0) && uploadState === "done" && (
        <p className="text-center text-ink-muted">Анализы не найдены.</p>
      )}

      {/* ── GPT-5.4 Diagnostic Report ─────────────────────── */}
      {isDiagnosing && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-8">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
          </div>
          <p className="text-sm font-medium text-purple-700">
            Готовим диагностический отчёт (GPT-5.4)…
          </p>
          <p className="text-xs text-purple-500">
            Глубокий анализ займёт до 2 минут
          </p>
        </div>
      )}

      {diagnosisError && !isDiagnosing && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-700">{diagnosisError}</p>
        </div>
      )}

      {/* ── Diagnostic Report History ─────────────────────── */}
      {!isDiagnosing && reportHistory.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-700 to-blue-600 bg-clip-text text-transparent">
                История диагностик
              </h2>

              {/* Date Selector (if multiple dates exist) */}
              <div className="flex items-center gap-3">
                {Array.from(new Set(reportHistory.map(r => new Date(r.timestamp).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long', year: 'numeric' }))))
                  .slice(0, 3) // Show up to 3 recent dates as pills for quick jump
                  .map(dateStr => {
                    const firstReportOfDate = reportHistory.find(r => new Date(r.timestamp).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long', year: 'numeric' }) === dateStr);
                    const isSelectedDate = selectedTimestamp && new Date(selectedTimestamp).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long', year: 'numeric' }) === dateStr;
                    return (
                      <button
                        key={dateStr}
                        onClick={() => firstReportOfDate && setSelectedTimestamp(firstReportOfDate.timestamp)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${isSelectedDate ? 'bg-cyan-100 text-cyan-800 shadow-sm border border-cyan-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                      >
                        {dateStr}
                      </button>
                    );
                  })
                }
              </div>
            </div>

            {/* Session Switcher (if multiple on same date) */}
            {(() => {
              const currentReport = reportHistory.find(r => r.timestamp === selectedTimestamp) || reportHistory[0];
              const currentDateStr = new Date(currentReport.timestamp).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long', year: 'numeric' });
              const sessionsOnDate = reportHistory.filter(r => new Date(r.timestamp).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long', year: 'numeric' }) === currentDateStr);

              return (
                <div className="flex items-center justify-between rounded-2xl bg-white/60 p-2 backdrop-blur-md border border-white/40 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.05)]">
                  <div className="flex gap-2 p-1 overflow-x-auto">
                    {sessionsOnDate.length > 1 ? sessionsOnDate.map((session, idx) => {
                      const timeStr = new Date(session.timestamp).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });
                      const isActive = selectedTimestamp === session.timestamp;
                      return (
                        <button
                          key={session.timestamp}
                          onClick={() => setSelectedTimestamp(session.timestamp)}
                          className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${isActive
                            ? "bg-white text-cyan-700 shadow-[inset_0_-2px_0_rgba(6,182,212,1),0_2px_8px_-2px_rgba(6,182,212,0.2)]"
                            : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                            }`}
                        >
                          <span className="text-lg">{idx === 0 ? "🕒" : "⏱️"}</span>
                          Сессия {timeStr}
                        </button>
                      );
                    }) : (
                      <div className="px-4 py-2 text-sm font-medium text-slate-600 flex items-center gap-2">
                        <span className="text-lg">🗓️</span>
                        {currentDateStr} • {new Date(currentReport.timestamp).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleDeleteReport}
                    disabled={isDiagnosing}
                    className="flex items-center gap-2 px-3 py-2 mr-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Удалить выбранный отчёт"
                  >
                    🗑️ Удалить
                  </button>
                </div>
              );
            })()}
          </div>

          <DiagnosticReportCard
            report={(reportHistory.find(r => r.timestamp === selectedTimestamp) || reportHistory[0]).report}
          />
        </div>
      )}

      {/* Loading history state fallback */}
      {isLoadingHistory && reportHistory.length === 0 && (
        <div className="mt-8 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
        </div>
      )}
    </div>
  );
}
