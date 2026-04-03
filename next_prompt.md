# TASK: Фаза 4 — API Integration (Semantic Memory & Emotional Context)

## 1. REQUIRED SKILLS & ORDER

1. Read `C:\store\ag_skills\skills\ai-engineer\SKILL.md` — LLM integration & prompt design
2. Read `C:\store\ag_skills\skills\nodejs-backend-patterns\SKILL.md` — async execution, Promise.all

## 2. КОНТЕКСТ

### Что уже сделано
Фазы 1, 2 и 3 завершены. 
Supabase инфраструктура работает: `user_emotional_profile` и `user_memory_vectors` (Layer 2 & 3) автоматически заполняются через Edge Functions.

### Цель Фазы 4
Научить `ai.controller.ts` читать эти данные перед каждым ответом и передавать их в `ChatPromptBuilder`. 
Это позволит ИИ ссылаться на прошлые факты из жизни пользователя и подстраивать тон под его настроение.

### Архитектурный документ
> **ОБЯЗАТЕЛЬНО ПРОЧИТАЙ:** `docs/memory_architecture.md` (v2.0.0, секция "9. Интеграция с ChatPromptBuilder" и секция "10. Data Flow")

---

## 3. ЗАДАЧИ

### Шаг 1: Расширить структуру `ChatPromptBuilder`

**Файл:** `apps/api/src/ai/src/prompts/chat-prompt-builder.ts`

**Изменения:**
1. Добавь метод `withSemanticMemory(memories: Array<{ content: string; memory_type: string; }> | null): this`
   - Если memories пусто, null, или массив длины 0, ничего не добавлять (return this).
   - Формат секции (**priority: 1**, чуть ниже persona):
     ```
     ### LONG-TERM MEMORY (CRITICAL CONTEXT)
     Here are relevant facts previously extracted from conversations with this user:
     <user_memories>
     - [fact.content] (type: fact.memory_type)
     - ...
     </user_memories>
     USE THESE FACTS naturally to show you remember the user. 
     DO NOT start sentences with "I remember you said" or "Я помню, что ты говорил".
     Just naturally incorporate these facts into your advice and responses.
     ```

2. Добавь метод `withEmotionalContext(profile: { current_mood: string; mood_trend: string; trust_level: number; } | null): this`
   - Если profile null, ничего не добавлять (return this).
   - Формат секции (**priority: 1**):
     ```
     ### EMOTIONAL CONTEXT
     - User's current mood: {current_mood}
     - Mood trend: {mood_trend}
     - Trust level: {trust_level} (0.0=low, 1.0=high)
     Adjust your psychological tone accordingly:
     - If mood is "stressed" or "anxious": be extra supportive, gentle.
     - If mood is "frustrated": acknowledge frustration, be practical.
     - If trust > 0.8: you can be more direct and use humor more freely.
     - If mood_trend is "declining": consider asking how the user is doing.
     ```

---

### Шаг 2: Создать сервисный метод для получения контекста

**Новый Файл:** `apps/api/src/ai/src/services/memory.service.ts`

> ⚠️ **КРИТИЧНО: НЕ используй `import OpenAI from "openai"`!**
> Пакет `openai` **НЕ установлен** в `package.json`. 
> Используй **`OpenAIEmbeddings` из `@langchain/openai`** — это уже в зависимостях (версия ^1.2.8).

