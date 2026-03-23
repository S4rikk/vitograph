# TASK: Enforce Strict Internal App Boundaries for AI Assistant

**Required Skills:**
- Read `C:\store\ag_skills\skills\prompt-engineering-patterns\SKILL.md` before coding.
- Read `C:\store\ag_skills\skills\ai-engineer\SKILL.md` before coding.

**Architecture Context:**
The user reported that the AI assistant hallucinated a response suggesting the user install a "Google Workspace extension" to parse lab reports. The AI must be strictly confined to the Vitograph application's context. It must NEVER reference external sites, browser extensions, or third-party applications.

**Implementation Steps:**
1. Open the file `C:\project\VITOGRAPH\apps\api\src\ai\src\ai.controller.ts`.
2. Locate the main `systemPrompt` definition (around line 719).
3. Add a new section called `### APP BOUNDARIES (CRITICAL)` right below the `### CONVERSATIONAL RULES` block.
4. Insert the following strict prompt engineering enforcement:
   ```text
   ### APP BOUNDARIES (CRITICAL)
   - STRICT PROHIBITION: You are strictly FOREVER FORBIDDEN from referencing, suggesting, or linking to ANY external internet resources, websites, browser extensions (e.g., Google Workspace), or third-party apps.
   - INTERNAL ONLY: Everything the user discusses must be addressed EXCLUSIVELY within the context of the Vitograph app, your own internal capabilities, and your built-in tools.
   - NO HALLUCINATIONS: Do not invent features, extensions, or integrations that are not explicitly provided in your tools.
   ```
5. Create a short report `next_report.md` stating what was done. Do NOT attempt to run any deployment scripts.

Использованные скиллы: `prompt-engineering-patterns`, `ai-engineer`
