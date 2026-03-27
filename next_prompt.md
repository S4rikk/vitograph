# TASK: LangGraph State Sanitizer — Защита от коррумпированного tool_calls state

## ПРИОРИТЕТ: 🔴 КРИТИЧЕСКИЙ (Hotfix)

---

## ⚡ МОДЕЛЬНАЯ ПОЛИТИКА (ОБЯЗАТЕЛЬНО)
Для режима **Assistant** и анализа **Lab Reports** мы используем **СТРОГО И ТОЛЬКО** модель `gemini-3.1-pro-preview-thinking` через наш кастомный роутер `api.ourzhishi.top`. 

- Не подменяй её на `gpt-4o` или другие, даже если кажется, что схема не проходит. 
- Если модель `gemini-3.1-pro-preview-thinking` выдает ошибки структуры — мы чиним парсинг или схему, а не меняем модель.
- В `builder.ts` уже настроен fallback на `gpt-4o-mini`, это допустимо только как временное решение при полном падении роутера.

---

## Контекст проблемы

27 марта 2026 в 10:42 произошёл каскадный сбой:
1. Роутер `ourzhishi.top` (Gemini proxy) начал таймаутить
2. LangGraph записал в `MemorySaver` незавершённый state — AI-сообщение с `tool_calls`, но без ответа `tool`
3. Каждый следующий запрос пользователя получал этот коррумпированный state → OpenAI возвращал `400 INVALID_TOOL_RESULTS`
4. Fallback на `gpt-4o-mini` тоже падал (тот же state)
5. Next.js proxy таймаутился → **PM2 рестартил Next.js 414 раз** → каждый рестарт = полная перезагрузка = новый batch запросов

Результат: 100+ бесконтрольных вызовов LLM, ~22 ошибки `INVALID_TOOL_RESULTS`, полная деградация сервиса.

**Required Skills (читай ПЕРЕД кодингом, строго в этом порядке):**
1. `langgraph` — Read `C:\store\ag_skills\skills\langgraph\SKILL.md`
2. `ai-engineer` — Read `C:\store\ag_skills\skills\ai-engineer\SKILL.md`
3. `systematic-debugging` — Read `C:\store\ag_skills\skills\systematic-debugging\SKILL.md`
4. `nodejs-backend-patterns` — Read `C:\store\ag_skills\skills\nodejs-backend-patterns\SKILL.md`

---

## Architecture Context

### Файлы для модификации:
| Файл | Действие |
|------|----------|
| `apps/api/src/ai/src/graph/builder.ts` | **MODIFY** — Добавить sanitizer в `callModel()` |
| `apps/api/src/ai/src/graph/state.ts` | **READ ONLY** — Изучить структуру `GraphAnnotation` |
| `apps/api/src/ai/src/graph/checkpointer.ts` | **READ ONLY** — Понять как работает `MemorySaver` |

### Текущая архитектура (builder.ts):
```
callModel(state, config)
  ├─ Выбор модели: diary → diaryModel (gpt-4o), assistant → primaryModel (gemini) с fallback на backupModel (gpt-4o-mini)
  ├─ Обрезка messages: оставить 1 SystemMessage + последние 12 convoMessages
  ├─ [необязательно] Вставка nutritionalContext как SystemMessage
  └─ modelToUse.invoke(finalMessages) → return { messages: [response] }
```

### Цикл графа:
```
__start__ → agent (callModel) → shouldContinue 
  ├─ tool_calls? → tools (ToolNode) → agent (callModel)
  └─ no tools? → END
```

---

## Implementation Steps

### Шаг 1: Добавить функцию `sanitizeMessages()` в `builder.ts`

Вставь **перед** функцией `callModel` новую функцию:

```typescript
/**
 * Sanitizes the message history to prevent INVALID_TOOL_RESULTS errors.
 * 
 * Problem: If a previous request crashed mid-tool-call (timeout, network error),
 * the MemorySaver may contain an AI message with `tool_calls` but no corresponding
 * `tool` response. Sending this to OpenAI/Gemini causes a 400 error:
 * "messages with role 'tool' must be a response to a preceding message with 'tool_calls'"
 * 
 * Solution: Detect orphaned tool_calls (AI messages with tool_calls that are NOT 
 * followed by matching tool responses) and remove the tool_calls from those messages.
 */
function sanitizeMessages(messages: BaseMessage[]): BaseMessage[] {
  const result: BaseMessage[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgType = msg._getType?.() || '';
    
    // Check if this is an AI message with tool_calls
    if (msgType === 'ai' && 'tool_calls' in msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      // Look ahead: the next message(s) should be tool responses
      const expectedToolCallIds = new Set(msg.tool_calls.map((tc: any) => tc.id));
      let allToolCallsAnswered = true;
      
      // Check subsequent messages for matching tool responses
      const foundIds = new Set<string>();
      for (let j = i + 1; j < messages.length; j++) {
        const nextMsg = messages[j];
        const nextType = nextMsg._getType?.() || '';
        if (nextType === 'tool' && 'tool_call_id' in nextMsg) {
          foundIds.add((nextMsg as any).tool_call_id);
        } else {
          break; // Stop looking when we hit a non-tool message
        }
      }
      
      // If not all tool_calls have responses, this message is corrupted
      for (const id of expectedToolCallIds) {
        if (!foundIds.has(id)) {
          allToolCallsAnswered = false;
          break;
        }
      }
      
      if (!allToolCallsAnswered) {
        // Strip tool_calls from this message — convert to plain AI message
        console.warn(`[Sanitizer] ⚠️ Removing orphaned tool_calls from AI message (${msg.tool_calls.length} calls without responses)`);
        const { AIMessage } = require('@langchain/core/messages');
        const cleanContent = typeof msg.content === 'string' && msg.content.trim() 
          ? msg.content 
          : 'Извините, предыдущий запрос был прерван. Пожалуйста, повторите.';
        result.push(new AIMessage(cleanContent));
        continue;
      }
    }
    
    // Check if this is an orphaned tool response (tool message without preceding tool_calls)
    if (msgType === 'tool') {
      const prevMsg = result[result.length - 1];
      const prevType = prevMsg?._getType?.() || '';
      
      // If the previous message in result is not an AI with tool_calls, skip this tool message
      if (prevType !== 'ai' || !('tool_calls' in prevMsg) || !Array.isArray(prevMsg.tool_calls) || prevMsg.tool_calls.length === 0) {
        // Check if any prior AI message in result has matching tool_calls
        let hasParent = false;
        for (let k = result.length - 1; k >= 0; k--) {
          const candidate = result[k];
          if (candidate._getType?.() === 'ai' && 'tool_calls' in candidate) {
            hasParent = true;
            break;
          }
          if (candidate._getType?.() !== 'tool') break;
        }
        if (!hasParent) {
          console.warn(`[Sanitizer] ⚠️ Removing orphaned tool response (no parent tool_calls)`);
          continue;
        }
      }
    }
    
    result.push(msg);
  }
  
  return result;
}
```

