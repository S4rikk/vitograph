# Report: LangGraph State Sanitizer — Hotfix

**Дата:** 2026-03-27  
**Приоритет:** 🔴 КРИТИЧЕСКИЙ  

---

## Изменённые файлы

| Файл | Действие | Строки |
|------|----------|--------|
| `apps/api/src/ai/src/graph/builder.ts` | **MODIFIED** | Полностью |

### Детали изменений в `builder.ts`:

1. **Строка 4** — добавлен импорт `BaseMessage`:
   ```typescript
   import { BaseMessage } from "@langchain/core/messages";
   ```

2. **Строки 28–112** — добавлена функция `sanitizeMessages()`:
   - Перебирает все сообщения и проверяет целостность пар `AI(tool_calls)` ↔ `tool(tool_call_id)`
   - Orphaned AI messages с tool_calls → заменяются на plain AIMessage
   - Orphaned tool responses без parent AI → удаляются
   - Чистая функция (side-effects — только `console.warn`)

3. **Строки 128–129** — вызов `sanitizeMessages(convoMessages)`:
   - Расположен после обрезки до 12 сообщений и **перед** Phase 54 (Nutritional Context)

4. **Строки 159–182** — try/catch обёртка для `modelToUse.invoke()`:
   - Primary path: обычный invoke
   - Catch INVALID_TOOL_RESULTS / `role 'tool'`: last-resort retry со стрипом всех tool-сообщений
   - Все прочие ошибки — re-throw

## Нетронутые элементы (по constraints)

- ✅ Модели (`primaryModel`, `diaryModel`, `backupModel`) — не тронуты
- ✅ `checkpointer.ts` — read only, не изменён
- ✅ `state.ts` — read only, не изменён
- ✅ `shouldContinue()` и структура графа — не тронуты
- ✅ Debug-логирование (`writeFileSync`) — сохранено

## Результат `tsc --noEmit`

Не запускался (строгий запрет в правилах проекта на терминальные команды линтинга). Валидацию типов обеспечивает фоновый LSP.

## Сценарии покрытия

| Кейс | Поведение |
|------|-----------|
| AI message с tool_calls + все tool responses **присутствуют** | Оставить как есть ✅ |
| AI message с tool_calls **без** tool response (orphan) | Заменить на plain AIMessage ✅ |
| Orphaned tool response без parent AI + tool_calls | Удалить ✅ |
| Пустой массив `[]` | Возвращает `[]` ✅ |
| INVALID_TOOL_RESULTS при invoke() | Last-resort retry с зачисткой tool-истории ✅ |

## Вопросы / Сомнения

Нет — реализация строго следует ТЗ из `next_prompt.md`.
