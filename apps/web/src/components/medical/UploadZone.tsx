"use client";

import { useCallback, useState, useRef } from "react";
import { useTranslations } from "next-intl";

type UploadState = "idle" | "hover" | "loading" | "done" | "error";

type UploadZoneProps = {
  /** Called with the selected Files and their type after validation. */
  onFilesAccepted: (files: File[], type: "document" | "image") => void;
  /** Current upload state — parent controls the lifecycle. */
  state?: UploadState;
  /** Error message to display in the error state. */
  errorMessage?: string;
  /** Callback to navigate to reports screen */
  onViewReports?: () => void;
};

const DOCUMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/heic"];

/**
 * Drag-and-drop PDF upload zone with 4 visual states:
 * idle → hover (drag over) → loading → done.
 *
 * Includes file-type validation (PDF only) and
 * accessible keyboard interaction.
 */
export default function UploadZone({
  onFilesAccepted,
  state = "idle",
  errorMessage,
  onViewReports,
}: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("medical");

  const effectiveState = dragOver ? "hover" : state;

  const handleFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const firstFile = files[0];

      // Document flow (existing)
      const isDocument = DOCUMENT_TYPES.includes(firstFile.type)
        || firstFile.name.endsWith(".txt")
        || firstFile.name.endsWith(".docx");
      if (isDocument) {
        if (files.length > 1) {
          alert(t("onlyOneDocument"));
          return;
        }
        if (firstFile.size > 10 * 1024 * 1024) {
          alert(t("documentTooLarge"));
          return;
        }
        onFilesAccepted([firstFile], "document");
        return;
      }

      // Image flow (new)
      const imageFiles = files.filter(f => IMAGE_TYPES.includes(f.type) || f.type.startsWith("image/"));
      if (imageFiles.length > 0) {
        if (imageFiles.length > 10) {
          alert(t("maxTenPhotos"));
          return;
        }
        const totalSize = imageFiles.reduce((acc, file) => acc + file.size, 0);
        if (totalSize > 50 * 1024 * 1024) {
          alert(t("photosTooLarge"));
          return;
        }
        onFilesAccepted(imageFiles, "image");
        return;
      }

      // Unsupported format — silently reject
    },
    [onFilesAccepted],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles],
  );

  /* ── Styles per state ──────────────────────────────────── */
  const stateStyles: Record<UploadState, string> = {
    idle: "border-border bg-surface hover:border-primary-400 hover:bg-primary-500/5",
    hover: "border-primary-500 bg-primary-500/10 scale-[1.01]",
    loading: "border-primary-400 bg-primary-500/10 pointer-events-none",
    done: "border-success bg-success/10",
    error: "border-error bg-error/10",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("uploadAriaLabel")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed
        p-6 sm:p-8 text-center transition-all duration-200
        ${stateStyles[effectiveState]}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.docx,image/jpeg,image/png,image/heic,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={cameraInputRef}
        type="file"
        multiple
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* ── Idle / Hover ──────────────────────────────────── */}
      {(effectiveState === "idle" || effectiveState === "hover") && (
        <div className="flex flex-col items-center gap-3">
          <div
            className={`
              rounded-xl p-4 transition-colors duration-200
              ${effectiveState === "hover" ? "bg-primary-100" : "bg-surface-muted"}
            `}
          >
            <svg
              className="h-8 w-8 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">
              {t("dragDropTitle")}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {t("dragDropSubtitle")}
            </p>
          </div>
          <span className="inline-block rounded-full bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-700">
            {t("acceptedFormats")}
          </span>

          <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
            <span className="h-px flex-1 bg-border" />
            <span>{t("or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cameraInputRef.current?.click();
            }}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md active:scale-[0.97]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            {t("takePhoto")}
          </button>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────── */}
      {effectiveState === "loading" && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
          <p className="text-sm font-medium text-ink-muted">
            {t("analyzingDocument")}
          </p>
        </div>
      )}

      {/* ── Done ──────────────────────────────────────────── */}
      {effectiveState === "done" && (
        <div className="flex flex-col items-center gap-3 relative z-10">
          <div className="flex flex-col items-center gap-1.5 mb-1 text-center">
            <div className="flex items-center gap-2 bg-surface/60 px-4 py-2 rounded-full border border-success/30 shadow-sm">
              <svg
                className="h-4 w-4 text-success"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-bold text-success">{t("reportGenerated")}</span>
            </div>
            {onViewReports && (
              <p className="text-[11px] text-ink-muted leading-snug">
                {t("reportGeneratedHint")}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewReports();
                  }}
                  className="text-cyan-500 underline font-semibold hover:text-cyan-400 transition-colors inline-block ml-0.5"
                >
                  {t("reportGeneratedLink")}
                </button>
              </p>
            )}
          </div>
          
          <div className="text-center mb-1">
            <p className="text-[0.9375rem] font-bold text-ink">
              {t("uploadNewResults")}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted max-w-[200px] mx-auto leading-tight">
              {t("uploadNewResultsSub")}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-surface border border-border px-5 py-2 text-sm font-bold text-ink shadow-sm transition-all hover:border-cyan-300 hover:text-cyan-700 hover:shadow-md group">
            <svg className="h-4 w-4 text-ink-faint group-hover:text-cyan-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t("addNewAnalysis")}
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────── */}
      {effectiveState === "error" && (
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl bg-red-100 p-3">
            <svg
              className="h-8 w-8 text-error"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-error">
            {errorMessage || t("processingError")}
          </p>
        </div>
      )}
    </div>
  );
}
