# TASK: Surgical Prompt Optimization (Dual-Mode Persona)

**Required Skills:**
You MUST read and apply the following skills from your library before starting:
- `C:\store\ag_skills\skills\nodejs-backend-patterns\SKILL.md` (Node.js Backend Patterns)
- `C:\store\ag_skills\skills\ai-engineer\SKILL.md` (AI Engineer Guidelines)
- `C:\store\ag_skills\skills\systematic-debugging\SKILL.md` (Systematic Debugging)

**Architecture Context:**
Read the architectural decision document here:
`C:\project\kOSI\docs\04_prompt_optimization.md`

We are splitting the system prompt injection into two modes based on `chatMode` to drastically save tokens for the Diary (food logging) feature.

**Implementation Steps:**

1. **Modify AI Controller**
   - File: `C:\project\VITOGRAPH\apps\api\src\ai\src\ai.controller.ts`
   - Target function: `handleChat`
   - Current logic injects all context regardless of the mode. You need to wrap the context injection into a conditional block checking `chatMode === 'diary'`.

2. **Mode A: `diary` (Lightweight)**
   - Include: 
     - Basic profile stats (Age, Sex, Goals)
     - `food_contraindication_zones` (Dietary Restrictions / Zones)
     - Target deterministic norms (КБЖУ и Микро)
     - Today's consumed progress (СЪЕДЕНО СЕГОДНЯ)
     - Supplements protocol and today's intake
   - EXCLUDE:
     - `formatChronicConditions(dbContext.profile)`
     - `formatHistorySynopsis(dbContext.profile, timezone)`
     - `formatTestResults(dbContext.recentTests, timezone)`
     - `formatActiveKnowledgeBases(dbContext.activeKnowledgeBases)`
     - `formatLabDiagnosticReport(dbContext.profile)`
   - **CRITICAL ADDITION:** Append this exact text to the `diary` system prompt:
     `SECURITY RULE: You are operating in DIARY MODE. Your sole and exclusive purpose is registering what the user eats and providing the macro/micronutrient breakdown (КБЖУ). You must use the user's individual profile to determine and shift these nutritional norms appropriately. All general discussions, clinical questions, or deep medical advice MUST NOT happen here. If the user asks for medical advice or diagnosis, YOU MUST REFUSE and advise them to switch to CONSULTATION mode.`

3. **Mode B: `default` (Consultation)**
   - If `chatMode !== 'diary'`, inject the FULL context exactly as it is now.

4. **Verification**
   - Check TypeScript syntax and ensure the project builds correctly after your changes. Use your debugging skills.

5. **Reporting**
   - When finished and verified, write your final report to: `C:\project\kOSI\next_report.md`.

6. **⚠️ STRICT PROHIBITION: NO DEPLOYMENT**
   - We are currently developing and testing in the **LOCAL ENVIRONMENT** only.
   - DO NOT push to git, DO NOT run any `/auto_deploy_vg` workflow, DO NOT run the deploy script on the server.
   - Stop immediately after local verification and reporting.
