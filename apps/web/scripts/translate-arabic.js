const fs = require('fs');
const path = require('path');
const fp = path.join(__dirname, '..', 'src', 'i18n', 'messages', 'ar.json');
const data = JSON.parse(fs.readFileSync(fp, 'utf8'));

// Core UI translations
data.common = {
  ...data.common,
  save: "حفظ", cancel: "إلغاء", close: "إغلاق", back: "رجوع",
  next: "التالي", finish: "إنهاء", saving: "جارٍ الحفظ...",
  loading: "جارٍ التحميل...", notSpecified: "غير محدد", error: "خطأ",
  delete: "حذف", confirm: "تأكيد", search: "بحث", add: "إضافة",
  edit: "تعديل", yes: "نعم", no: "لا", select: "اختر...",
  title: "العنوان", subtitle: "العنوان الفرعي", enterValue: "أدخل قيمة",
  slogan: "Feed your cells, find balance",
  sleepDuration: "مدة النوم", deepSleep: "النوم العميق", remSleep: "نوم الريم",
  readinessIndex: "مؤشر الجاهزية", hrv: "تقلب معدل ضربات القلب",
  respiratoryRate: "معدل التنفس", restingHR: "نبض الراحة", vo2max: "الحد الأقصى لاستهلاك الأكسجين",
  steps: "خطوات", activeCalories: "سعرات نشطة",
  bloodPressureSystolic: "الضغط الانقباضي", bloodPressureDiastolic: "الضغط الانبساطي",
  weightLabel: "الوزن", bodyFat: "دهون الجسم", muscleMass: "الكتلة العضلية",
  basalMetabolism: "الأيض الأساسي", visceralFat: "الدهون الحشوية",
  glucose: "الجلوكوز", timeInRange: "الوقت في النطاق",
  glucoseVariability: "تقلب الجلوكوز", stressScore: "مؤشر التوتر",
  tempVariation: "تغير الحرارة", spo2: "SpO2",
  notSpecifiedPlaceholder: "غير محدد", "ru-RU": "الروسية"
};

data.auth = {
  ...data.auth,
  title: "VITOGRAPH", subtitle: "تسجيل الدخول إلى حسابك",
  signIn: "تسجيل الدخول", signingIn: "جارٍ تسجيل الدخول...",
  email: "البريد الإلكتروني", password: "كلمة المرور", signOut: "تسجيل الخروج"
};

data.water = {
  ...data.water,
  title: "الماء", glassesOf: "({current} / {target} أكواب)",
  removeConfirm: "هل تريد إزالة كوب ماء؟",
  disableReminders: "إيقاف التذكيرات", enableReminders: "تفعيل التذكيرات"
};

data.diary = {
  ...data.diary,
  tabDiary: "اليوميات", tabAssistant: "المساعد",
  inputPlaceholder: "ماذا أكلت؟ اكتب أو التقط صورة...",
  send: "إرسال", today: "اليوم", noMeals: "لا توجد سجلات لهذا اليوم",
  feedbackThanks: "شكراً على ملاحظاتك!", feedbackQuestion: "هل كانت هذه الإجابة مفيدة؟",
  greeting: "مرحباً! سأساعدك في تسجيل يومياتك الغذائية. أدخل اسم الطبق ووزنه، وسأتذكر كل شيء 📋",
  thinking: "أفكر... 🧠", aiError: "خطأ في الاتصال بالذكاء الاصطناعي: ",
  deleteConfirm: "هل أنت متأكد من حذف هذه الوجبة؟",
  editWeight: "تعديل الوزن", newWeight: "الوزن الجديد (جرام)",
  dishName: "الطبق", labelScanner: "الملصق", weightLabel: "الوزن (جم)",
  takePhoto: "تصوير الطعام", scanLabel: "مسح الملصق",
  cancelAndClear: "إلغاء ومسح", analyzingFood: "تحليل الطعام…",
  analyzingLabel: "قراءة الملصق…", yesterday: "أمس", returnToToday: "العودة لليوم",
  tabMedical: "التحاليل"
};

