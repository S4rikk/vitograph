# TASK: Async OCR Pipeline через Supabase Realtime (Этап 3 рефакторинга)

## 1. REQUIRED SKILLS & ORDER
Прочитай и применяй следующие скиллы **строго в указанном порядке** перед написанием кода:
1. Read `C:\store\ag_skills\skills\fastapi-pro\SKILL.md` — для Python async patterns
2. Read `C:\store\ag_skills\skills\python-pro\SKILL.md` — для BackgroundTasks
3. Read `C:\store\ag_skills\skills\nodejs-backend-patterns\SKILL.md` — для Express proxy routes
4. Read `C:\store\ag_skills\skills\react-ui-patterns\SKILL.md` — для loading states и async UX
5. Read `C:\store\ag_skills\skills\postgres-best-practices\SKILL.md` — для RLS и таблицы

## 2. ЦЕЛЬ ЗАДАЧИ

Переделать синхронный OCR-пайплайн `POST /parse-image-batch` (до 10 фото → GPT-4o Vision → 20-40 сек ожидания) на **асинхронный job-based пайплайн:**

```
Frontend → POST /parse-image-batch-async → Python создаёт job в lab_scans (PENDING) → возвращает job_id мгновенно
                                            ↓
                                       BackgroundTask: OCR → UPDATE lab_scans SET status=COMPLETED, result=jsonb
                                            ↓
Frontend ← Supabase Realtime (WebSocket) ← postgres_changes event (UPDATE lab_scans)
```

**Ключевой принцип:** Фронтенд стартует Realtime подписку ПЕРЕД отправкой HTTP запроса (решает race condition).

## 3. ARCHITECTURE CONTEXT

### Текущий стек (НЕ менять):
- **Python FastAPI** на порту `8001` — парсит картинки через `extract_biomarkers_from_image_batch()`
- **Node.js Express** на порту `3001` — прокси для фронтенда (файл `integration.ts`)
- **Next.js** — фронтенд, использует `@supabase/ssr` для Supabase клиента
- **Supabase** — PostgreSQL + Realtime (WebSocket)

### Как Python подключается к Supabase:
- Файл: `apps/api/core/database.py` → `supabase_manager.get_client()` — AsyncClient
- Использует `settings.supabase_key` (SUPABASE_ANON_KEY) — **shared global client**
- Для записи в `lab_scans` от имени пользователя нужно передать JWT. Node.js уже передаёт `Authorization` header. Python должен создавать **scoped client** с этим JWT для RLS-совместимости

### Как фронтенд подключается к Supabase (Realtime):
- Файл: `apps/web/src/lib/supabase/client.ts` → `createBrowserClient(SUPABASE_URL, ANON_KEY)`
- Realtime уже встроен в `@supabase/supabase-js`. Нужно просто вызвать `.channel().on('postgres_changes', ...).subscribe()`

## 4. SQL МИГРАЦИЯ (НЕ ВЫПОЛНЯТЬ — только подготовить)

> ⚠️ НЕ запускай никаких SQL команд. Подготовь файл SQL-миграции в `supabase/migrations/` для ручного выполнения Sasha через Supabase SQL Editor.

Создай файл `supabase/migrations/20260402_create_lab_scans.sql`:

```sql
-- ============================================
-- lab_scans: Async OCR job tracking table
-- ============================================
CREATE TABLE IF NOT EXISTS lab_scans (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status      text NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    file_count  integer NOT NULL DEFAULT 0,
    result      jsonb,
    error       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_lab_scans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lab_scans_updated_at
    BEFORE UPDATE ON lab_scans
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_scans_updated_at();

-- RLS
ALTER TABLE lab_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lab scans"
    ON lab_scans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own lab scans"
    ON lab_scans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own lab scans"
    ON lab_scans FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_lab_scans_user_id ON lab_scans(user_id);
CREATE INDEX idx_lab_scans_status ON lab_scans(status) WHERE status IN ('PENDING', 'PROCESSING');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE lab_scans;
```

---

