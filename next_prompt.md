# TASK: Fix Mobile "Add to Diary" 500 Error (PGRST204)

**Required Skills:**
- Read `C:\store\ag_skills\skills\senior-architect\SKILL.md` before coding.
- Read `C:\store\ag_skills\skills\postgres-best-practices\SKILL.md` before coding.
- Read `C:\store\ag_skills\skills\prisma-expert\SKILL.md` before coding.
- Read `C:\store\ag_skills\skills\systematic-debugging\SKILL.md` before coding.

**Architecture Context:**
When a user logs a meal via a photo on a mobile device, a 500 server error occurs. The logs indicate:
`[FoodVision] Failed to save to meal_logs: { code: 'PGRST204', message: "Could not find the 'source' column of 'meal_logs' in the schema cache" }`
However, logging a meal via text on a PC works perfectly. 

This happens because the mobile upload route (`/api/v1/ai/analyze-food`) attempts to insert `source: "photo"` into the `meal_logs` table (see `ai.controller.ts:1143`). The problem is that the `source` column does not exist in the Supabase database nor in the Prisma schema (`schema.prisma`). The text logging route (`/api/v1/ai/chat`) uses the `log_meal` tool (`tools.ts`), which completely omits the `source` column, hence why it succeeds.

The database issue has already been resolved via a raw SQL `ALTER TABLE` executed by the user. Your job is to update the Prisma schema and the TypeScript codebase to properly handle the `source` field.

**Implementation Steps:**
1. **Update Prisma Schema**:
   - Open `C:\project\VITOGRAPH\prisma\schema.prisma`.
   - Add the `source` field to the `MealLog` model: `source String? @default("manual")`.
   - Run `npx prisma generate` inside `C:\project\VITOGRAPH` (or wherever Prisma is typically run) to update the client. Do NOT push to DB, as the column was added manually via SQL.
2. **Update TypeScript Tooling**:
   - Open `C:\project\VITOGRAPH\apps\api\src\ai\src\graph\tools.ts`.
   - Expand the `.insert()` function for the `log_meal` tool to include `source: "text"` or `source: "manual"` to reflect text-based logging.
3. Verify the application compiles successfully after the Prisma generation.
4. Execute `hotfix_to_server_vg.bat` or the deployment pipeline to push the code update to the server.
