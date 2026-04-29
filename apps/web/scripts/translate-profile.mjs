import fs from 'fs';
import path from 'path';

const file = path.resolve('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add the import if not present
if (!content.includes('useTranslations')) {
    content = content.replace(/import\s+{[^}]*}\s+from\s+["']react["'];/, match => `${match}\nimport { useTranslations } from "next-intl";`);
}

// 2. Add the hook inside the component if not present
if (!content.includes('const tProfile = useTranslations')) {
    content = content.replace(/export default function UserProfileSheet\([^)]*\)\s*{/, match => `${match}\n    const tProfile = useTranslations("profile");\n    const tLifestyle = useTranslations("lifestyle");\n    const tWearables = useTranslations("wearables");`);
}

// 3. Define mapping of strings to keys
const replacements = [
    { from: />\s*Профиль здоровья\s*</g, to: '>{tProfile("title")}<' },
    { from: />\s*Личная информация\s*</g, to: '>{tProfile("personalInfo")}<' },
    { from: />\s*Имя\s*</g, to: '>{tProfile("name")}<' },
    { from: />\s*Имя ассистента\s*</g, to: '>{tProfile("aiName")}<' },
    { from: /placeholder="Например: Maya Pro"/g, to: 'placeholder={tProfile("aiNamePlaceholder")}' },
    { from: />\s*Дата рождения\s*</g, to: '>{tProfile("dateOfBirth")}<' },
    { from: />\s*Пол\s*</g, to: '>{tProfile("sex")}<' },
    { from: />\s*Мужской\s*</g, to: '>{tProfile("sexOptions.male")}<' },
    { from: />\s*Женский\s*</g, to: '>{tProfile("sexOptions.female")}<' },
    { from: />\s*Физические параметры\s*</g, to: '>{tProfile("physicalParams")}<' },
    { from: />\s*Вес\s*</g, to: '>{tProfile("weight")}<' },
    { from: />\s*Вес \(кг\)\s*</g, to: '>{tProfile("weight")} (кг)<' },
    { from: />\s*Рост \(см\)\s*</g, to: '>{tProfile("height")} (см)<' },
    { from: />\s*Город\s*</g, to: '>{tProfile("city")}<' },
    { from: />\s*Часовой пояс\s*</g, to: '>{tProfile("timezone")}<' },
    
    // Settings
    { from: />\s*Настройки приложения\s*</g, to: '>{tProfile("appSettings")}<' },
    { from: />\s*Язык приложения\s*</g, to: '>{tProfile("language")}<' },
    { from: />\s*Масштаб интерфейса\s*</g, to: '>{tProfile("fontSize")}<' },
    { from: />\s*Маленький\s*</g, to: '>{tProfile("fontSizes.small")}<' },
    { from: />\s*Средний\s*</g, to: '>{tProfile("fontSizes.medium")}<' },
    { from: />\s*Большой\s*</g, to: '>{tProfile("fontSizes.large")}<' },

    // Tabs
    { from: />\s*Обзор\s*</g, to: '>{tProfile("tabs.overview")}<' },
    { from: />\s*Образ жизни\s*</g, to: '>{tProfile("tabs.lifestyle")}<' },
    { from: />\s*Медицина\s*</g, to: '>{tProfile("tabs.medical")}<' },
    { from: />\s*Устройства\s*</g, to: '>{tProfile("tabs.wearables")}<' },
    
    // Lifestyle
    { from: />\s*Уровень активности\s*</g, to: '>{tLifestyle("activityLevel")}<' },
    { from: />\s*Сидячий\s*</g, to: '>{tLifestyle("activityOptions.sedentary")}<' },
    { from: />\s*Лёгкий\s*</g, to: '>{tLifestyle("activityOptions.light")}<' },
    { from: />\s*Умеренный\s*</g, to: '>{tLifestyle("activityOptions.moderate")}<' },
    { from: />\s*Активный\s*</g, to: '>{tLifestyle("activityOptions.active")}<' },
    { from: />\s*Тип питания\s*</g, to: '>{tLifestyle("dietType")}<' },
    { from: />\s*Всеядное\s*</g, to: '>{tLifestyle("dietOptions.omnivore")}<' },
    { from: />\s*Вегетарианство\s*</g, to: '>{tLifestyle("dietOptions.vegetarian")}<' },
    { from: />\s*Веганство\s*</g, to: '>{tLifestyle("dietOptions.vegan")}<' },
    { from: />\s*Кето\s*</g, to: '>{tLifestyle("dietOptions.keto")}<' },
    { from: />\s*Уровень стресса\s*</g, to: '>{tLifestyle("stressLevel")}<' },
    { from: />\s*Низкий\s*</g, to: '>{tLifestyle("stressOptions.low")}<' },
    { from: />\s*Умеренный\s*</g, to: '>{tLifestyle("stressOptions.moderate")}<' },
    { from: />\s*Высокий\s*</g, to: '>{tLifestyle("stressOptions.high")}<' },
    { from: />\s*Очень высокий\s*</g, to: '>{tLifestyle("stressOptions.veryHigh")}<' },
    { from: />\s*Климатическая зона\s*</g, to: '>{tLifestyle("climate")}<' },
    { from: />\s*Тропики\s*</g, to: '>{tLifestyle("climateOptions.tropical")}<' },
    { from: />\s*Умеренная\s*</g, to: '>{tLifestyle("climateOptions.temperate")}<' },
    { from: />\s*Холодная\s*</g, to: '>{tLifestyle("climateOptions.polar")}<' },
    { from: />\s*Алкоголь\s*</g, to: '>{tLifestyle("alcohol")}<' },
    { from: />\s*Не употребляю\s*</g, to: '>{tLifestyle("alcoholOptions.none")}<' },
    { from: />\s*Редко\s*</g, to: '>{tLifestyle("alcoholOptions.rare")}<' },
    { from: />\s*Умеренно\s*</g, to: '>{tLifestyle("alcoholOptions.moderate")}<' },
    { from: />\s*Часто\s*</g, to: '>{tLifestyle("alcoholOptions.frequent")}<' },
    { from: />\s*Физическая активность \(мин\/нед\)\s*</g, to: '>{tLifestyle("physicalActivity")}<' },
    { from: />\s*Среднее время сна \(ч\)\s*</g, to: '>{tLifestyle("sleepHours")}<' },
    { from: />\s*Курение\s*</g, to: '>{tLifestyle("smoker")}<' },
    { from: />\s*Хронические заболевания и Аллергии\s*</g, to: '>{tLifestyle("chronicConditions")}<' },
    { from: />\s*Не указано\s*</g, to: '>{tProfile("noData")}<' },
    { from: /placeholder="Например: Астма, Аллергия"/g, to: 'placeholder={tProfile("manualEntry")}' }, // Approx

    // Save buttons & states
    { from: />\s*Отменить изменения\s*</g, to: '>{tProfile("discardChanges")}<' },
    { from: />\s*Продолжить редактирование\s*</g, to: '>{tProfile("keepEditing")}<' },
    { from: />\s*Удалить аккаунт\s*</g, to: '>{tProfile("deleteAccount")}<' },
    { from: />\s*Сохранить\s*</g, to: '>{tProfile("save") || "Save"}<' },
    { from: />\s*У вас есть несохранённые изменения\. Закрыть без сохранения\?\s*</g, to: '>{tProfile("unsavedChanges")}<' },
    { from: />\s*Вы уверены\? Это действие необратимо\. Все данные будут удалены\.\s*</g, to: '>{tProfile("deleteConfirm")}<' },
    { from: />\s*Удаление\.\.\.\s*</g, to: '>{tProfile("deleting")}<' },

    // Wearables
    { from: />\s*Ввести вручную\s*</g, to: '>{tWearables("addManually")}<' },
    { from: />\s*Кардио активность\s*</g, to: '>{tProfile("cardioActivityTab")}<' },
    { from: />\s*Восстановление сна\s*</g, to: '>{tProfile("sleepRecoveryTab")}<' },
    { from: />\s*Состав тела\s*</g, to: '>{tProfile("bodyCompositionTab")}<' },
    { from: />\s*Метаболизм\s*</g, to: '>{tProfile("metabolicTab")}<' },
    { from: />\s*Стресс и здоровье\s*</g, to: '>{tProfile("stressHealthTab")}<' },
];

let replacedCount = 0;
for (const r of replacements) {
    const originalContent = content;
    content = content.replace(r.from, r.to);
    if (originalContent !== content) replacedCount++;
}

fs.writeFileSync(file, content, 'utf8');
console.log(`Replaced ${replacedCount} mapped string categories in UserProfileSheet.tsx`);
