import json
import os

locales_dir = r"C:\project\VITOGRAPH\apps\web\src\i18n\messages"
translations = {
    "en": {"flagNormal": "Normal", "flagLow": "Low", "flagHigh": "High"},
    "ru": {"flagNormal": "Норма", "flagLow": "Ниже нормы", "flagHigh": "Выше нормы"},
    "ko": {"flagNormal": "정상", "flagLow": "낮음", "flagHigh": "높음"},
    "es": {"flagNormal": "Normal", "flagLow": "Bajo", "flagHigh": "Alto"},
    "pt": {"flagNormal": "Normal", "flagLow": "Baixo", "flagHigh": "Alto"},
    "de": {"flagNormal": "Normal", "flagLow": "Niedrig", "flagHigh": "Hoch"},
    "fr": {"flagNormal": "Normal", "flagLow": "Faible", "flagHigh": "Élevé"},
    "it": {"flagNormal": "Normale", "flagLow": "Basso", "flagHigh": "Alto"},
    "ja": {"flagNormal": "正常", "flagLow": "低い", "flagHigh": "高い"},
    "zh": {"flagNormal": "正常", "flagLow": "偏低", "flagHigh": "偏高"},
    "tr": {"flagNormal": "Normal", "flagLow": "Düşük", "flagHigh": "Yüksek"},
    "ar": {"flagNormal": "طبيعي", "flagLow": "منخفض", "flagHigh": "مرتفع"}
}

for locale, trans in translations.items():
    filepath = os.path.join(locales_dir, f"{locale}.json")
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        data.update(trans)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Updated {locale}.json")
