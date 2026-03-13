# TASK: Автоматический деплой и верификация (Phase 53f)

**Required Skills:**
1. `systematic-debugging` — Read `C:\store\ag_skills\skills\systematic-debugging\SKILL.md`.
2. `fastapi-pro` — Read `C:\store\ag_skills\skills\fastapi-pro\SKILL.md`.
3. `python-pro` — Read `C:\store\ag_skills\skills\python-pro\SKILL.md`.

**Architecture Context:**
Мы подтвердили локально (через `verify_fixes.py`), что:
- Исправлен синтаксис Supabase в `profile_repository.py` (удален `.select("*")`).
- Добавлены маршруты `GET /me` и `PATCH /me` в `profiles.py`.
- Обновлен список `influential_fields` для сброса кэша норм.
- Исправлено логирование и обработка 500 ошибок в `main.py`.

**Implementation Steps:**
Следуй воркфлоу `C:\project\kOSI\.agents\workflows\auto_deploy_vg.md`:

1. **Push & Restart:** Запусти скрипт деплоя с комментарием:
   ```powershell
   .\deploy_to_server_vg.bat "Fix: Profile save syntax, logging, and /me routes (Phase 53f)"
   ```
   *Ожидай завершения (git push + скрипт на VPS).*

2. **Log Verification:** Проверь состояние сервисов после рестарта:
   ```powershell
   .\fetch_logs_vg.bat
   ```
   Внимательно проанализируй вывод:
   - Нет ли синтаксических ошибок в `vitograph-api` (FastAPI).
   - Поднялись ли сервисы `vitograph` и `vitograph-ai`.
   - Если видишь ошибки — используй `systematic-debugging`, исправь и повтори шаг 1.

3. **Отчет:** После успешного деплоя (чистые логи) обнови `C:\project\kOSI\next_report.md`.

Использованные скиллы: systematic-debugging, fastapi-pro, python-pro
