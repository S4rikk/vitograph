# TASK: Редизайн HealthGoalsWidget — разворачиваемая панель целей для мобильных экранов

## 1. REQUIRED SKILLS & ORDER

1. Read `C:\store\ag_skills\skills\frontend-developer\SKILL.md` — React component patterns, responsive design
2. Read `C:\store\ag_skills\skills\ui-ux-pro-max\SKILL.md` — mobile-first UI, micro-animations

## 2. КОНТЕКСТ

### Проблема (КРИТИЧЕСКАЯ UX)
**Файл:** `apps/web/src/components/shared/HealthGoalsWidget.tsx`

На мобильных экранах (~375px) цели здоровья отображаются как горизонтальные "pills" с `truncate max-w-[220px]`, и текст обрезается: *«Снизить жировую массу и улу…»* — пользователь **не видит** полный текст своих целей. Даже при развёрнутом состоянии (`isExpanded=true`) каждый pill всё ещё обрезан — просто показываются 2+ обрезанных pill вместо одного.

### Цель
Полностью переписать рендер-часть (JSX) компонента, сохранив всю бизнес-логику (state, effects, handlers). Новый дизайн — **единая разворачиваемая панель** в стиле карточки, где:
- В свёрнутом виде — компактная строчка-сводка
- В развёрнутом виде — полный список целей с переносом текста (без truncate!)

---

## 3. ДИЗАЙН-СПЕЦИФИКАЦИЯ

### Компоновка (Desktop + Mobile)

```
┌─────────────────────────────────────────────────┐
│ 🎯  Снизить жировую массу и улучшить общ...  ▼ │  ← Свёрнуто (1 строка)
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🎯  2 активные цели                         ▲ │  ← Развёрнуто (заголовок)
│─────────────────────────────────────────────────│
│ ✨ Снизить жировую массу и улучшить общую      │
│    физическую форму к лету                   ✕ │  ← Полный текст, X справа
│─────────────────────────────────────────────────│
│ ✨ Улучшить показатели крови (железо,           │
│    витамин D)                                ✕ │  ← Перенос текста!
└─────────────────────────────────────────────────┘
```

### Стилевые правила (выдержать общий стиль Vitograph)

| Элемент | Стиль |
|---------|-------|
| Обёртка панели | `rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 shadow-sm` |
| Заголовочная строка | `flex items-center gap-2.5 px-4 py-2.5 cursor-pointer` — кликабельна целиком |
| Иконка (Target) | `bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-xl w-8 h-8` (как сейчас) |
| Текст свёрнутого состояния | `text-sm font-semibold text-emerald-800 truncate flex-1` |
| Chevron | `ChevronDown` / `ChevronUp`, `w-4 h-4 text-emerald-500 transition-transform duration-300` — поворот через `rotate-180` |
| Разделитель целей | `border-t border-emerald-100/60` (тонкая линия между целями) |
| Строка цели | `flex items-start gap-2.5 px-4 py-3` |
| Текст цели | **`text-sm font-medium text-emerald-900 leading-relaxed flex-1` — БЕЗ truncate, текст переносится!** |
| Sparkles icon | `w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0` |
| Кнопка удаления (X) | `shrink-0 w-6 h-6 rounded-full hover:bg-emerald-100 text-emerald-400 hover:text-emerald-700 transition-colors` |

---

## 4. КОД

### Полная перезапись return-блока (строки 120–173)

Бизнес-логика НЕ МЕНЯЕТСЯ. Переменные `displayedGoals`, `hasMore`, `goals`, `isExpanded`, `setIsExpanded`, `isDeleting`, `handleRemoveGoal` — все остаются.

**Удали строку 117:**
```tsx
const displayedGoals = isExpanded ? goals : goals.slice(0, 1);
```
Она больше не нужна — в новом дизайне мы показываем все цели или ни одной (кроме заголовка).

**Новый return-блок:**

