# VITOGRAPH — Frontend Component Map

> **Дата актуальности:** 19 апреля 2026 (обновлено: Admin Panel, Health Goals)
>
> Карта UI-компонентов Next.js 14+ (App Router) с описанием ответственности и зависимостей.

---

## 1. Архитектура страницы

```
layout.tsx (RootLayout)
└── page.tsx → ClientPage.tsx
    ├── TabSwitcher (tabs: "Дневник", "Ассистент", "Анализы", "Профиль")
    │   ├── tab=0 → FoodDiaryView
    │   ├── tab=1 → AiAssistantView
    │   ├── tab=2 → MedicalResultsView
    │   └── tab=3 → UserProfileSheet
    └── login/ → Supabase Auth (SignOutButton)
```

> Приложение — **SPA с табами**. `ClientPage.tsx` содержит логику авторизации, onboarding и переключения вкладок.

---

## 2. Модули компонентов

### 2.1 `diary/` — Дневник питания

| Компонент                | Назначение                                                 | Ключевые props / state                                                      | API-зависимости                                                                     |
| :----------------------- | :--------------------------------------------------------- | :-------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| **FoodDiaryView**        | Главный экран дневника. Чат-интерфейс для логирования еды  | `messages[]`, `threadId`, `macros`, `dynamicTarget`, `dynamicMicros`        | `apiClient.chat()`, `apiClient.getNutritionTargets()`, `apiClient.getChatHistory()` |
| **FoodInputForm**        | Поле ввода + кнопка фото + кнопка отправки                 | `onSend(text, imageBase64?)`                                                | Нет (чисто UI)                                                                      |
| **ChatMessage**          | Рендер одного сообщения (user / system)                    | `variant`, `text`, `time`                                                   | Нет                                                                                 |
| **GlycemicSurfPanel**    | Интерактивная кривая, средний показатель глюкозы, пики и цветные зоны   | `timeline`, `baseline`, `zones`                                             | Нет (вычисляет графики на основе AI данных)                                         |
| **DatePaginator**        | Переключение дат (← Сегодня →)                             | `selectedDate`, `onDateChange`                                              | Нет                                                                                 |
| **WaterTracker**         | Трекер потребления воды                                    | `glasses`, `onAdd`, `onRemove`                                              | Supabase прямой запрос                                                              |
| **MealScoreBadge**       | Бейдж качества приёма пищи (0-100)                         | `score`, `reason`                                                           | Нет                                                                                 |
| **FoodCard**             | Карточка приёма пищи в чате (GI Badge, chips для микронутриентов) | `mealData`, `mealScore`, `mealReason`                                       | Нет (презентационный)                                                              |
| **FeedbackButton**       | Кнопка отправки фидбека                                    | —                                                                           | `apiClient.submitFeedback()`                                                        |

---

### 2.2 `assistant/` — AI-ассистент

| Компонент           | Назначение                                                                      | API-зависимости                                                       |
| :------------------ | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------- |
| **AiAssistantView** | Полноценный чат с AI-другом (режим `assistant`). Поддержка истории, изображений | `apiClient.chat(chatMode: "assistant")`, `apiClient.getChatHistory()` |

---

### 2.3 `medical/` — Анализы и диагностика

| Компонент                | Назначение                                                                            | API-зависимости                                                                                                                                                |
| :----------------------- | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MedicalResultsView**   | Оркестратор: загрузка PDF/фото, редактируемые карточки биомаркеров (Pause & Review), красная подсветка пустых полей, диагностический отчёт, соматика. **[NEW]** Батч-загрузка использует `useLabScanJob` хук с async pipeline + Realtime progress bar (UPLOADING→PENDING→PROCESSING→COMPLETED). | `apiClient.uploadFile()`, `apiClient.uploadImageFile()`, **`useLabScanJob()`** → `/parse-image-batch-async`, `apiClient.analyzeLabReport()`, `apiClient.getLabReportsHistory()`, `apiClient.getSomaticHistory()` |
| **UploadZone**           | Drag-n-drop зона для PDF/DOCX                                                         | `onFileSelect(file)`                                                                                                                                           |
| **PhotoUploader**        | Кнопка камеры для фото анализов                                                       | `onCapture(base64)`                                                                                                                                            |
| **ResultCard**           | Одиночная карточка биомаркера                                                         | `name`, `value`, `unit`, `flag`, `referenceRange`                                                                                                              |
| **DiagnosticReportCard** | Развёрнутый отчёт GPT-4o (паттерны, диета, добавки)                                   | `report`, `onDelete`                                                                                                                                           |
| **SomaticAnalysisCard**  | Результат анализа ногтей/кожи/языка                                                   | `analysis`, `type`                                                                                                                                             |
| **NailAnalysisCard**     | Специализированная карточка анализа ногтей                                            | `markers[]`, `interpretation`                                                                                                                                  |
| **SymptomTrackerWidget** | Виджет трекера симптомов (запись и отслеживание симптомов)                             | `symptoms[]`, `onAdd`, `onRemove`                                                                                                                              |

