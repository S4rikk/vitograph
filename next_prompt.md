# TASK: Short Copy for Verification Infobox (Single Icon)

**Required Skills:**
- Read `C:\store\ag_skills\skills\frontend-developer\SKILL.md` before coding.
- Read `C:\store\ag_skills\skills\ui-ux-pro-max\SKILL.md` before coding.

**Architecture Context:**
The user found the text inside the verification infobox (next to the "Сформировать отчёт" button in `MedicalResultsView.tsx`) to be too long and confusing. 
The user explicitly selected the following short copy: `"⚠️ Внимание! Сверьте данные с оригиналом."` 

**Implementation Steps:**
1. Open the file `C:\project\VITOGRAPH\apps\web\src\components\medical\MedicalResultsView.tsx`.
2. Locate the informational infobox (around line 444) that currently contains the text: 
   *"Проверьте результаты сканирования. ИИ мог допустить неточность..."*
3. Replace the text and layout with the new short version: `"⚠️ Внимание! Сверьте данные с оригиналом."`
4. **CRITICAL DESIGN REQUIREMENT**: 
   - **Do NOT** show a separate info or warning icon circle next to the text. The `⚠️` emoji inside the string itself acts as the single, perfectly sufficient icon. 
   - Remove the `<div className="flex h-8 w-8 shrink-0...">` that contains the cyan SVG info icon entirely.
   - Refine the text and container styling to look extremely clean, minimalist, and natural (e.g., `<div className="text-sm font-semibold text-amber-700">⚠️ Внимание! Сверьте данные с оригиналом.</div>` inside a subtle background wrapper). 
   - The end result must be ONE warning emoji, ONE sentence, and zero clutter.
5. Create a short report `next_report.md` in the VITOGRAPH folder once done. Do NOT run auto-deploy scripts.

Использованные скиллы: `frontend-developer`, `ui-ux-pro-max`
