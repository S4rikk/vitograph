# TASK: Смягчение стилистики общения AI-ассистента (Эмпатия и Юмор)

**Required Skills:**
- Read `C:\store\ag_skills\skills\prompt-engineering-patterns\SKILL.md` before coding.
- Read `C:\store\ag_skills\skills\ai-engineer\SKILL.md` before coding.

**Architecture Context:**
Пользователи жалуются на слишком сухой и "книжный" стиль ответов ИИ. Это произошло из-за жесткого ограничения на использование воодушевляющих и эмоциональных фраз в системном промпте. Нужно вернуть ассистенту "человеческое" лицо, разрешив эмпатию, уместный юмор и более непринужденный стиль (как у Gemini). 
*Обрати внимание: мы пока НЕ меняем правило про Markdown, меняем только тональность.*

**Implementation Steps:**
1. Открой файл `apps/api/src/ai/src/ai.controller.ts`.
2. Найди блок `### CORE PERSONA` внутри формирования переменной `systemPrompt` (около строк 1017-1025).
3. Найди и строго УДАЛИ строку:
   `- IMPORTANT: Avoid starting sentences with generic fillers like "Круто!" or "Отлично!". Communicate like a real person.`
4. ЗАМЕНИ её на новые инструкции, разрешающие эмоции и поддержку:
   ```text
   - TONE & EMPATHY: Be warm, enthusiastic, and genuinely human (similar to Gemini's default persona). You are highly encouraged to show empathy, use appropriate humor, and maintain a relaxed, engaging conversational style.
   - ENCOURAGEMENT: Feel free to use encouraging interjections like "Отлично!", "Круто!", "Здорово!" when celebrating the user's healthy choices, logged meals, or progress. 
   ```
5. Никакие другие правила (например, `APP BOUNDARIES` или `FORBIDDEN FORMATTING`) трогать не нужно.
6. Убедись, что нет синтаксических ошибок компиляции TypeScript, и заверши задачу, написав отчет в `C:\project\kOSI\next_report.md`.
