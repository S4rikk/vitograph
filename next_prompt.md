# Task: Persist Biomarker Cards Across Page Refresh

## Context
When the user uploads lab results, biomarker cards appear (PDW-CV, PCT, P-LCC, etc.). When they press "Сформировать отчёт", the diagnostic report is saved to Supabase and survives page refresh. **BUT** the biomarker cards vanish on F5/refresh because they only live in React state.

The report is stored in `profiles.lab_diagnostic_reports` (JSONB array). Each element is:
```json
{
  "timestamp": "...",
  "biomarkers_count": 25,
  "data_hash": "...",
  "report": { ... diagnostic text ... }
}
```

Notice: `biomarkers` array is **NOT** saved here. That's the root cause.

---

## Fix: 3 Files, 3 Changes

### Change 1: Save biomarkers alongside report

**File:** `apps/api/src/ai/src/graph/lab-report-analyzer.ts`

Find this block around line 287:
```typescript
        existingReports.push({
            timestamp: new Date().toISOString(),
            biomarkers_count: biomarkerResults.length,
            data_hash: currentHash,
            report: result.data,
        });
```

Replace with:
```typescript
        existingReports.push({
            timestamp: new Date().toISOString(),
            biomarkers_count: biomarkerResults.length,
            data_hash: currentHash,
            report: result.data,
            biomarkers: biomarkerResults,
        });
```

That's it — just add `biomarkers: biomarkerResults` to the object. The `biomarkerResults` variable is already available in scope (it's the first argument of the `runLabReportAnalyzer` function, line 208). The `profiles.lab_diagnostic_reports` column is JSONB, so Supabase accepts any shape.

---

### Change 2: Update TypeScript interface

**File:** `apps/web/src/lib/api-client.ts`

Find this interface at at line 727:
```typescript
export interface StoredDiagnosticReport {
  timestamp: string;
  biomarkers_count: number;
  data_hash?: string;
  report: LabDiagnosticReport;
}
```

Replace with:
```typescript
export interface StoredDiagnosticReport {
  timestamp: string;
  biomarkers_count: number;
  data_hash?: string;
  report: LabDiagnosticReport;
  biomarkers?: BiomarkerResult[];
}
```

Just add `biomarkers?: BiomarkerResult[]` — optional because old reports in the DB won't have this field.

---

### Change 3: Restore cards from latest report on page load

**File:** `apps/web/src/components/medical/MedicalResultsView.tsx`

Find the `useEffect` block that starts around line 58:
```typescript
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
```

Replace the ENTIRE `useEffect` block with:
```typescript
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
          
          // Restore biomarker cards from the latest report (if saved)
          const latest = history[0];
          if (latest.biomarkers && latest.biomarkers.length > 0 && !editableBiomarkers) {
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
```

The key addition is the block after `setSelectedTimestamp(history[0].timestamp)`:
- We check if the latest report has `biomarkers` saved.
- If biomarkers exist and don't already exist in state (no active upload happening), we restore them into `editableBiomarkers`, `results`, and set `uploadState` to `"done"` — which triggers the card grid to render.

> [!IMPORTANT]
> The `editableBiomarkers` check prevents overwriting cards during an active upload/edit session. If the user has just uploaded new data, `editableBiomarkers` will already be set and we skip the restoration.

---

## Files Modified (Summary)

| # | File | What changes |
|---|------|-------------|
| 1 | `apps/api/src/ai/src/graph/lab-report-analyzer.ts` | Add `biomarkers: biomarkerResults` to the saved report object |
| 2 | `apps/web/src/lib/api-client.ts` | Add `biomarkers?: BiomarkerResult[]` to `StoredDiagnosticReport` interface |
| 3 | `apps/web/src/components/medical/MedicalResultsView.tsx` | Restore biomarker cards from latest report in `fetchHistory` |

**DO NOT modify any other files.**
**DO NOT change any existing functionality.**

---

## Required Skills
1. `react-ui-patterns`

## Verification

1. Start all dev servers (Python API, Node.js, Next.js).
2. Go to "Анализы" tab.
3. Upload a lab photo → cards appear → press "Сформировать отчёт" → wait for report.
4. **Refresh the page (F5).**
5. **CHECK 1:** Biomarker cards are still visible after page refresh.
6. **CHECK 2:** The diagnostic report is also still visible.
7. **CHECK 3:** Cards show the correct values (same as before refresh).
8. **CHECK 4:** Cards are editable after restore (try changing a value, verify button appears).
9. Upload a NEW photo → verify new cards replace the old ones (no stale data).

---
**Maya (Architect)**
Три файла, три добавления. Бэкенд сохраняет биомаркеры, фронтенд восстанавливает их при загрузке.
