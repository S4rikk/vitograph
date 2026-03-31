# 🔧 Техническое задание: Корректировка UI плашек в чате (удаление точки)

**ИСПОЛЬЗУЕМЫЕ СКИЛЛЫ:** `react-components`, `tailwind-styling`

### Проблема:
В режиме ассистента в компоненте `NutrPill` (цветные плашки для выделения понятий типа "ужин", "перекус") отображается дополнительная цветная точка-маркер. Пользователь просит её аккуратно убрать, оставив только цветной текст внутри плашечного контейнера.

### Файл для редактирования: 
`apps/web/src/components/assistant/AiAssistantView.tsx`

### Что нужно сделать:
1. Найди компонент `NutrPill` (примерно строка 58).
2. Вырежи из него `<span>`, который отвечает за точку (`<span className={w-1.5 h-1.5 rounded-full...`).
3. Для чистоты DOM-дерева, перенеси класс цвета текста (`colorSpace.text`) на основной контейнер `span`, удалив внутреннюю обертку `span`.

**Код ДО:**
```tsx
const NutrPill = ({ type, children }: { type: string; children: React.ReactNode }) => {
  const content = String(children);
  const colorSpace = getMicronutrientColor(content);
  
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[13px] font-semibold border bg-slate-50 border-slate-200 mx-0.5 my-0 transition-all hover:scale-105 cursor-default shadow-sm`}>
       <span className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${colorSpace.dot}`}></span>
       <span className={colorSpace.text}>{children}</span>
    </span>
  );
};
```

**Код ПОСЛЕ:**
```tsx
const NutrPill = ({ type, children }: { type: string; children: React.ReactNode }) => {
  const content = String(children);
  const colorSpace = getMicronutrientColor(content);
  
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[13px] font-semibold border bg-slate-50 border-slate-200 mx-0.5 my-0 transition-all hover:scale-105 cursor-default shadow-sm ${colorSpace.text}`}>
       {children}
    </span>
  );
};
```

Готово. Сохрани файл. Деплой не требуется.
