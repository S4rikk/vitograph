# 🎨 Техническое задание: Интеграция нового векторного логотипа

**ИСПОЛЬЗУЕМЫЕ СКИЛЛЫ ДЛЯ ЭТОЙ ЗАДАЧИ:** `frontend-developer`, `ui-ux-pro-max`, `react-ui-patterns`.

Студия (дизайнер) подготовила новый символ для нашего проекта — пропеллер из рыбок с зашифрованной макро-информацией внутри (пасхалкой). Пользователь хочет интегрировать этот символ в существующий текстовый логотип "VITOGRAPH" везде на фронтенде.

### Шаг 1: Создание переиспользуемого компонента `Logo`
1. Создай новый файл `apps/web/src/components/ui/Logo.tsx`
2. Перенеси в него SVG-код символа (смотри ниже) и текстовую часть. 
3. Компонент должен поддерживать пропсы для размера (напр. `size?: 'sm' | 'lg'`) и отображения подзаголовка (`showSubtitle?: boolean`).
4. **Визуальная структура:**
   - **Слева:** Наш новый SVG символ (размер `w-8 h-8` для `sm` и `w-12 h-12` для `lg`). Перекрашивать SVG не нужно (сохрани его градиенты `url(#grad1)` и цвета `stroke`), только задай размер.
   - **Справа:** Текст `VITO` (класс текста `text-ink`) и `GRAPH` (класс `text-primary-600`).
   - Иконка и текст должны быть отцентрированы по вертикали (`flex items-center gap-2`).
   - **Снизу:** Если передан `showSubtitle={true}`, под текстом VITOGRAPH должен быть отцентрированный подзаголовок "Feed your cells, find balance" (`text-ink-muted`).

### Шаг 2: Внедрение в `ClientPage.tsx`
Замени хардкодный `<header>` (строки ~69-78) на вызов нового компонента `<Logo size="lg" showSubtitle={true} />`. Убедись, что всё отцентрировано и отступы `mb-8` сохранены.

### Шаг 3: Внедрение в `layout.tsx` (Глобальная шапка)
В файле `apps/web/src/app/layout.tsx` (строки ~33-36) замени текстовый спан на `<Logo size="sm" showSubtitle={false} />`.

---

### Точный SVG код символа (Вставь как есть, не меняй `y1/y2` — в них зашифрованы данные!):
```tsx
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -200 400 400" className={size === 'sm' ? "w-8 h-8" : "w-12 h-12"}>
    <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0ea5e9" />
            <stop offset="100%" stop-color="#10b981" />
        </linearGradient>
        <g id="fish-outline">
            <path d="M 15 0 Q 80 -50 160 25 M 15 0 Q 80 50 160 -25" 
                  fill="none" stroke="url(#grad1)" strokeWidth="8" strokeLinecap="round"/>
        </g>
    </defs>
    <g transform="rotate(-90)">
        {/* Section 1 */}
        <g transform="rotate(0)">
            <use href="#fish-outline" />
            <line x1="40" y1="-18.77" x2="40" y2="18.77" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="56" y1="-23.69" x2="56" y2="23.69" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
            <line x1="72" y1="-25.76" x2="72" y2="25.76" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="88" y1="-23.78" x2="88" y2="23.78" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
            <line x1="104" y1="-18.73" x2="104" y2="18.73" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="120" y1="-12.75" x2="120" y2="12.75" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
        </g>
        {/* Section 2 */}
        <g transform="rotate(120)">
            <use href="#fish-outline" />
            <line x1="40" y1="-18.79" x2="40" y2="18.79" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="56" y1="-23.86" x2="56" y2="23.86" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
            <line x1="72" y1="-25.50" x2="72" y2="25.50" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="88" y1="-23.53" x2="88" y2="23.53" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
            <line x1="104" y1="-18.51" x2="104" y2="18.51" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="120" y1="-12.53" x2="120" y2="12.53" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
        </g>
        {/* Section 3 */}
        <g transform="rotate(240)">
            <use href="#fish-outline" />
            <line x1="40" y1="-18.48" x2="40" y2="18.48" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="56" y1="-23.54" x2="56" y2="23.54" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
            <line x1="72" y1="-25.52" x2="72" y2="25.52" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="88" y1="-23.54" x2="88" y2="23.54" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
            <line x1="104" y1="-18.54" x2="104" y2="18.54" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="120" y1="-12.52" x2="120" y2="12.52" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
        </g>
        <circle cx="0" cy="0" r="8" fill="#0ea5e9" />
    </g>
</svg>
```
*Внимание на camelCase аттрибуты (strokeWidth, strokeLinecap) для React.*

### Шаг 4: Деплой
Сделай локальный коммит. Использовать инструменты деплоя пока НЕ нужно — просто подготовь код.