---

### 2.4 `onboarding/` — Онбординг

| Компонент            | Назначение                                                                                                                               | API-зависимости                     |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| **OnboardingWizard** | 8-шаговый визард (basic → sleep → environment → activity → diet → medical → stress → exterior). Сохраняет в `profiles.lifestyle_markers` | Supabase прямой запрос к `profiles` |

**Секции визарда:**
1. Базовые метрики (рост, вес, пол, цель)
2. Сон и режим
3. Окружающая среда
4. Активность
5. Питание
6. Анамнез
7. Стресс
8. Внешние маркеры

---

### 2.5 `shared/` — Общие виджеты

| Компонент                       | Назначение                                                   | API-зависимости                                        |
| :---------------------------- | :--------------------------------------------------------- | :----------------------------------------------- |
| **SupplementChecklistWidget** | Чеклист ПАДов с протоколом (отметки приёма, UI-сетка)  | `apiClient.getSupplements()`, `apiClient.logSupplementIntake()` |
| **HealthGoalsWidget**         | Виджет управления целями по здоровью пользователя (аккордеон-панель, мобильный дизайн). Работает только в интерфейсе Ассистента. Удаление цели устанавливает `status='abandoned'` (не DELETE). | Supabase прямой запрос к `user_active_skills` (WHERE `status='active'`) |

---

### 2.6 `profile/` — Профиль

| Компонент             | Назначение                                     | API-зависимости         |
| :-------------------- | :--------------------------------------------- | :---------------------- |
| **UserProfileSheet**  | Боковая панель профиля (редактирование данных) | Supabase `profiles`     |
| **DeviceWidgetCard**  | Виджет подключённого устройства (wearable)     | — (будущая фича)        |
| **ManualEntryDialog** | Диалог ручного ввода биомаркера                | Supabase `test_results` |

---

### 2.7 `auth/` — Авторизация

| Компонент         | Назначение                |
| :---------------- | :------------------------ |
| **SignOutButton** | Кнопка выхода из аккаунта |

---

### 2.8 `ui/` — Общие UI-компоненты

| Компонент       | Назначение                                         |
| :-------------- | :------------------------------------------------- |
| **Logo**        | SVG-логотип проекта (синий крест-пропеллер). **Критическая деталь:** содержит зашифрованную информацию в дробных частях координат `y2`. Нельзя изменять прозрачность. |
| **TabSwitcher** | Переключатель вкладок (внизу экрана, mobile-first) |
| **dialog.tsx**  | Переиспользуемый модальный диалог                  |
| **tabs.tsx**    | Базовый компонент табов                            |

---

### 2.9 `admin/` — Админ-панель

> **Доступ:** `app_metadata.role === "admin"`. Проверяется в `admin/layout.tsx`. Dark mode forced.

| Компонент | Назначение | Родитель | API-зависимости |
|:---|:---|:---|:---|
| **AdminSidebar** | Боковое меню навигации (обзор, пользователи, фидбэк, KB, AI настройки) | `admin/layout.tsx` | Нет |

#### `admin/users/` — Управление пользователями

