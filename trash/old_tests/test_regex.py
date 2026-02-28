import re

PATTERNS = {
    "Glucose": re.compile(r"(?:Glucose|Глюкоза)[\s\.:]+([\d\.,]+)[\s]*(mmol/l|mg/dl|ммоль/л|мг/дл)", re.IGNORECASE),
    "Iron": re.compile(r"(?:Iron|Железо(?: сывороточное)?)[\s\.:]+([\d\.,]+)[\s]*(umol/l|µmol/l|ug/dl|мкмоль/л|мкг/дл)", re.IGNORECASE),
    "Cholesterol": re.compile(r"(?:Cholesterol|Холестерин(?: общий)?)[\s\.:]+([\d\.,]+)[\s]*(mmol/l|mg/dl|ммоль/л|мг/дл)", re.IGNORECASE),
}

sample_text = """
Глюкоза 4,3 ммоль/л
Холестерин общий 3,10 ммоль/л
Железо 20,0 мкмоль/л
"""

print("Testing Regexes...")
for name, pattern in PATTERNS.items():
    match = pattern.search(sample_text)
    if match:
        val_str = match.group(1).replace(',', '.')
        unit = match.group(2)
        print(f"✅ {name}: {val_str} {unit}")
    else:
        print(f"❌ {name}: No match")