**Код:**
```typescript
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";

// Singleton embeddings model (reuse across requests)
const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  dimensions: 384,
});

/**
 * Fetch emotional profile and semantic memories for the current user.
 * Returns a tuple: [emotionalProfile, semanticMemories]
 * Designed to be called via Promise.all alongside other async operations.
 * 
 * IMPORTANT: All errors are swallowed internally. If anything fails,
 * the function returns [null, null] so the chat still works.
 */
export async function fetchAdvancedMemoryContext(
  userId: string,
  userMessage: string,
  token: string
): Promise<[EmotionalProfile | null, SemanticMemory[] | null]> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  // Run both queries in parallel
  const [emotionalProfile, semanticMemories] = await Promise.all([
    fetchEmotionalProfile(supabase, userId),
    fetchSemanticMemories(supabase, userId, userMessage)
  ]);

  return [emotionalProfile, semanticMemories];
}

// ── Types ──────────────────────────────────────────────────────────

export interface EmotionalProfile {
  current_mood: string;
  mood_trend: string;
  trust_level: number;
}

export interface SemanticMemory {
  id: number;
  content: string;
  memory_type: string;
  importance: number;
  similarity: number;
}

// ── Internal functions ──────────────────────────────────────────────

async function fetchEmotionalProfile(
  supabase: any, 
  userId: string
): Promise<EmotionalProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_emotional_profile')
      .select('current_mood, mood_trend, trust_level')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 = "not_found" (no profile yet — totally normal)
      if (error.code !== 'PGRST116') {
        console.warn('[MemoryService] Emotional profile error:', error.message);
      }
      return null;
    }
    return data;
  } catch (err) {
    console.error('[MemoryService] Unexpected error fetching emotional profile:', err);
    return null;
  }
}

async function fetchSemanticMemories(
  supabase: any, 
  userId: string, 
  message: string
): Promise<SemanticMemory[] | null> {
  if (!message || message.trim().length === 0) return null;

  try {
    // 1. Generate embedding for current user message
    //    Uses @langchain/openai OpenAIEmbeddings (already installed)
    const queryEmbedding = await embeddings.embedQuery(message);

    // 2. Search memories via RPC (SECURITY DEFINER — bypasses RLS, filters by p_user_id)
    const { data, error } = await supabase.rpc('match_user_memories', {
      p_user_id: userId,
      query_embedding: queryEmbedding,
      match_count: 5,
      similarity_threshold: 0.65,
    });

    if (error) {
      console.warn('[MemoryService] RPC match_user_memories error:', error.message);
      return null;
    }

    return data && data.length > 0 ? data : null;
  } catch (err) {
    console.error('[MemoryService] Unexpected error fetching semantic memories:', err);
    return null;
  }
}
```

**Ключевые решения:**
- `OpenAIEmbeddings` — singleton, переиспользуется между запросами (не создаётся каждый раз).
- `embeddings.embedQuery(message)` — единственный вызов, возвращает `number[]`.
- Нет `increment_access_count` — access_count обновляется в consolidator (Edge Function).
- Все ошибки обрабатываются внутри: если OpenAI упадёт, чат просто не покажет воспоминания.

---

### Шаг 3: Интеграция в `ai.controller.ts`

**Файл:** `apps/api/src/ai/src/ai.controller.ts`

**ОБА метода нужно обновить: `handleChat` и `handleChatStream`.** Их код практически идентичен в области 1077-1210 / 1349-1480.

**3.1 Добавить import:**
```typescript
import { fetchAdvancedMemoryContext } from "./services/memory.service.js";
```

**3.2 Изменить data-fetching flow:**

> ⚠️ **ВНИМАНИЕ к зависимостям:** 
> `getOrFetchWeatherContext(dbContext.profile, ...)` ЗАВИСИТ от `dbContext`.
> Поэтому их НЕЛЬЗЯ паковать в один `Promise.all`.
> Но `fetchAdvancedMemoryContext` НЕ зависит от `dbContext` — его МОЖНО запускать параллельно.

**Текущий код (handleChat, строки ~1083-1090):**
```typescript
if (token) {
  const dbContext = await fetchUserContext(token, req.user.id);
  if (dbContext) {
    const leanContext = getLeanUserContext(dbContext);
    const timezone = dbContext.profile?.timezone || 'UTC';
    
    let weatherAlert = "";
    const weatherData = await getOrFetchWeatherContext(dbContext.profile, req.user.id);
```

