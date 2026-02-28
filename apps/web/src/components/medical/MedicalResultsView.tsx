"use client";

import { useState, useCallback, useEffect } from "react";
import UploadZone from "./UploadZone";
import PhotoUploader from "./PhotoUploader";
import SomaticAnalysisCard from "./SomaticAnalysisCard";
import DiagnosticReportCard from "./DiagnosticReportCard";
import { apiClient, type BiomarkerResult, type LabReportExtraction, type StoredDiagnosticReport, type SomaticHistoryResponse, type SomaticHistoryItem } from "@/lib/api-client";
import { compressImageToBlob } from "@/lib/image-utils";

/**
 * Medical Results view — orchestrates:
 * 1. PDF upload zone
 * 2. Loading skeleton
 * 3. Grid of Biomarker cards
 * 4. General Recommendations and GPT-5.2 diagnostic report
 */
export default function MedicalResultsView() {
  const [uploadState, setUploadState] = useState<
    "idle" | "hover" | "loading" | "done" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [results, setResults] = useState<LabReportExtraction | null>(null);

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
   * Triggers GPT-5.2 diagnostic analysis after biomarker parsing.
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
      }
    } catch (err) {
      console.error("[MedicalResults] Diagnostic analysis failed:", err);
      setDiagnosisError((err as Error).message || "Ошибка диагностического анализа");
    } finally {
      setIsDiagnosing(false);
    }
  }, []);

  const handleFileAccepted = useCallback(async (file: File, type: "document" | "image") => {
    setUploadState("loading");
    setErrorMessage(undefined);
    setResults(null);
    setDiagnosisError(undefined);

    try {
      let data: LabReportExtraction;

      if (type === "image") {
        const compressedBlob = await compressImageToBlob(file, 1536);
        data = await apiClient.uploadImageFile(compressedBlob);
      } else {
        data = await apiClient.uploadFile(file);
      }

      if (!data.biomarkers || data.biomarkers.length === 0) {
        setErrorMessage("Анализы не найдены. Пожалуйста, загрузите другой файл.");
        setUploadState("error");
        return;
      }

      setResults(data);
      setUploadState("done");

      // Auto-trigger GPT-5.2 diagnostic analysis (≥3 biomarkers)
      runDiagnosticAnalysis(data.biomarkers);

    } catch (error) {
      console.error("Upload failed", error);
      setErrorMessage((error as Error).message || "Failed to parse PDF");
      setUploadState("error");
    }
  }, [runDiagnosticAnalysis]);

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
      {/* ── Upload Zone ─────────────────────────────────── */}
      <UploadZone
        onFileAccepted={handleFileAccepted}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-border bg-white p-5"
            >
              <div className="h-3 w-24 rounded bg-surface-hover" />
              <div className="mt-3 h-7 w-16 rounded bg-surface-hover" />
              <div className="mt-2 h-2 w-32 rounded bg-surface-hover" />
            </div>
          ))}
        </div>
      )}

      {/* ── Results grid ──────────────────────────────────── */}
      {results && results.biomarkers.length > 0 && uploadState === "done" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">
              Результаты анализа {results.report_date ? `(От ${results.report_date})` : ""}
            </h2>
            <span className="text-sm text-ink-muted">
              {results.biomarkers.length} показателей
            </span>
          </div>
          {results.context && (
            <p className="text-sm text-ink-faint italic mb-2">Контекст: {results.context}</p>
          )}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.biomarkers.map((marker, index) => (
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
                    <span className="text-3xl font-bold tracking-tight text-slate-900">
                      {marker.value_numeric !== null ? marker.value_numeric : marker.value_string}
                    </span>
                    {marker.unit && <span className="text-sm font-medium text-slate-500">{marker.unit}</span>}
                  </div>

                  {/* Референс */}
                  {marker.reference_range?.text && (
                    <div className="mt-2 text-sm text-slate-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                      Норма: {marker.reference_range.text}
                    </div>
                  )}
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

          {/* ── Общие Рекомендации ───────────────────────────────────── */}
          {results.general_recommendations && results.general_recommendations.length > 0 && (
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
      {(!results || results.biomarkers.length === 0) && uploadState === "done" && (
        <p className="text-center text-ink-muted">Анализы не найдены.</p>
      )}

      {/* ── GPT-5.2 Diagnostic Report ─────────────────────── */}
      {isDiagnosing && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-8">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
          </div>
          <p className="text-sm font-medium text-purple-700">
            Готовим диагностический отчёт (GPT-5.2)…
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