data.diary.glycemicSurf = {
  ...data.diary.glycemicSurf,
  insulinSurfingTitle: "ركوب الموجة السكرية", insulinSurfingSubtitle: "ديناميكية الجلوكوز اليومية",
  mgDl: "مجم/دل", hoursShort: "س", thresholds: "العتبات",
  personalThresholds: "العتبات الشخصية", optimalThreshold: "مثالي", elevatedThreshold: "مرتفع",
  emptyChartTitle: "لا توجد بيانات بعد", emptyChartDesc: "أضف وجبات لرؤية منحنى الجلوكوز",
  maxSpike: "أقصى ارتفاع", inGreenZone: "في المنطقة الخضراء", hours: "ساعات",
  averageValue: "القيمة المتوسطة", micronutrientsTitle: "المغذيات الدقيقة",
  outOf16Tracked: "من 16 متتبع", dailyNormCoverage: "تغطية الحاجة اليومية",
  averageValueDesc: "متوسط تغطية الحاجة اليومية لجميع المغذيات",
  vitamins: "الفيتامينات", minerals: "المعادن",
  glycemicSurfingFooter: "البيانات محسوبة من يومياتك الغذائية",
  infoModalTitle: "كيف تقرأ الرسم البياني",
  infoModalWhyTitle: "لماذا نتتبع الجلوكوز؟",
  infoModalWhyDesc: "الجلوكوز المستقر يعني طاقة مستمرة ومزاج جيد وعدم الرغبة في السكر.",
  infoModalGreenZone: "المنطقة الخضراء", infoModalGreenDesc: "مستوى جلوكوز مثالي.",
  infoModalYellowZone: "المنطقة الصفراء", infoModalYellowDesc: "ارتفاع معتدل في الجلوكوز.",
  infoModalRedZone: "المنطقة الحمراء", infoModalRedDesc: "ارتفاع حاد في الجلوكوز.",
  infoModalBenefitTitle: "ما الفائدة؟",
  infoModalBenefitDesc: "فهم ملفك السكري يساعدك على اختيار طعام يوفر طاقة مستقرة طوال اليوم."
};

data.diary.mealScore = { ...data.diary.mealScore, healthScoreLabel: "مؤشر الصحة" };
data.diary.chatMessage = { ...data.diary.chatMessage, thinkAboutIt: "دعني أفكر..." };

data.diary.feedback = {
  ...data.diary.feedback,
  fileTooLarge: "الملف كبير جداً", uploadFailed: "فشل الرفع",
  thanks: "شكراً على ملاحظاتك!", tooManyRequests: "طلبات كثيرة جداً",
  genericError: "حدث خطأ", reportBug: "الإبلاغ عن خطأ",
  dialogTitle: "الملاحظات", dialogDesc: "ساعدنا على التحسين",
  categoryBug: "خطأ", categorySuggestion: "اقتراح",
  placeholder: "صف المشكلة أو الفكرة...", attachScreenshot: "إرفاق لقطة شاشة",
  cancel: "إلغاء", sending: "جارٍ الإرسال...", send: "إرسال"
};

