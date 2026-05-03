import os
import json

locales_dir = r"C:\project\VITOGRAPH\apps\web\src\i18n\messages"
for filename in os.listdir(locales_dir):
    if filename.endswith(".json"):
        filepath = os.path.join(locales_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        changed = False
        keys_to_move = ["flagNormal", "flagLow", "flagHigh"]
        
        if "medical" not in data:
            data["medical"] = {}
            
        for k in keys_to_move:
            if k in data:
                data["medical"][k] = data[k]
                del data[k]
                changed = True
                
        if changed:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Fixed {filename}")
        else:
            print(f"Skipped {filename}")