## 5. IMPLEMENTATION STEPS

### Step 1: Python Backend — `apps/api/main.py`

**Добавить 2 новых эндпоинта + 1 background worker function.**

> ⚠️ Старый синхронный `POST /parse-image-batch` НЕ трогать — оставить как fallback.

#### 1A. Импорты (добавить в начало файла)

Добавь импорт `BackgroundTasks` и `Header`:
```python
from fastapi import FastAPI, File, HTTPException, UploadFile, status, Request, BackgroundTasks, Header
```

#### 1B. Background worker `_process_ocr_job` (добавить ПЕРЕД эндпоинтами)

```python
async def _process_ocr_job(
    job_id: str,
    user_id: str,
    images_data: list[tuple[bytes, str]],
    auth_token: str,
):
    """Background: run OCR on images, save result to lab_scans table."""
    from supabase import create_async_client, ClientOptions
    
    # Create scoped client with user's JWT for RLS compatibility
    options = ClientOptions(headers={"Authorization": f"Bearer {auth_token}"})
    client = await create_async_client(
        settings.supabase_url,
        settings.supabase_key,
        options=options,
    )
    
    try:
        # Mark as PROCESSING
        await client.table("lab_scans").update(
            {"status": "PROCESSING"}
        ).eq("id", job_id).execute()

        # Run OCR (reuse existing function)
        extraction = await extract_biomarkers_from_image_batch(images_data)

        if not extraction.biomarkers:
            await client.table("lab_scans").update({
                "status": "FAILED",
                "error": "Не удалось распознать показатели на фото."
            }).eq("id", job_id).execute()
            return

        # Enrich with AI clinical notes (reuse existing function)
        enriched = await enrich_biomarkers_with_insights(extraction.biomarkers)
        extraction.biomarkers = enriched

        # Save COMPLETED result
        await client.table("lab_scans").update({
            "status": "COMPLETED",
            "result": extraction.model_dump(mode="json"),
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error("OCR job %s failed: %s", job_id, traceback.format_exc())
        try:
            await client.table("lab_scans").update({
                "status": "FAILED",
                "error": str(e)[:500],
            }).eq("id", job_id).execute()
        except Exception:
            logger.error("Failed to update job %s status after error", job_id)
```

#### 1C. Endpoint `POST /parse-image-batch-async`

Добавить ПОСЛЕ существующего `POST /parse-image-batch`:

```python
@app.post("/parse-image-batch-async", tags=["file-parser"])
async def parse_lab_report_image_batch_async(
    request: Request,
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Initiate async batch OCR. Returns job_id immediately."""
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Max 10 images.")

    # Extract user ID from Authorization header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    auth_token = auth_header.split(" ", 1)[1]
    
    # Read all files into memory
    images_data = []
    total_size = 0
    for file in files:
        content_type = file.content_type or ""
        if not content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"Expected image, got '{content_type}' for {file.filename}.",
            )
        content = await file.read()
        total_size += len(content)
        if total_size > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Total > 50MB.")
        images_data.append((content, content_type))

    # Create scoped Supabase client with user JWT
    from supabase import create_async_client, ClientOptions
    options = ClientOptions(headers={"Authorization": f"Bearer {auth_token}"})
    client = await create_async_client(
        settings.supabase_url,
        settings.supabase_key,
        options=options,
    )
    
    # Decode user_id from JWT (via Supabase auth)
    user_resp = await client.auth.get_user(auth_token)
    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = str(user_resp.user.id)

    # Create job record
    job_resp = await client.table("lab_scans").insert({
        "user_id": user_id,
        "status": "PENDING",
        "file_count": len(images_data),
    }).execute()

    if not job_resp.data or len(job_resp.data) == 0:
        raise HTTPException(status_code=500, detail="Failed to create job")
    
    job_id = job_resp.data[0]["id"]

    # Schedule background processing
    background_tasks.add_task(
        _process_ocr_job, job_id, user_id, images_data, auth_token
    )

    return {"job_id": job_id, "status": "PENDING"}
```

