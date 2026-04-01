# TASK: Отвязка UI от профиля (Мгновенный старт Дневника)

## 1. REQUIRED SKILLS & ORDER
You MUST read the SKILL.md files from the following skills before writing any code:
1. `react-hooks-patterns` — `C:\store\ag_skills\skills\react-hooks-patterns\SKILL.md`
2. `frontend-developer` — `C:\store\ag_skills\skills\frontend-developer\SKILL.md`

## 2. ROOT CAUSE ANALYSIS & DEBATE
**Проблема:** Инициализация дневника всё еще занимает визуально больше времени, чем чат-ассистент, и происходит рывком. 
**Причина (The Waterfall Effect):** Дневник полностью блокирует рендеринг (`return null;`), пока не скачает `profile` из базы данных, чтобы узнать часовой пояс юзера (`userTimezone`). Из-за этого запросы на историю и макросы откладываются до завершения скачивания профиля.
**Решение:** Браузер УЖЕ знает локальный часовой пояс! Нам не нужно ждать получения профиля с сервера для 99% пользователей. Мы мгновенно инициализируем `userTimezone` локальным временем браузера при подмонтировании компонента. Это тут же разблокирует рендер UI и параллельно запустит запросы к истории/макросам. Если позже прилетит профиль и окажется, что там жестко задан ДРУГОЙ часовой пояс, стейт просто обновится.

## 3. IMPLEMENTATION PLAN

**File to modify:** `apps/web/src/components/diary/FoodDiaryView.tsx`

Найди блок эффектов самом начале файла (строки от ~55 до ~90).
Мы перепишем инициализацию, разделив её на мгновенный синхронный старт и фоновую дозагрузку профиля.

Было:
```tsx
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Load Profile & Timezone
  useEffect(() => {
    async function hydrateInitialState() {
      //... Ожидание supabase, профиля, и только потом setUserTimezone
```

Стало (Замени эти два хука):
```tsx
  // 1. Мгновенная инициализация на клиенте (Разблокирует рендер и загрузку историй!)
  useEffect(() => {
    setIsMounted(true);
    // Берем таймзону прямо из браузера синхронно
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setUserTimezone(localTz);
    setSelectedDate(getTzToday(localTz));
  }, []);

  // 2. Фоновая проверка настроек профиля (Без блокировки UI)
  useEffect(() => {
    async function fetchUserPreferences() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Параллельно запускаем фоновую загрузку Глобальных Норм
      fetchGlobalNutritionTargets();

      // Сверяем БД-таймзону с локальной
      const profile = await apiClient.getProfile(user.id);
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      
      // Обновляем UI только если пользователь ЖЕСТКО задал другую зону в настройках
      if (profile?.timezone && profile.timezone !== localTz) {
        setUserTimezone(profile.timezone);
        setSelectedDate(getTzToday(profile.timezone));
      }
    }
    fetchUserPreferences();
  }, [supabase, fetchGlobalNutritionTargets]);
```

Это уберет запрос к профилю из критического пути рендера и сэкономит примерно 400-800мс на появлении дневника.

## 4. VERIFICATION
1. Обнови страницу с окном Дневника (F5).
2. UI (каркас, календарь) должен нарисоваться мгновенно, а история и макросы должны начать грузиться в ту же миллисекунду. Задержка перед появлением пустого дневника должна исчезнуть полностью.