data.profile = {
  ...data.profile,
  title: "الملف الصحي", aboutSection: "عنك",
  personalInfo: "المعلومات الشخصية", name: "الاسم",
  aiName: "اسم المساعد", dateOfBirth: "تاريخ الميلاد", sex: "الجنس",
  physicalParams: "المعايير الجسدية", weight: "الوزن", height: "الطول",
  city: "المدينة", timezone: "المنطقة الزمنية",
  appSettings: "إعدادات التطبيق", language: "لغة الواجهة",
  fontSize: "حجم الخط", save: "حفظ", saving: "جارٍ الحفظ...",
  profileSaved: "✓ تم حفظ الملف", cancel: "إلغاء",
  noData: "لا توجد بيانات", nothingFound: "لم يتم العثور على شيء",
  dangerZone: "منطقة الخطر", dangerZoneDesc: "حذف الحساب سيؤدي إلى فقدان جميع بياناتك بشكل نهائي.",
  deleteAccountBtn: "حذف حسابي وبياناتي", deleteForever: "نعم، حذف الحساب نهائياً",
  areYouSure: "هل أنت متأكد تماماً؟", deleteWarning: "هذا الإجراء لا رجعة فيه.",
  deleting: "جارٍ الحذف...", closeProfile: "إغلاق الملف الشخصي؟",
  unsavedWarning: "لديك تغييرات غير محفوظة.", leaveWithout: "الخروج بدون حفظ",
  stayAndContinue: "البقاء والمتابعة",
  sleepRecoveryTab: "النوم والتعافي", cardioActivityTab: "القلب والنشاط",
  bodyCompositionTab: "تكوين الجسم", metabolicTab: "الأيض", stressHealthTab: "التوتر والصحة"
};

data.profile.tabs = { overview: "نظرة عامة", lifestyle: "نمط الحياة", medical: "طبي", wearables: "الأجهزة" };
data.profile.sexOptions = { ...data.profile.sexOptions, male: "ذكر", female: "أنثى", other: "آخر" };
data.profile.fontSizes = { ...data.profile.fontSizes, compact: "صغير", medium: "متوسط", xlarge: "كبير جداً" };

data.assistant = data.assistant || {};
data.assistant.chat = {
  ...data.assistant.chat,
  welcomeMessage: "مرحباً! أنا مساعدك الصحي الشخصي. كيف يمكنني مساعدتك؟",
  welcomeMessageWithName: "مرحباً! أنا {name}، مساعدك الصحي الشخصي. كيف يمكنني مساعدتك؟",
  defaultAssistantName: "المساعد", clearChatTitle: "مسح المحادثة",
  inputPlaceholder: "اكتب رسالة", send: "إرسال",
  healthScorePoor: "ضعيف", healthScoreAverage: "متوسط",
  healthScoreGood: "جيد", healthScoreIdeal: "مثالي",
  uploadPhotoFailed: "فشل رفع الصورة", networkError: "خطأ في الشبكة",
  clearChatConfirm: "هل تريد مسح المحادثة؟", clearChatError: "خطأ في مسح المحادثة",
  removePhotoTitle: "إزالة الصورة", attachPhotoTitle: "إرفاق صورة",
  nailPhotoPrompt: "التقط صورة لأظافرك", assessProductPrompt: "قيّم المنتج"
};

data.glycemic = {
  ...data.glycemic,
  surfTitle: "ركوب الموجة السكرية", greenZone: "المنطقة الخضراء",
  yellowZone: "المنطقة الصفراء", redZone: "المنطقة الحمراء",
  lowZone: "المنطقة المنخفضة", energyHours: "ساعات الطاقة", gi: "مؤشر جلايسيمي"
};

data.medical = {
  ...data.medical,
  nailsTitle: "تشخيص الأظافر", nailsDescription: "التقط صورة قريبة لأظافرك. سيحلل الذكاء الاصطناعي اللون والملمس والشكل.",
  tongueTitle: "تشخيص اللسان", tongueDescription: "أظهر لسانك في إضاءة جيدة. سيقيّم الذكاء الاصطناعي الطلاء واللون.",
  skinTitle: "تشخيص البشرة", skinDescription: "التقط صورة لمنطقة البشرة المشكلة. سيحدد الذكاء الاصطناعي الأنماط المرئية.",
  symptoms: "متتبع الأعراض", nailsAnalysis: "تحليل الأظافر",
  tongueAnalysis: "تحليل اللسان", skinAnalysis: "تحليل البشرة"
};

fs.writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('✅ ar.json updated with Arabic translations');