### Шаг 2: Вызвать sanitizer внутри `callModel()`

В функции `callModel`, **после** формирования `convoMessages` (строка ~36) и **перед** формированием `finalMessages` (строка ~54), добавь вызов:

```typescript
  // Sanitize: remove orphaned tool_calls that crash OpenAI/Gemini
  convoMessages = sanitizeMessages(convoMessages);
```

Точное место в коде — **после** блока:
```typescript
  if (convoMessages.length > 12) {
    convoMessages = convoMessages.slice(convoMessages.length - 12);
  }
```

И **перед** блоком `// Phase 54: Nutritional Context scaling preservation`.

### Шаг 3: Добавить import для `BaseMessage`

В начале файла `builder.ts` уже импортируется `GraphAnnotation`, нужно добавить:

```typescript
import { BaseMessage } from "@langchain/core/messages";
```

### Шаг 4: Добавить защиту от таймаута в `callModel`

Оберни вызов `modelToUse.invoke(finalMessages)` в try/catch с логированием:

```typescript
  let response;
  try {
    response = await modelToUse.invoke(finalMessages);
  } catch (error: any) {
    console.error(`[AGENT] ❌ Model invocation failed: ${error.message}`);
    // If the error is INVALID_TOOL_RESULTS, the sanitizer missed something — 
    // last resort: strip ALL tool-related messages and retry once
    if (error.message?.includes('INVALID_TOOL_RESULTS') || error.message?.includes("role 'tool'")) {
      console.warn(`[AGENT] 🔄 Retrying with fully cleaned messages (no tool history)`);
      const cleanMessages = finalMessages.filter(m => {
        const type = m._getType?.() || '';
        return type !== 'tool';
      }).map(m => {
        if (m._getType?.() === 'ai' && 'tool_calls' in m && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
          const { AIMessage } = require('@langchain/core/messages');
          return new AIMessage(typeof m.content === 'string' ? m.content : 'Предыдущий запрос был прерван.');
        }
        return m;
      });
      response = await modelToUse.invoke(cleanMessages);
    } else {
      throw error; // Re-throw non-tool errors
    }
  }
```

Замени строку `const response = await modelToUse.invoke(finalMessages);` на этот блок.

---

## Constraints (ОБЯЗАТЕЛЬНО)

1. **НЕ ТРОГАЙ** модели (`primaryModel`, `diaryModel`, `backupModel`) — их конфигурация корректна.
2. **НЕ ТРОГАЙ** `checkpointer.ts` и `state.ts` — их менять не нужно.
3. **НЕ ТРОГАЙ** `shouldContinue()` и структуру графа — она работает правильно.
4. **НЕ УДАЛЯЙ** существующую логику debug-логирования (writeFileSync) — она нужна для отладки.
5. `sanitizeMessages()` должна быть **чистой функцией** без side-effects (кроме console.warn для логирования).
6. Используй **динамический import** для `AIMessage` (`require(...)`) чтобы не ломать существующий import-граф.

## Verification

После внесения изменений:
1. Убедись, что `npm run build` (или `tsc --noEmit`) в `apps/api/src/ai` проходит без ошибок.
2. Проверь, что `sanitizeMessages([])` возвращает `[]` (пустой массив).
3. Значение скиллов: функция должна корректно обрабатывать кейсы:
   - AI message с tool_calls + последующие tool response → **оставить как есть**
   - AI message с tool_calls **без** tool response → **заменить на plain AIMessage**
   - Orphaned tool response без предшествующего AI + tool_calls → **удалить**

## Report

После завершения работы — напиши отчёт в `C:\project\VITOGRAPH\next_report.md`:
- Какие файлы изменены, какие строки
- Результат `tsc --noEmit`
- Любые вопросы или сомнения
