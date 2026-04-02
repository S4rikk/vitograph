# TASK: Фикс бага — невозможно скроллить вверх во время печати ассистента

## 1. REQUIRED SKILLS & ORDER
1. Read `C:\store\ag_skills\skills\react-best-practices\SKILL.md`

## 2. ПРОБЛЕМА

Когда ассистент пишет сообщение (streaming/typewriter), пользователь НЕ МОЖЕТ прокрутить чат наверх. Скролл поднимается на долю секунды и мгновенно возвращается вниз. Баг пропадает после перезагрузки страницы (т.к. стриминг уже не активен).

**Причина:** Два независимых механизма auto-scroll давят вниз одновременно, не проверяя намерения пользователя:

1. **`ActiveTypewriterNode` (строки 152-173):** `requestAnimationFrame` lerp-цикл (60 FPS), который на каждом кадре устанавливает `container.scrollTop` к `scrollHeight`. Он НИКОГДА не проверяет, хочет ли пользователь скроллить вверх.

2. **`useEffect` auto-scroll (строки 315-329):** Вызывается на КАЖДОЕ изменение `messages`. Во время стриминга каждый токен — это изменение `messages` → срабатывает `el.scrollTop = el.scrollHeight` + `ResizeObserver` тоже ставит `scrollTop = scrollHeight`.

## 3. РЕШЕНИЕ

**Концепция:** Добавить `userHasScrolledUp` ref-флаг. Если пользователь скроллнул вверх (расстояние от дна > порог), ВСЕ auto-scroll механизмы приостанавливаются. Флаг сбрасывается, когда пользователь сам доскроллит обратно до низа.

## 4. ПОШАГОВЫЙ ПЛАН РЕАЛИЗАЦИИ

> ⚠️ КРИТИЧЕСКИ ВАЖНО: Ничего не ломай в анимации! Typewriter скорость, Lerp-плавность, NutrPill рендеринг — всё должно работать как сейчас. Мы ТОЛЬКО добавляем проверку "пользователь скроллил наверх".

**Файл:** `apps/web/src/components/assistant/AiAssistantView.tsx`

### Шаг 1: Добавь ref `userHasScrolledUp` (рядом с строкой 228)

После `const scrollRef = useRef<HTMLDivElement>(null);` добавь:

```typescript
const userHasScrolledUpRef = useRef(false);
```

### Шаг 2: Добавь scroll listener на контейнер чата

Добавь НОВЫЙ useEffect (ПОСЛЕ строки 329, т.е. после существующего auto-scroll effect):

```typescript
// Detect when user manually scrolls up
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;

  const handleScroll = () => {
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // If user is more than 150px from bottom, they've scrolled up
    if (distanceFromBottom > 150) {
      userHasScrolledUpRef.current = true;
    } else {
      // User has scrolled back to bottom — resume auto-scroll
      userHasScrolledUpRef.current = false;
    }
  };

  el.addEventListener("scroll", handleScroll, { passive: true });
  return () => el.removeEventListener("scroll", handleScroll);
}, []);
```

### Шаг 3: Модифицируй `ActiveTypewriterNode` (строки 152-173)

Внутри `smoothLoop` добавь проверку `userHasScrolledUpRef`. Нужно передать ref наружу. 

**Проблема:** `ActiveTypewriterNode` — компонент вне `AiAssistantView`, он не имеет доступа к `userHasScrolledUpRef`. 

**Решение:** Вместо передачи ref через props (что усложнит код), используй тот же подход что и для scroll container — глобальный data-attribute. Добавь на scroll container атрибут, который `ActiveTypewriterNode` сможет читать.

**Альтернативное (лучшее) решение:** Внутри `ActiveTypewriterNode` САМОСТОЯТЕЛЬНО определять, скроллил ли пользователь вверх. Изменить `smoothLoop`:

```typescript
// Независимый 60 FPS цикл для идеальной плавности (Lerp) без сбросов
useEffect(() => {
  let rAF: number;
  const container = document.getElementById("ai-chat-scroll-container");
  
  const smoothLoop = () => {
    if (!container) return;
    const target = targetScrollRef.current;
    const current = container.scrollTop;
    const distanceFromBottom = container.scrollHeight - current - container.clientHeight;
    
    // Если пользователь скроллил наверх (>150px от дна), НЕ давим вниз
    if (distanceFromBottom > 150) {
      rAF = requestAnimationFrame(smoothLoop);
      return;
    }
    
    // Если есть разница между текущим и целевым скроллом, плавно догоняем (easing 15%)
    if (target > 0 && target - current > 0.5) {
      container.scrollTop = current + (target - current) * 0.15;
    }
    rAF = requestAnimationFrame(smoothLoop);
  };
  
  smoothLoop();
  return () => {
    if (rAF) cancelAnimationFrame(rAF);
  };
}, []);
```

### Шаг 4: Модифицируй auto-scroll useEffect (строки 315-329)

Замени весь блок:

```typescript
// 3. Auto-scroll to bottom of chat when messages change or container resizes
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;

  // Only auto-scroll if user hasn't scrolled up
  if (!userHasScrolledUpRef.current) {
    el.scrollTop = el.scrollHeight;
  }

  // Also scroll when the container itself resizes (e.g. input expands)
  const resizeObserver = new ResizeObserver(() => {
    if (!userHasScrolledUpRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  });

  resizeObserver.observe(el);
  return () => resizeObserver.disconnect();
}, [messages]);
```

### Шаг 5: Сбросить флаг при отправке НОВОГО сообщения

В `sendChatMessage` (строка 343), ПЕРЕД `setMessages((prev) => [...prev, userMsg, placeholderMsg])`:

```typescript
// Reset scroll-lock: when user sends a new message, they want to see the response
userHasScrolledUpRef.current = false;
```

## 5. ОГРАНИЧЕНИЯ

1. **НЕ трогай** `useTypewriter` хук (`use-typewriter.ts`). Он работает идеально.
2. **НЕ трогай** `TypewritingAssistantMessage`, `AssistantMessageContent`, `NutrPill`, `ScoreBadge`.  
3. **НЕ меняй** таймеры и easing (`0.15`, `13ms`).
4. **НЕ добавляй** новые npm-пакеты.
5. **НЕ трогай** CSS-классы и стили.
6. Порог 150px подобран так, чтобы случайное покачивание пальцем не считалось за "скролл вверх".

## 6. ТЕСТИРОВАНИЕ

1. Откройте Ассистента, задайте длинный вопрос (например, "Расскажи подробно про витамин D")
2. Пока ассистент печатает ответ — попробуйте скроллить вверх. Ожидание: скролл остаётся наверху, печать продолжается.
3. Доскрольте обратно до низа. Ожидание: auto-scroll возобновляется.
4. Проверьте, что при отправке нового сообщения auto-scroll работает нормально (скролл вниз к ответу).
5. Проверьте, что при загрузке страницы (история) auto-scroll работает (прокрутка к последнему сообщению).