```tsx
return (
  <div className="mx-3 sm:mx-6 mt-2 mb-1 animate-in fade-in slide-in-from-top-1 duration-500">
    <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 shadow-sm overflow-hidden transition-all duration-300">
      {/* ── Clickable Header ──────────────────────────── */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-emerald-50/50 transition-colors group"
      >
        {/* Icon */}
        <div className="flex shrink-0 items-center justify-center bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-xl w-8 h-8 shadow-sm transition-transform group-hover:scale-105">
          <Target className="w-4 h-4" />
        </div>

        {/* Title text */}
        <div className="flex-1 text-left min-w-0">
          {isExpanded ? (
            <span className="text-sm font-semibold text-emerald-800">
              {goals.length} {goals.length === 1 ? 'активная цель' : goals.length < 5 ? 'активные цели' : 'активных целей'}
            </span>
          ) : (
            <span className="text-sm font-semibold text-emerald-800 block truncate">
              {goals.length === 1 ? goals[0].title : `${goals.length} цели · ${goals[0].title}`}
            </span>
          )}
        </div>

        {/* Chevron with rotation animation */}
        <ChevronDown className={`w-4 h-4 text-emerald-500 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Expandable Goal List ──────────────────────── */}
      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
        <div className="border-t border-emerald-100/60">
          {goals.map((g, index) => (
            <div
              key={g.id}
              className={`flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-emerald-50/40 ${
                index < goals.length - 1 ? 'border-b border-emerald-100/40' : ''
              } animate-in fade-in slide-in-from-top-1`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span className="flex-1 text-sm font-medium text-emerald-900 leading-relaxed">
                {g.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveGoal(g.id);
                }}
                disabled={isDeleting === g.id}
                className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-emerald-400 hover:bg-emerald-100 hover:text-emerald-700 transition-all disabled:opacity-30"
                title="Завершить цель"
              >
                {isDeleting === g.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
```

---

## 5. КЛЮЧЕВЫЕ ПРИНЦИПЫ (НЕ НАРУШАТЬ!)

1. **`truncate` ЗАПРЕЩЁН в развёрнутом виде.** Текст цели ОБЯЗАН переноситься (`leading-relaxed`, no `truncate`, no `max-w-*`, no `whitespace-nowrap`).
2. **По умолчанию `isExpanded` = `false`** — как сейчас (строка 14). Не меняй.
3. **`hasMore` переменная больше не нужна** — удали её (строка 118). Панель работает одинаково для 1+ целей.
4. **Animations:**
   - Раскрытие через `max-h-0 → max-h-[500px]` + `opacity-0 → opacity-100` 
   - `transition-all duration-300 ease-in-out`
   - Каждая строка цели с `animationDelay` для cascade-эффекта
5. **`ChevronDown` c `rotate-180`** вместо свитча `ChevronDown/ChevronUp` — меньше кода, плавнее анимация.

---

## 6. УДАЛИТЬ НЕИСПОЛЬЗУЕМЫЙ IMPORT

Из строки 4 **убери `ChevronUp`** (он больше не нужен):

**Было:**
```tsx
import { Target, X, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
```

**Стало:**
```tsx
import { Target, X, Loader2, Sparkles, ChevronDown } from "lucide-react";
```

---

## 7. ОГРАНИЧЕНИЯ (СТРОГИЕ)

1. **НЕ меняй** бизнес-логику: `loadData`, `handleRemoveGoal`, `useEffect`, Supabase-запросы — всё остаётся нетронутым.
2. **НЕ меняй** скелетон (строки 88–94) и empty state (строки 97–114).
3. **НЕ добавляй** новые npm-пакеты.
4. **НЕ трогай** `AiAssistantView.tsx` — компонент `<HealthGoalsWidget />` используется без изменения API.
5. Правки ТОЛЬКО в файле `HealthGoalsWidget.tsx`.

---

## 8. САМОПРОВЕРКА

Перед финализацией убедись:
- [ ] Текст цели переносится на мобиле (нет `truncate` в развёрнутом состоянии)
- [ ] Свёрнутое состояние — одна компактная строка с `truncate` (это ОК для сводки)
- [ ] `ChevronUp` удалён из импортов
- [ ] `displayedGoals` и `hasMore` удалены
- [ ] Анимация раскрытия работает плавно (max-h transition)
- [ ] Кнопка X по-прежнему работает (не забыть `e.stopPropagation()`)
- [ ] Empty state и loading skeleton не тронуты

---

## 9. ОТЧЁТ

Запиши в `C:\project\kOSI\next_report.md`:
1. Что было изменено (перечень строк/блоков).
2. Подтверди, что текст целей виден полностью при развёрнутом состоянии.
3. Вердикт: `DONE` или `NEEDS FIXES`.
