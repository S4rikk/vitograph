import fs from 'fs';
import path from 'path';

const ruJsonPath = path.resolve('C:/project/VITOGRAPH/apps/web/src/i18n/messages/ru.json');
const ruJson = JSON.parse(fs.readFileSync(ruJsonPath, 'utf8'));

// ── Profile keys ──
Object.assign(ruJson.profile, {
  save: "Сохранить",
  saving: "Сохраняю...",
  profileSaved: "✓ Профиль сохранён",
  deleteAccountBtn: "Удалить мой аккаунт и данные",
  deleteForever: "Да, удалить аккаунт навсегда",
  areYouSure: "Вы абсолютно уверены?",
  deleteWarning: "Это действие необратимо. Все ваши анализы, история чата и фотографии будут удалены навсегда.",
  cancel: "Отмена",
  closeProfile: "Закрыть профиль?",
  unsavedWarning: "У вас есть несохраненные изменения. Если вы выйдете сейчас, они будут потеряны.",
  leaveWithout: "Выйти без сохранения",
  stayAndContinue: "Остаться и продолжить",
  dangerZone: "Опасная зона",
  dangerZoneDesc: "Удаление аккаунта приведет к безвозвратной потере всех ваших данных, включая анализы, историю чатов и настройки профиля.",
  wearablesSyncSoon: "Автоматическая синхронизация с Apple Health и Google Fit — скоро.",
  screenshotOCRSoon: "OCR для скриншотов Apple Health — скоро!",
  aboutTitle: "О приложении (About)",
});

// ── Lifestyle keys ──
Object.assign(ruJson.lifestyle, {
  nutritionEnvironment: "Питание и Среда",
  activityRecovery: "Активность и Восстановление",
  sleepStress: "Сон и Стресс",
  baseStressLevel: "Базовый уровень стресса",
  alcoholOccasional: "Иногда",
  climateLabel: "Климат",
  climateTropical: "Тропический",
  climateDry: "Сухой",
  climateContinental: "Континентальный",
  climatePolar: "Полярный",
  sunExposure: "Пребывание на солнце",
  sunMinimal: "Минимальный",
  sunModerate: "Умеренное",
  sunHigh: "Высокое",
  activityVeryActive: "Очень активный",
  workType: "Тип работы",
  workOfficeSedentary: "Офис (сидячая)",
  workOfficeActive: "Офис (активная)",
  workRemote: "Удалёнка",
  workManualLabor: "Физический труд",
  workShift: "Сменная работа",
  cardioWeekly: "Кардио в нед. (мин)",
  smoking: "Курение / Вейпинг",
  pregnancy: "Беременность",
  pregnancyNotApplicable: "Не применимо",
  pregnancyPregnant: "Беременна",
  pregnancyBreastfeeding: "Кормление грудью",
  medicationsSupplements: "Медикаменты и Добавки",
  medPlaceholder: "Например: Vitamin D 2000IU",
});

// ── Diary keys (for tabs) ──
Object.assign(ruJson.diary, {
  tabMedical: "Анализы",
  tabAssistant: "Ассистент",
});

// ── Common keys ──
Object.assign(ruJson.common, {
  slogan: "Напитай клетки, обрети баланс",
  notSpecifiedPlaceholder: "Не указано",
});

fs.writeFileSync(ruJsonPath, JSON.stringify(ruJson, null, 2), 'utf8');
console.log('Added ALL remaining keys to ru.json');