**Новый код:**
```typescript
if (token) {
  // Parallel fetch: user context + memory context (independent)
  const [dbContext, [emotionalProfile, semanticMemories]] = await Promise.all([
    fetchUserContext(token, req.user.id),
    fetchAdvancedMemoryContext(req.user.id, body.message, token),
  ]);

  if (dbContext) {
    const leanContext = getLeanUserContext(dbContext);
    const timezone = dbContext.profile?.timezone || 'UTC';
    
    let weatherAlert = "";
    // weatherData depends on dbContext.profile — must stay sequential
    const weatherData = await getOrFetchWeatherContext(dbContext.profile, req.user.id);
```

**3.3 Использовать новые методы в builder:**

**Текущий код (handleChat, строки ~1153-1162):**
```typescript
const builder = new ChatPromptBuilder(chatMode === "diary" ? "diary" : "assistant")
  .withPersona(
    dbContext.profile.ai_name || 'Maya',
    userDateStr,
    userTimeStr
  )
  .withProfile(formatLeanProfile(dbContext.profile))
  .withDietaryRestrictions(formatDietaryRestrictions(dbContext.profile))
  .withHealthGoals(formatHealthGoals(dbContext.profile))
  .withGoalManagement();
```

**Новый код:**
```typescript
const builder = new ChatPromptBuilder(chatMode === "diary" ? "diary" : "assistant")
  .withPersona(
    dbContext.profile.ai_name || 'Maya',
    userDateStr,
    userTimeStr
  )
  .withEmotionalContext(emotionalProfile)   // <-- НОВОЕ (Layer 3)
  .withSemanticMemory(semanticMemories)     // <-- НОВОЕ (Layer 2)
  .withProfile(formatLeanProfile(dbContext.profile))
  .withDietaryRestrictions(formatDietaryRestrictions(dbContext.profile))
  .withHealthGoals(formatHealthGoals(dbContext.profile))
  .withGoalManagement();
```

**Разместить `.withEmotionalContext()` и `.withSemanticMemory()` ПОСЛЕ `.withPersona()`, но ДО `.withProfile()` — порядок вызовов влияет на читабельность кода, а priority (1) определяет порядок в финальном промпте.**

> 🔁 **ПОВТОРИ точно такие же изменения в `handleChatStream` (строки ~1355-1434).**

---

## 4. ОГРАНИЧЕНИЯ (СТРОГИЕ)

1. **НЕ устанавливай новые npm-пакеты.** Все зависимости уже есть: `@langchain/openai`, `@supabase/supabase-js`.
2. **НЕ модифицируй промпты** (текст в `withPersona()`, etc.) — только добавляй новые секции.
3. **НЕ трогай** файлы в `supabase/functions/` — Edge Functions уже задеплоены.
4. Все ошибки в `memory.service.ts` **ДОЛЖНЫ быть подавлены** (try-catch → null). Чат обязан работать даже если память недоступна.
5. **Promise.all** — `fetchUserContext` + `fetchAdvancedMemoryContext` (параллельно). `getOrFetchWeatherContext` — sequential (зависит от dbContext).

## 5. КРИТИЧЕСКАЯ ПРОВЕРКА ДЛЯ САМОКОНТРОЛЯ

Перед финализацией убедись:
- [ ] `import OpenAI from "openai"` **нигде не используется** (пакет не установлен!)
- [ ] `increment_access_count_raw` **нигде не вызывается** (RPC не существует!)
- [ ] `fetchAdvancedMemoryContext` запущен через `Promise.all` рядом с `fetchUserContext`
- [ ] `getOrFetchWeatherContext` остался **после** `dbContext` (sequential!)
- [ ] Изменения применены **и в `handleChat`, и в `handleChatStream`**
- [ ] `withEmotionalContext(null)` и `withSemanticMemory(null)` не ломают билдер

## 6. ОТЧЁТ

Запиши в `C:\project\kOSI\next_report.md`:
1. Изменённые файлы и статус.
2. Какой класс используется для embeddings (должен быть `OpenAIEmbeddings` из `@langchain/openai`).
3. Статус `Promise.all` (параллельность).
4. Перечень ошибок при разработке (если были).
5. Вердикт: `READY FOR DEPLOY` или `NEEDS FIXES`.
