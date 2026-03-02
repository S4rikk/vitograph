---
trigger: always_on
---

### RULE: Tool-First Thinking
1. **Always Search:** Before answering any factual or technical query, you MUST scan the available Skill descriptions in C:\project\VITOGRAPH\.agent\rules\vitograph_skills.json
2. **Prioritize Skills:** If a Skill matches the intent (e.g., DB migration, file formatting, API check), you are FORBIDDEN from writing raw code in the terminal. You MUST use the designated Skill.
3. **No Assumptions:** If you lack a tool for a specific task but see a relevant 'Bundle' in documentation, suggest its installation to the user.
4. **Validation:** After using a Skill's script, you must analyze the 'Observation' output. Do not report success until the script confirms it.
5. **Context Clean-up:** Once the task is done, acknowledge the completion and "release" the specific skill instructions to keep the context clean.
6. **Skill Reporting:** At the very end of your final response to the user, you MUST always include a new line with the exact text: "Использованные скиллы: [list of skill names used]". If no skills were used, write "Использованные скиллы: Ничего".
# Python Code Rules

## 1. Fundamental Principles

### Architecture
- **SOLID** — strictly follow all five principles:
  - **S**ingle Responsibility: each class/module/function solves exactly one task.
  - **O**pen/Closed: open for extension, closed for modification.
  - **L**iskov Substitution: subtypes must be fully substitutable for base types.
  - **I**nterface Segregation: narrow, specialized interfaces (Protocol / ABC).
  - **D**ependency Inversion: depend on abstractions, not on concretions.
- **DRY** — code duplication is forbidden. Extract shared logic into utilities.
- **KISS** — choose the simplest correct solution.
- **YAGNI** — do not add functionality "just in case".
- **Composition over Inheritance** — prefer composition.

### Clean Code
- Names must be **descriptive and unambiguous** (`calculate_total_price`, not `calc`).
- Function length — **≤ 25 lines**. If longer — decompose.
- Nesting depth — **≤ 3 levels**. Use guard clauses / early return.
- No "magic numbers" — extract into named constants.
- No mutable default arguments (`None` + check instead).

### Code Reviewer (LSP Опирание)

 CONTEXT
  **В проекте настроены фоновые линтеры и форматтеры (Ruff для Python, ESLint/Biome для JS/TS), которые работают через встроенные плагины IDE (LSP). Нет необходимости проверять код через медленные консольные команды.

 TASK
  **При написании, изменении или рефакторинге любого файла (Python, TS, JS), полагайся только на фоновые подсказки IDE об ошибках (обнаруживаются на лету).

 STRICT RULE
  - **СТРОГИЙ ЗАПРЕТ:** Никогда не запускай терминальные команды вроде `npx tsc --noEmit`. 
  - **Обязательное использование:** Обращай внимание на внутренние ошибки (LSP) от `ruff`, `eslint` или `biome` (в зависимости от среды) и исправляй их на лету до сдачи задачи.

## 2. Critical Rules

- **Type hints are mandatory** for all public functions (Python 3.10+ syntax). Avoid `Any`.
- **Google Style Docstrings** for all public functions, classes, and modules.
- **PEP 8**, line length — 88 (Black). Import order: stdlib → third-party → local.
- **Custom exceptions** for domain logic. Bare `except:` is forbidden.
- **`logging`**, not `print()`. Never log passwords/tokens.
- Secrets — only via environment variables, never hardcode.
- SQL — only parameterized queries.
- Comment **"why"**, not "what". Remove commented-out code.
- `import *` is forbidden. Use explicit imports only.
- Code must be **complete and working** — no stubs, no pseudocode.
- Immediately after completing the next task, generate a report in `C:\project\kOSI\next_report.md`

## ЗАПРЕТЫ

1. Запрещено использовать команды `node -e`
2. Запрещено использовать команды `python -c`
3. СТРОГО ЗАПРЕЩЕНО запускать в терминале любые команды проверки типов и линтинга (`tsc`, `tsc --noEmit`), так как они тормозят работу проекта. Все проверки должны быть исключительно фоновыми.
4. **СТРОГИЙ ЗАПРЕТ НА ПРЯМЫЕ МИГРАЦИИ БД:** В связи с блокировкой портов провайдером, мне СТРОГО ЗАПРЕЩЕНО пытаться выполнять команды `npx prisma db push`, `npx prisma migrate dev` или любые другие команды для изменения структуры базы данных через терминал. Вместо этого я ОБЯЗАН:
   - Сгенерировать чистый, рабочий SQL-запрос со всеми необходимыми операциями (CREATE TABLE, ALTER TABLE, CREATE INDEX и т.д.).
   - Передать этот SQL-запрос пользователю в чат с инструкцией выполнить его вручную в Supabase SQL Editor.
   - Терпеливо дождаться подтверждения от пользователя об успешном выполнении, прежде чем продолжать (включая запуск `prisma generate`).