#### 1D. Endpoint `GET /lab-scans/{job_id}` (polling fallback)

```python
@app.get("/lab-scans/{job_id}", tags=["file-parser"])
async def get_lab_scan_status(job_id: str, request: Request):
    """Polling fallback: check async OCR job status."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization")
    
    auth_token = auth_header.split(" ", 1)[1]
    
    from supabase import create_async_client, ClientOptions
    options = ClientOptions(headers={"Authorization": f"Bearer {auth_token}"})
    client = await create_async_client(
        settings.supabase_url,
        settings.supabase_key,
        options=options,
    )
    
    resp = await client.table("lab_scans").select("*").eq("id", job_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return resp.data
```

---

### Step 2: Node.js Proxy — `apps/api/src/ai/src/lib/python-core.ts`

Добавить **2 новых метода** в класс `PythonCoreClient`:

```typescript
/**
 * Initiate async batch OCR — returns job_id immediately
 */
async parseImageBatchAsync(
  files: Express.Multer.File[],
  authToken: string
): Promise<{ job_id: string; status: string }> {
  const formData = new FormData();
  for (const file of files) {
    const mimeType = file.mimetype || "application/octet-stream";
    const blob = new Blob([file.buffer], { type: mimeType });
    formData.append("files", blob, file.originalname || "lab_report_photo.jpg");
  }

  return this.request<{ job_id: string; status: string }>(
    "/parse-image-batch-async",
    {
      method: "POST",
      body: formData,
      headers: { "Authorization": `Bearer ${authToken}` },
    },
    15_000 // 15 sec — just creating a job, should be fast
  );
}

/**
 * Get job status (polling fallback)
 */
async getLabScanStatus(jobId: string, authToken: string): Promise<any> {
  return this.request<any>(
    `/lab-scans/${jobId}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${authToken}`,
      },
    },
    10_000
  );
}
```

> ⚠️ **ВАЖНО**: Метод `request()` в `python-core.ts` передаёт `headers` через `options.headers`. Проверь, что `FormData` headers не конфликтуют с явным `Authorization`. Если `FormData` и `headers` передаются вместе, не задавай `Content-Type` вручную — `fetch` добавит `multipart/form-data` с boundary автоматически.

---

### Step 3: Node.js Routes — `apps/api/src/ai/src/routes/integration.ts`

Добавить **2 новых route** ПОСЛЕ существующего `/parse-image-batch`:

```typescript
/**
 * POST /api/v1/integration/parse-image-batch-async
 * Initiate async batch OCR via Python BackgroundTasks
 */
router.post(
  "/parse-image-batch-async",
  upload.array("files", 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("[parse-image-batch-async] ①  Handler entered");
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new AppError("No files uploaded", 400);
      }
      if (files.length > 10) {
        throw new AppError("Max 10 files", 400);
      }

      for (const file of files) {
        if (!file.mimetype?.startsWith("image/")) {
          throw new AppError(`Expected image, got ${file.mimetype}`, 400);
        }
      }

      // Extract auth token
      const authToken = req.headers.authorization?.split(" ")[1];
      if (!authToken) {
        throw new AppError("Missing Authorization token", 401);
      }

      console.log(`[parse-image-batch-async] ②  Files: ${files.length}, forwarding to Python...`);
      const result = await pythonCore.parseImageBatchAsync(files, authToken);
      console.log(`[parse-image-batch-async] ③  Job created: ${result.job_id}`);

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("[parse-image-batch-async] ❌ CRASH:", error instanceof Error ? error.stack : error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/integration/lab-scans/:jobId
 * Polling fallback for async OCR job status
 */
router.get(
  "/lab-scans/:jobId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authToken = req.headers.authorization?.split(" ")[1];
      if (!authToken) {
        throw new AppError("Missing Authorization token", 401);
      }
      const result = await pythonCore.getLabScanStatus(req.params.jobId, authToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);
```

---

### Step 4: Frontend — Новый хук `apps/web/src/hooks/useLabScanJob.ts`

