# 📝 Техническое задание: Избавление от "портянок" микронутриентов в чате

Привет! Очередная мелкая проблема: ИИ слишком старается и каждый раз, когда его спрашивают о потребленных калориях (или итогах дня), выводит пользователю гигантский список всех витаминов и минералов (Цинк, Калий, Железо и т.д.) в виде плашек. На мобильной версии это занимает целый экран и очень мешает.
Алгоритм парсинга работает так, что он делает из этого десятки серых/бирюзовых pills.

Надо жестко запретить ассистенту перечислять список выданных ему микронутриентов!

**ИСПОЛЬЗУЕМЫЕ СКИЛЛЫ ДЛЯ ЭТОЙ ЗАДАЧИ:** prompt-engineering-patterns.

### Шаг 1: Блокирующий промпт
Открой pps/api/src/ai/src/ai.controller.ts.
Найди генерацию системного промпта (let systemPrompt = ...), секцию ### CONVERSATIONAL RULES (в районе 1081 строки).
Добавь туда новое ПРАВИЛО (CRITICAL):

`	ext
- MICRONUTRIENT SPAM RULE (CRITICAL): NEVER output a massive list of micronutrient numbers to the user! It wastes screen space on mobile devices. If the user asks about calories, meals, or daily stats, ONLY discuss Macros (Calories, Protein, Fat, Carbs). You may only mention 1 or 2 specific micronutrients IF they are critically deficient today. NEVER list all micronutrients like "Цинк: 1.8мг, Калий: 780мг, Железо: 2.2мг...".
`

### Шаг 2: Ревью и коммит
Убедись, что правило добавлено именно в основной блок CONVERSATIONAL RULES, чтобы оно срабатывало во всех режимах чата. Фронтенд-часть (AiAssistantView.tsx) трогать НЕ нужно, механизм парсинга плашек пусть живет, нам просто нужно отучить ИИ спамить исходными данными.
Сделай локальный коммит. Деплой не нужен.