| Компонент | Назначение |
|:---|:---|
| **page.tsx** | Таблица пользователей (Server Component). Supabase Admin API. |
| **UserActions** | Кнопки ban/unban, удаления, смены роли. Client component с try-catch. |
| **AddUserModal** | Модальное окно создания пользователя. |
| **CopyEmail** | Click-to-copy email с визуальным подтверждением. |
| **actions.ts** | Server Actions: createUser, banUser, unbanUser, deleteUser, updateRole. |

#### `admin/feedback/` — Обратная связь

| Компонент | Назначение |
|:---|:---|
| **page.tsx** | Таблица фидбэка с фильтрацией по статусу. |
| **StatusSelect** | Dropdown смены статуса (new/reviewed/resolved). |
| **actions.ts** | Server Action: updateFeedbackStatus. |

#### `admin/knowledge/` — База знаний (KB)

| Компонент | Назначение |
|:---|:---|
| **page.tsx** | Список KB-документов (slug, category, статус ингестии). |
| **AddDocumentModal** | Добавление нового документа в KB (заголовок, категория, Markdown). |
| **DeleteDocumentButton** | Кнопка удаления с подтверждением. |
| **actions.ts** | Server Actions: addKBDocument, deleteKBDocument. |

#### `admin/ai-settings/` — Настройки AI

| Компонент | Назначение |
|:---|:---|
| **page.tsx** | Страница настроек AI-модели. |
| **AiSettingsForm** | Форма редактирования параметров AI (модель, temperature, имя). |
| **actions.ts** | Server Action: updateAiSettings. |

---

## 3. Граф зависимостей (Component → API)

```mermaid
graph LR
    subgraph Frontend
        FDV[FoodDiaryView]
        AAV[AiAssistantView]
        MRV[MedicalResultsView]
        OBW[OnboardingWizard]
        DAP[DailyAllowancesPanel]
        ADM[Admin Panel]
    end

    subgraph "Node.js AI (3001)"
        CHAT["/ai/chat"]
        FOOD["/ai/analyze-food"]
        LAB["/ai/analyze-lab-report"]
        SOM["/ai/analyze-somatic"]
        NT["/ai/nutrition-targets"]
        SUPP["/supplements/today"]
        INT_PARSE["/integration/parse"]
        LABEL["/ai/vision/label"]
    end

    FDV --> CHAT
    FDV --> NT
    FDV --> FOOD
    AAV --> CHAT
    MRV --> INT_PARSE
    MRV --> LAB
    MRV --> SOM
    FDV --> DAP
    FDV --> LABEL
    ADM --> |Supabase Admin API| ADM
```

---

## 4. Ключевые файлы поддержки

| Файл                                                                               | Назначение                                                       |
| :--------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| [`nutrient-colors.ts`](file:///c:/project/VITOGRAPH/apps/web/src/lib/food-diary/nutrient-colors.ts) | Ядро цветового кодирования плашек в чате. Использует биологический/химический словарь ассоциаций + **детерминированный строковый хэшинг** для стабилизации цветов неизвестных микронутриентов. |
| [`api-client.ts`](file:///c:/project/VITOGRAPH/apps/web/src/lib/api-client.ts)     | Единый HTTP-клиент для всех API-вызовов (20KB, ~40 методов)      |
| [`image-utils.ts`](file:///c:/project/VITOGRAPH/apps/web/src/lib/image-utils.ts)   | Сжатие изображений (canvas → blob, max 2048px для анализов, 1024px для еды)  |
| [`health-core.ts`](file:///c:/project/VITOGRAPH/apps/web/src/types/health-core.ts) | Основные TypeScript-типы (Profile, Biomarker, MealLog, etc.)     |
| [`middleware.ts`](file:///c:/project/VITOGRAPH/apps/web/src/middleware.ts)         | Next.js middleware для Supabase Auth (redirect неавторизованных) |
| [`useLabScanJob.ts`](file:///c:/project/VITOGRAPH/apps/web/src/hooks/useLabScanJob.ts) 🆕 | **[NEW]** React-хук для async OCR pipeline. Управляет полным lifecycle задачи: запуск job → Supabase Realtime подписка → status tracking (`UPLOADING → PENDING → PROCESSING → COMPLETED/FAILED`) → fallback polling через 60 сек. |
