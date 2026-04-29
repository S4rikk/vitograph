const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'i18n', 'messages');

const translations = {
  ru: {
    diary: {
      weightGram: "{weight} г",
      micronutrients: "Микронутриенты",
      editWeight: "Изменить вес",
      delete: "Удалить",
      foodPhotoAlt: "Фото еды"
    },
    glycemic: {
      giLabel: "ГИ",
      giLow: "Низкий",
      giMedium: "Средний",
      giHigh: "Высокий",
      responseFlat: "Плавная волна",
      responseModerate: "Умеренный отклик",
      responseSpike: "Сахарная игла",
      energyUnit: "ч",
      energyLabel: "энергии"
    }
  },
  en: {
    diary: {
      weightGram: "{weight} g",
      micronutrients: "Micronutrients",
      editWeight: "Edit weight",
      delete: "Delete",
      foodPhotoAlt: "Food photo"
    },
    glycemic: {
      giLabel: "GI",
      giLow: "Low",
      giMedium: "Medium",
      giHigh: "High",
      responseFlat: "Flat wave",
      responseModerate: "Moderate response",
      responseSpike: "Sugar spike",
      energyUnit: "h",
      energyLabel: "energy"
    }
  },
  es: {
    diary: { weightGram: "{weight} g", micronutrients: "Micronutrientes", editWeight: "Editar peso", delete: "Eliminar", foodPhotoAlt: "Foto de comida" },
    glycemic: { giLabel: "IG", giLow: "Bajo", giMedium: "Medio", giHigh: "Alto", responseFlat: "Onda plana", responseModerate: "Respuesta moderada", responseSpike: "Pico de azúcar", energyUnit: "h", energyLabel: "de energía" }
  },
  de: {
    diary: { weightGram: "{weight} g", micronutrients: "Mikronährstoffe", editWeight: "Gewicht bearbeiten", delete: "Löschen", foodPhotoAlt: "Essensfoto" },
    glycemic: { giLabel: "Glykämischer Index", giLow: "Niedrig", giMedium: "Mittel", giHigh: "Hoch", responseFlat: "Flache Welle", responseModerate: "Moderate Reaktion", responseSpike: "Zuckerspitze", energyUnit: "Std.", energyLabel: "Energie" }
  },
  fr: {
    diary: { weightGram: "{weight} g", micronutrients: "Micronutriments", editWeight: "Modifier le poids", delete: "Supprimer", foodPhotoAlt: "Photo de nourriture" },
    glycemic: { giLabel: "IG", giLow: "Bas", giMedium: "Moyen", giHigh: "Élevé", responseFlat: "Onde plate", responseModerate: "Réponse modérée", responseSpike: "Pic de sucre", energyUnit: "h", energyLabel: "d'énergie" }
  },
  ja: {
    diary: { weightGram: "{weight} g", micronutrients: "微量栄養素", editWeight: "重量を編集", delete: "削除", foodPhotoAlt: "食べ物の写真" },
    glycemic: { giLabel: "GI", giLow: "低い", giMedium: "中", giHigh: "高い", responseFlat: "フラットな波", responseModerate: "穏やかな反応", responseSpike: "シュガースパイク", energyUnit: "時間", energyLabel: "エネルギー" }
  },
  ko: {
    diary: { weightGram: "{weight} g", micronutrients: "미량 영양소", editWeight: "무게 수정", delete: "삭제", foodPhotoAlt: "음식 사진" },
    glycemic: { giLabel: "GI", giLow: "낮음", giMedium: "보통", giHigh: "높음", responseFlat: "평탄한 파동", responseModerate: "보통의 반응", responseSpike: "혈당 스파이크", energyUnit: "시간", energyLabel: "에너지" }
  },
  pt: {
    diary: { weightGram: "{weight} g", micronutrients: "Micronutrientes", editWeight: "Editar peso", delete: "Excluir", foodPhotoAlt: "Foto de comida" },
    glycemic: { giLabel: "IG", giLow: "Baixo", giMedium: "Médio", giHigh: "Alto", responseFlat: "Onda plana", responseModerate: "Resposta moderada", responseSpike: "Pico de açúcar", energyUnit: "h", energyLabel: "de energia" }
  },
  tr: {
    diary: { weightGram: "{weight} g", micronutrients: "Mikrobesinler", editWeight: "Ağırlığı düzenle", delete: "Sil", foodPhotoAlt: "Yemek fotoğrafı" },
    glycemic: { giLabel: "Gİ", giLow: "Düşük", giMedium: "Orta", giHigh: "Yüksek", responseFlat: "Düz dalga", responseModerate: "Orta tepki", responseSpike: "Şeker artışı", energyUnit: "sa", energyLabel: "enerji" }
  },
  zh: {
    diary: { weightGram: "{weight} g", micronutrients: "微量营养素", editWeight: "编辑重量", delete: "删除", foodPhotoAlt: "食物照片" },
    glycemic: { giLabel: "GI", giLow: "低", giMedium: "中", giHigh: "高", responseFlat: "平稳波", responseModerate: "适度反应", responseSpike: "血糖飙升", energyUnit: "小时", energyLabel: "能量" }
  },
  ar: {
    diary: { weightGram: "{weight} جرام", micronutrients: "المغذيات الدقيقة", editWeight: "تعديل الوزن", delete: "حذف", foodPhotoAlt: "صورة الطعام" },
    glycemic: { giLabel: "مؤشر جلايسيمي", giLow: "منخفض", giMedium: "متوسط", giHigh: "مرتفع", responseFlat: "موجة مسطحة", responseModerate: "استجابة معتدلة", responseSpike: "ارتفاع السكر", energyUnit: "س", energyLabel: "طاقة" }
  }
};

const locales = Object.keys(translations);
for (const locale of locales) {
  const fp = path.join(dir, locale + '.json');
  if (!fs.existsSync(fp)) continue;
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));

  if (!data.diary) data.diary = {};
  Object.assign(data.diary, translations[locale].diary);

  if (!data.glycemic) data.glycemic = {};
  Object.assign(data.glycemic, translations[locale].glycemic);

  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`✅ ${locale}.json updated`);
}
console.log('Done');
