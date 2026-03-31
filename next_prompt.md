# 📱 Техническое задание: Редизайн UI-плашек микронутриентов (Компактность)

**ИСПОЛЬЗУЕМЫЕ СКИЛЛЫ:** `frontend-developer`, `ui-ux-pro-max`, `react-ui-patterns`

### Контекст
Блок «МИКРОНУТРИЕНТЫ» внутри добавленного продукта (`FoodCard.tsx`) занимает слишком много места по высоте, а сами плашки (pills) выглядят «дутыми» (слишком много пустого воздуха по бокам и внутри).
**Строгое правило:** Мы НЕ трогаем логику рендера (маппинг массива, функции вызова), меняем ТОЛЬКО классы Tailwind, отвечающие за размер, отступы (padding/margin) и шрифт.

---

### Шаги выполнения
**Файл:** `apps/web/src/components/diary/FoodCard.tsx`

Найди блок рендера `{/* Micros */}`.

#### 1. Ужимаем верхнюю часть и заголовок
Сейчас там:
```tsx
<div className="mb-3 pt-3 border-t border-border/50">
  <div className="text-[10px] text-ink-faint uppercase font-bold tracking-wider mb-2">Микронутриенты</div>
```
Замени отступы на более тесные:
```tsx
<div className="mb-2 pt-2 border-t border-border/50">
  <div className="text-[9px] text-ink-faint uppercase font-bold tracking-wider mb-1">Микронутриенты</div>
```

#### 2. Раздвигаем (сужаем) границы самих плашек
Сейчас обертка плашек имеет `gap-1.5`, а сама плашка: `gap-1.5 px-2 py-1 text-xs`.
Это даёт огромные "уши" по бокам и делает плашки высокими.

**Новый дизайн-код обертки и плашки:**
- Зазор между плашками: `gap-1` (вместо 1.5).
- Внутренние отступы плашки: `px-1.5 py-0.5` (убираем лишний воздух по бокам и сверху/снизу).
- Внутренний зазор между кружочком и текстом: `gap-1` (вместо 1.5).
- Размер шрифта: `text-[11px] leading-tight` (чуть меньше стандартного `text-xs`, чтобы больше влезало).

Итоговый JSX-код внутри массива должен выглядеть так (замени только классы у `div`):
```tsx
<div className="flex flex-wrap gap-1">
    {micros.map((micro, idx) => {
        const colorSpace = getMicronutrientColor(micro.name);
        return (
            <div key={idx} className="flex items-center gap-1 px-1.5 py-0.5 bg-surface-subtle border border-border/60 rounded-full text-[11px] leading-tight">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorSpace.dot}`}></div>
                <span className={colorSpace.text}>{micro.name} <span className="opacity-60 ml-0.5">{micro.value}</span></span>
            </div>
        );
    })}
</div>
```
*(Также добавлено `shrink-0` к кружочку, чтобы его не сплющивало в редких случаях длинного текста, и `ml-0.5` между названием и значением).*

---

Деплой пока не нужен. Заверши задачу.
