# TASK: Заблокировать кнопку «Сформировать отчёт» после генерации отчёта

## 1. REQUIRED SKILLS & ORDER

1. Read `C:\store\ag_skills\skills\frontend-developer\SKILL.md` — React component state management

---

## 2. КОНТЕКСТ

**Файл для правки:** `apps/web/src/components/medical/MedicalResultsView.tsx`

**Проблема:**
Кнопка «Сформировать отчёт» (строка 471–481) снова становится активной (пульсирует фиолетовым) после того, как диагностический отчёт уже сформирован. Пользователь может нажать её повторно и создать дублирующий отчёт.

**Текущая логика disabled (строка 473):**
```tsx
disabled={isDirty || isDiagnosing || isRefreshing}
```
После завершения `runDiagnosticAnalysis` → `isDiagnosing` становится `false` → кнопка снова активна ❌

---

## 3. ЗАДАЧА

### Шаг 1: Добавить новый state-флаг

Добавь в блок state-переменных **рядом с `isDiagnosing`** (строка 70):

```tsx
const [isDiagnosing, setIsDiagnosing] = useState(false);
const [reportAlreadyGenerated, setReportAlreadyGenerated] = useState(false); // ← НОВОЕ
const [diagnosisError, setDiagnosisError] = useState<string | undefined>();
```

---

### Шаг 2: Установить флаг при загрузке страницы

В `useEffect` для `fetchHistory` (строки 73–105), в блоке, где уже есть история (`reportHistory.length > 0`, строка 83), добавь установку флага:

**Было:**
```tsx
setReportHistory(history || []);
if (history && history.length > 0) {
  setSelectedTimestamp(history[0].timestamp);
  
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
```

**Стало:**
```tsx
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
```

---

### Шаг 3: Установить флаг после успешной генерации

В функции `runDiagnosticAnalysis` (строки 111–132), после успешного получения истории, установи флаг:

**Было:**
```tsx
    // Re-fetch history to get the true state from DB (prevents fake duplicates)
    const history = await apiClient.getLabReportsHistory();
    setReportHistory(history || []);
    if (history && history.length > 0) {
      setSelectedTimestamp(history[0].timestamp);
    }
```

**Стало:**
```tsx
    // Re-fetch history to get the true state from DB (prevents fake duplicates)
    const history = await apiClient.getLabReportsHistory();
    setReportHistory(history || []);
    if (history && history.length > 0) {
      setSelectedTimestamp(history[0].timestamp);
      setReportAlreadyGenerated(true); // ← НОВОЕ: заблокировать кнопку навсегда
    }
```

---

### Шаг 4: Добавить флаг в условие disabled кнопки

**Было (строка 473):**
```tsx
disabled={isDirty || isDiagnosing || isRefreshing}
```

**Стало:**
```tsx
disabled={isDirty || isDiagnosing || isRefreshing || reportAlreadyGenerated}
```

---

### Шаг 5: Обновить стиль кнопки

**Было (строки 474–478):**
```tsx
className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
  !isDirty && !isDiagnosing && !isRefreshing
    ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.6)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] hover:bg-purple-700 hover:-translate-y-0.5 active:translate-y-0"
    : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-70"
}`}
```

**Стало:**
```tsx
className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
  !isDirty && !isDiagnosing && !isRefreshing && !reportAlreadyGenerated
    ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.6)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] hover:bg-purple-700 hover:-translate-y-0.5 active:translate-y-0"
    : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-70"
}`}
```

---

### Шаг 6: Сброс при новой загрузке файла

В `handleFilesAccepted` (строка 134), в начале функции, добавь сброс флага, чтобы при загрузке **нового** анализа кнопка снова стала доступной:

**Было:**
```tsx
  const handleFilesAccepted = useCallback(async (files: File[], type: "document" | "image") => {
    setUploadState("loading");
    setErrorMessage(undefined);
    setResults(null);
    setDiagnosisError(undefined);
    resetJob();
```

**Стало:**
```tsx
  const handleFilesAccepted = useCallback(async (files: File[], type: "document" | "image") => {
    setUploadState("loading");
    setErrorMessage(undefined);
    setResults(null);
    setDiagnosisError(undefined);
    setReportAlreadyGenerated(false); // ← НОВОЕ: новый файл — кнопка снова активна
    resetJob();
```

---

## 4. ОГРАНИЧЕНИЯ

1. **НЕ меняй** никакую другую логику, стили или функции — только указанные места.
2. **НЕ удаляй** существующие условия `isDirty || isDiagnosing || isRefreshing` — они остаются.
3. **НЕ создавай** новых компонентов и файлов.
4. Правки строго только в `MedicalResultsView.tsx`.

---

## 5. САМОПРОВЕРКА

Перед финализацией убедись:
- [ ] `reportAlreadyGenerated` инициализирован как `false`
- [ ] Устанавливается в `true` в **двух** местах: после `fetchHistory` и после `runDiagnosticAnalysis`
- [ ] Сбрасывается в `false` в `handleFilesAccepted` (при загрузке нового файла)
- [ ] Добавлен во все 3 места в JSX: `disabled`, `className` кнопки
- [ ] Кнопка становится серой (`bg-slate-100 text-slate-400 cursor-not-allowed`) после генерации

---

## 6. ОТЧЁТ

Запиши в `C:\project\kOSI\next_report.md`:
1. Перечень изменённых строк.
2. Проверил ли, что сброс флага происходит при новом upload.
3. Вердикт: `DONE` или `NEEDS FIXES`.
