import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface Props {
  variant?: "default" | "compact";
  providedMeds?: string[];
  startIso?: string;
  endIso?: string;
}

export default function SupplementChecklistWidget({
  variant = "default",
  providedMeds,
  startIso,
  endIso,
}: Props) {
  const [meds, setMeds] = useState<string[]>(providedMeds || []);
  const [todaySuppLogs, setTodaySuppLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadChecklist = async () => {
      setIsLoading(true);
      try {
        const suppData = await apiClient.getTodaySupplements(startIso, endIso);
        if (mounted) {
          if (!providedMeds) {
            setMeds(suppData.medications || []);
          } else {
             setMeds(providedMeds);
          }
          setTodaySuppLogs(suppData.todayLogs || []);
        }
      } catch (err) {
        console.error("Failed to load today supplements", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadChecklist();

    const handleSync = () => loadChecklist();
    window.addEventListener("supplements-updated", handleSync);
    window.addEventListener("profile-updated", handleSync);

    return () => {
      mounted = false;
      window.removeEventListener("supplements-updated", handleSync);
      window.removeEventListener("profile-updated", handleSync);
    };
  }, [providedMeds, startIso, endIso]);

  // If no medications are set, we don't render anything in compact mode and very little in default
  if (!isLoading && meds.length === 0) {
    return null; // hide entirely if no supplements are configured
  }

  const handleToggle = async (med: string, isChecked: boolean, matchedLog: any) => {
    try {
      if (!isChecked) {
        // Optimistic add
        const tempId = `temp-${Date.now()}`;
        setTodaySuppLogs(prev => [...prev, { id: tempId, supplement_name: med }]);
        
        const logged = await apiClient.logSupplement({
          supplement_name: med,
          dosage: "1 порция",
          taken_at_iso: startIso || new Date().toISOString(),
        });
        setTodaySuppLogs(prev => prev.map(l => l.id === tempId ? logged : l));
        window.dispatchEvent(new Event("supplements-updated"));
      } else {
        // Optimistic delete
        if (matchedLog?.id) {
          setTodaySuppLogs(prev => prev.filter(l => l.id !== matchedLog.id));
          if (!String(matchedLog.id).startsWith("temp-")) {
            await apiClient.deleteSupplementLog(matchedLog.id);
            window.dispatchEvent(new Event("supplements-updated"));
          }
        }
      }
    } catch (error) {
      console.error("Error toggling supplement:", error);
      // Rollback on error by reloading
      setIsLoading(true);
      const suppData = await apiClient.getTodaySupplements(startIso, endIso).catch(() => null);
      if (suppData) setTodaySuppLogs(suppData.todayLogs || []);
      setIsLoading(false);
    }
  };

  if (variant === "compact") {
    if (isLoading && meds.length === 0) {
      return (
        <div className="flex flex-wrap justify-end gap-1.5 h-full content-start items-start pt-1 max-w-[220px]">
          <div className="w-[80px] h-6 bg-surface-muted rounded-full animate-pulse"></div>
          <div className="w-[60px] h-6 bg-surface-muted rounded-full animate-pulse"></div>
        </div>
      );
    }

    return (
      <>
        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        `}} />
        <div 
          className="flex flex-wrap justify-end gap-1.5 content-start items-start pt-1 max-w-[220px] max-h-[64px] overflow-y-auto custom-scrollbar overflow-x-hidden pr-0.5"
        >
          {meds.map((med, i) => {
            const matchedLog = todaySuppLogs.find((log) => log.supplement_name === med);
            const isChecked = !!matchedLog;

            return (
              <label
                key={`supp-${i}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold tracking-tight transition-all cursor-pointer border select-none w-max ${
                  isChecked 
                    ? "bg-primary-50 text-primary-800 border-primary-200 shadow-sm ring-1 ring-primary-100" 
                    : "bg-surface-subtle text-ink-muted border-divider hover:bg-surface-base hover:border-border"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isChecked}
                  onChange={() => handleToggle(med, isChecked, matchedLog)}
                />
                <div className={`w-3 h-3 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                  isChecked ? "bg-primary-500" : "bg-white border border-ink-faint"
                }`}>
                  {isChecked && (
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="truncate max-w-[100px]" title={med}>{med}</span>
              </label>
            );
          })}
        </div>
      </>
    );
  }

  // Default variant for Profile Sheet
  return (
    <div className="mt-5 pt-4 border-t border-divider">
      <label className="block text-[13px] font-semibold text-ink-main mb-3">
        Чеклист на сегодня
      </label>
      {isLoading && todaySuppLogs.length === 0 ? (
        <div className="animate-pulse space-y-2.5">
          <div className="h-10 bg-surface-muted rounded-xl w-full"></div>
          <div className="h-10 bg-surface-muted rounded-xl w-full"></div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {meds.map((med: string, i: number) => {
            const matchedLog = todaySuppLogs.find((log) => log.supplement_name === med);
            const isChecked = !!matchedLog;

            return (
              <label
                key={`supp-check-${i}`}
                className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-all cursor-pointer group ${
                  isChecked
                    ? "bg-primary-50 border-primary-200 shadow-sm"
                    : "bg-surface-base border-divider hover:border-primary-300"
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isChecked}
                    onChange={() => handleToggle(med, isChecked, matchedLog)}
                  />
                  <div className={`w-[22px] h-[22px] rounded-md border-2 transition-all flex items-center justify-center ${
                    isChecked
                      ? "bg-primary-600 border-primary-600 shadow-inner"
                      : "bg-white border-divider peer-hover:border-primary-400 group-hover:border-primary-400"
                  }`}>
                    {isChecked && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className={`text-sm font-semibold transition-colors flex-1 ${isChecked ? "text-primary-800" : "text-ink-main"}`}>
                  {med}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