Создай новый файл. Этот хук управляет полным lifecycle async OCR job:

```typescript
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
        // Only poll if status hasn't changed to terminal
        if (jobIdRef.current && (status === "PENDING" || status === "PROCESSING" || status === "UPLOADING")) {
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
```

---

### Step 5: Frontend — `apps/web/src/components/medical/MedicalResultsView.tsx`

Модифицируй `handleFilesAccepted` чтобы использовать async pipeline для batch images.

#### 5A. Импорты
Добавь:
```typescript
import { useLabScanJob } from "@/hooks/useLabScanJob";
```

#### 5B. Хук внутри компонента
Добавь после остальных `useState`:
```typescript
const { startJob, status: jobStatus, result: jobResult, error: jobError, reset: resetJob } = useLabScanJob();
```

#### 5C. Модифицируй `handleFilesAccepted`

Замени блок `if (type === "image")`:

```typescript
if (type === "image") {
  const compressedBlobs = await Promise.all(
    files.map(f => compressImageToBlob(f, 2048))
  );
  
  if (compressedBlobs.length > 1) {
    // Use ASYNC pipeline for batch uploads
    await startJob(compressedBlobs);
    // Status will be tracked via jobStatus — no data returned here
    return; // Exit early — useEffect below will handle completion
  } else {
    data = await apiClient.uploadImageFile(compressedBlobs[0]);
  }
}
```

#### 5D. useEffect для обработки async job completion

Добавь после существующих useEffect:
```typescript
// Handle async job completion
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
```

#### 5E. Улучшить Loading Skeleton

Замени существующий блок loading skeleton (`{uploadState === "loading" && (...)}`):

```tsx
{uploadState === "loading" && (
  <div className="flex flex-col items-center gap-4 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-8 shadow-sm">
    <div className="relative h-12 w-12">
      <div className="absolute inset-0 animate-spin rounded-full border-3 border-cyan-200 border-t-cyan-600" />
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
```

---

### Step 6: Frontend — `apps/web/src/lib/api-client.ts`

Добавить новый метод `uploadImageFilesAsync` в класс `AiApiClient` (рядом с существующим `uploadImageFiles`):

```typescript
/**
 * Initiates async batch OCR via Supabase Realtime pipeline.
 * Returns job_id for tracking.
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
```

---

## 6. КРИТИЧЕСКИЕ ОГРАНИЧЕНИЯ (ОБЯЗАТЕЛЬНО СОБЛЮДАЙ)

1. **НЕ удаляй** существующий синхронный `POST /parse-image-batch`. Он остаётся как fallback.
2. **НЕ запускай** `npx prisma db push`, `npx prisma migrate dev` — порты Supabase заблокированы.
3. **НЕ запускай** `node -e`, `python -c`, `tsc --noEmit`.
4. **НЕ трогай** `SUPABASE_ANON_KEY` → `SUPABASE_KEY` — это критический баг из прошлого.
5. **НЕ запускай** деплой на сервер без одобрения Sasha.
6. Для single-image upload (`compressedBlobs.length === 1`) — используй СТАРЫЙ синхронный путь. Async pipeline ТОЛЬКО для batch (>1 файла).

## 7. ТЕСТИРОВАНИЕ

После реализации — запусти `npm run dev` в `apps/api/src/ai` и `uvicorn main:app` в `apps/api` локально. Проверь:
1. `curl -X POST http://localhost:8001/parse-image-batch-async ...` → должен вернуть `{ job_id, status: "PENDING" }`
2. `curl http://localhost:8001/lab-scans/{job_id}` → должен вернуть текущий статус

## 8. ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

- Пользователь загружает 5+ фото → видит красивый прогресс-бар (UPLOADING → PENDING → PROCESSING → COMPLETED)
- Результат появляется через WebSocket (без перезагрузки страницы)
- Нет HTTP таймаутов даже при 40+ секундной обработке
- Инфраструктура остаётся простой (только PM2, без Celery/Redis)
