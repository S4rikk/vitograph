# 📝 Хотфикс: Empty-state подсказка в HealthGoalsWidget

**ИСПОЛЬЗУЕМЫЕ СКИЛЛЫ:** `frontend-developer`, `react-ui-patterns`

**Файл:** `apps/web/src/components/shared/HealthGoalsWidget.tsx`

---

### Проблема
Когда у пользователя нет активных целей, компонент полностью скрывается (строка 96):
```tsx
if (goals.length === 0) return <div className="hidden" />;
```
Пользователь не понимает, что функция постановки целей вообще существует.

### Задача
Заменить строку 96 на красивый **empty-state** — ненавязчивую плашку-подсказку в том же стиле, что и активные цели.

### Точное изменение (только одна строка!)

**Было:**
```tsx
if (goals.length === 0) return <div className="hidden" />;
```

**Стало:**
```tsx
if (goals.length === 0) {
  return (
    <div className="flex items-center gap-2 px-3 sm:px-6 pt-2 pb-2">
      <div className="flex shrink-0 items-center justify-center bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-400 rounded-xl w-8 h-8">
        <Target className="w-4 h-4" />
      </div>
      <p className="text-xs text-slate-400 italic">
        Попросите ассистента установить цель — например, «Хочу похудеть на 5 кг»
      </p>
    </div>
  );
}
```

### Визуальные требования
- Иконка цели (Target) — серая, приглушенная (не зелёная), чтобы не отвлекать внимание.
- Текст — мелкий (`text-xs`), `italic`, `text-slate-400` — ненавязчиво, как хинт.
- Общий стиль — повторяет отступы активного состояния.

### После
Сделай локальный коммит. Деплой не нужен.
