# FINAL REPAIR: HEX-BASED NUTRIENT COLORS

Мы переходим на «тяжелую артиллерию». Tailwind-классы для точек (dots) почему-то не срабатывают динамически. Поэтому мы будем использовать инлайновые стили (HEX-коды). Это гарантированно сработает вне зависимости от настроек CSS.

## ТВОИ ЗАДАЧИ:

### 1. Исправь `apps/web/src/components/diary/FoodCard.tsx`

Обнови функцию `getMicroColorClass` (теперь она будет возвращать весь объект конфига) и используй `hex` в рендере:

```typescript
// 1. Обнови функцию, чтобы она возвращала объект цвета (nutrient-colors.ts теперь содержит поле .hex)
function getMicroColorConfig(type: string, name?: string) {
  let finalType = type;
  
  if (name && (type === 'micro' || type === 'marker' || !nutrientColors[type as keyof typeof nutrientColors])) {
    const n = name.toLowerCase();
    if (n.includes('желез') || n.includes('iron')) finalType = 'iron';
    else if (n.includes('кальц') || n.includes('calc')) finalType = 'calcium';
    else if (n.includes('магн') || n.includes('magne')) finalType = 'magnesium';
    else if (n.includes('омега') || n.includes('omega')) finalType = 'omega';
    else if (n.includes('витамин c') || n.includes('vitamin c') || n.includes('витамином c')) finalType = 'vitamin_c';
    else if (n.includes('витамин d') || n.includes('vitamin d') || n.includes('витамином d')) finalType = 'vitamin_d';
    else if (n.includes('витамин b') || n.includes('vitamin b') || n.includes('витамин в') || n.includes('фолат')) finalType = 'vitamin_b';
    else if (n.includes('зелень') || n.includes('овощ') || n.includes('greens')) finalType = 'greens';
    else if (n.includes('цинк') || n.includes('zinc')) finalType = 'default'; // fallback
  }

  return (nutrientColors as any)[finalType] || nutrientColors.default;
}
```

### 2. Обнови процесс рендеринга (линия 183+)
Используй `style={{ backgroundColor: color.hex }}` вместо динамического класса:

```tsx
// 2. Внутри micros.map замени блок с точкой:
{micros.map((micro, idx) => {
    const config = getMicroColorConfig(micro.type, micro.name);
    return (
        <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-surface-subtle border border-border rounded-full text-xs text-ink-muted">
            <div 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: config.hex }}
            ></div>
            <span className="font-medium">{micro.name} <span className="opacity-60">{micro.value}</span></span>
        </div>
    );
})}
```

**БОЛЬШЕ НИЧЕГО НЕ ТРОГАЙ.** Этот метод на 100% независим от Tailwind и гарантирует раскраску точек.

## ПРОВЕРКА:
1. Запиши "Сыр 100г".
2. Точка Кальция ДОЛЖНА стать желтой (#EAB308).

Использованные скиллы: surgical-bugfix, inline-style-guarantee, color-system-matching, senior-architect
