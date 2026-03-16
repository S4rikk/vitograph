# ТЗ: Исправление записи еды и макронутриентов (Phase 53g)

## 🎯 Цель
Исправить ошибку записи еды в базу данных, возникшую из-за рассинхрона кода с новой схемой БД (миграция 034), и устранить предупреждения о CORS в логах.

## 🛠️ Скиллы для использования (в этом порядке)
1. `nodejs-backend-patterns`
2. `postgres-best-practices`
3. `nextjs-app-router-patterns`
4. `systematic-debugging`

---

## 📋 План действий

### 1. Обновление инструмента `log_meal` (AI Backend)
**Файл:** `C:\project\VITOGRAPH\apps\api\src\ai\src\graph\tools.ts`
- В функции `logMealTool`:
    - При вставке в `meal_logs`: добавить колонки `total_protein: protein_g`, `total_fat: fat_g`, `total_carbs: carbs_g`.
    - При вставке в `meal_items`: добавить колонки `protein_g`, `fat_g`, `carbs_g`.
    - **ВАЖНО:** Заменить `.select("id").single()` на `.select("id")`. Если результат — массив, брать `[0].id`. Это предотвратит исключения, если RLS политика не дает мгновенно прочитать строку.

### 2. Обновление обработчика `AnalyzeFood` (Food Vision)
**Файл:** `C:\project\VITOGRAPH\apps\api\src\ai\src\ai.controller.ts`
- В функции `handleAnalyzeFood`:
    - Рассчитать агрегированные макросы для всех найденных продуктов.
    - При вставке в `meal_logs`: добавить `total_protein`, `total_fat`, `total_carbs` (общая сумма).
    - При вставке в `meal_items`: убедиться, что `protein_g`, `fat_g`, `carbs_g` для каждого продукта записываются.
    - Также использовать `.select("id")` без `.single()`.

### 3. Исправление CORS в Next.js (Frontend)
**Файл:** `C:\project\VITOGRAPH\apps\web\next.config.ts` (или `.js`)
- По логам видно `Blocked cross-origin request from 192.168.1.9`.
- Добавь `allowedDevOrigins: ['192.168.1.9:3000']` в секцию `experimental` (согласно документации Next.js), чтобы разрешить разработку по локальной сети.

### 4. Верификация
- Запусти `fetch_logs_vg.bat` и убедись, что PM2 логи чистые при отправке еды текстом и через фото.

---

## 🚀 Деплой
После исправлений выполни `deploy_to_server_vg.bat`.

Использованные скиллы: nodejs-backend-patterns, postgres-best-practices, nextjs-app-router-patterns
