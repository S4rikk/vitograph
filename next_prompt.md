# TASK: Предупреждение о несохраненном профиле (Unsaved Changes Dialog)

## 1. REQUIRED SKILLS & ORDER
1. `react-best-practices`
2. `ui-ux-expert`

## 2. АНАЛИЗ
В компоненте `UserProfileSheet.tsx` отсутствует проверка на несохраненные изменения. Если пользователь добавит заболевание (например, "Астма"), но случайно закроет модалку кликом по оверлею или крестику, данные будут потеряны без предупреждения. Необходимо добавить механизм `isDirty` и красивое модальное окно подтверждения закрытия.

## 3. ПОШАГОВЫЙ ПЛАН РЕАЛИЗАЦИИ

**Файл для работы:** `apps/web/src/components/profile/UserProfileSheet.tsx`

### Шаг 1: Добавление состояний (State)
Внутри компонента `UserProfileSheet`, где объявлены другие состояния (около строки 128), добавьте два новых `useState`:
```typescript
const [initialFormData, setInitialFormData] = useState<Record<string, unknown> | null>(null);
const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
```

### Шаг 2: Инициализация исходных данных
В функции `loadProfile` (около строки 206), после того как вы собрали объект для `setFormData`, сохраните точно такой же объект в `setInitialFormData`:
```typescript
// Внутри loadProfile:
const newFormData = {
    display_name: data.display_name ?? "",
    // ... все остальные поля из текущего кода ...
    timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
};
setFormData(newFormData);
setInitialFormData(newFormData); // Добавить эту строку
```

В функции `handleSaveProfile` (около строки 257), после успешного сохранения стейта, также обновите `initialFormData`:
```typescript
// Внутри try блока handleSaveProfile:
const updatedState = {
    ...prev,
    ...updatedData,
    ai_name: updatedData.ai_name ?? "",
    date_of_birth: updatedData.date_of_birth
        ? new Date(updatedData.date_of_birth as string).toISOString().split("T")[0]
        : "",
};
setFormData(updatedState);
setInitialFormData(updatedState); // Добавить эту строку
```

### Шаг 3: Вычисление `isDirty` и Функция закрытия
Добавьте вычисление флага изменений (можно просто сравнивать через `JSON.stringify`) и безопасную функцию закрытия:
```typescript
// Перед useEffect или рядом с handleSaveProfile
const isDirty = initialFormData ? JSON.stringify(formData) !== JSON.stringify(initialFormData) : false;

const handleRequestClose = () => {
    if (isDirty) {
        setShowUnsavedConfirm(true);
    } else {
        setIsOpen(false);
    }
};

const handleForceClose = () => {
    setShowUnsavedConfirm(false);
    if (initialFormData) {
        setFormData(initialFormData); // Откат изменений при выходе
    }
    setIsOpen(false);
};
```

### Шаг 4: Замена вызовов `setIsOpen(false)`
Найдите **все** места, где модалка закрывается через `setIsOpen(false)` (кроме внутренних сбросов) и замените их на `handleRequestClose()`:
1. Строка ~506 (Overlay): `onClick={handleRequestClose}`
2. Строка ~523 (Кнопка X): `onClick={handleRequestClose}`

### Шаг 5: Верстка модалки подтверждения
В самом низу компонента (например, прямо перед `showDeleteConfirm` или после него), добавьте модальное окно в таком же стиле, как и окно удаления:
```tsx
{/* Unsaved Changes Confirmation Modal */}
{showUnsavedConfirm && (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
        <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-2xl border border-divider animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-ink-main text-center mb-3">
                Закрыть профиль?
            </h2>
            <p className="text-ink-muted text-center leading-relaxed mb-8">
                У вас есть несохраненные изменения. Если вы выйдете сейчас, они будут потеряны.
            </p>
            <div className="flex flex-col gap-3">
                <button
                    onClick={handleForceClose}
                    className="w-full py-4 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 active:scale-[0.98] cursor-pointer"
                >
                    Выйти без сохранения
                </button>
                <button
                    onClick={() => setShowUnsavedConfirm(false)}
                    className="w-full py-4 bg-surface-muted text-ink-main font-bold rounded-2xl hover:bg-surface-hover transition-all border border-divider cursor-pointer"
                >
                    Остаться и продолжить
                </button>
            </div>
        </div>
    </div>
)}
```

## 4. Ожидаемый результат
Если попытаться закрыть боковую панель профиля (клик на оверлей, клик на крестик) после изменения любых полей (вкл. тэги заболеваний/медикаментов), всплывает поверхностное красивое окно предупреждения.

*Примечание: Выполните задачу ИСКЛЮЧИТЕЛЬНО в файле `UserProfileSheet.tsx`.*
