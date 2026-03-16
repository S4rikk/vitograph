# TASK: Fix Food Entry Tool and CORS (Phase 53l)

## CONTEXT
Food entries via text chat are failing. Analysis shows that the `log_meal` tool in the AI engine uses a wrong column name (`portion_grams`) while the database (and the photo path) expects `weight_g`. Also, macros are being saved as NULLs.

## REQUIRED CHANGES

### 1. Fix `apps/api/src/ai/src/graph/tools.ts`
- In `log_meal` tool function:
  - Change `portion_grams: weight_g` to `weight_g: weight_g` in the `meal_items` insert.
  - Ensure `total_protein`, `total_fat`, and `total_carbs` in `meal_logs` insert are explicitly converted to `Number` to avoid NULLs.
  - Add `source: "manual"` to the insert (if not already there).

### 2. Fix `apps/web/next.config.ts`
- Fix the warning: `Blocked cross-origin request... configure "allowedDevOrigins"`.
- Move `allowedDevOrigins` under `experimental` block:
```typescript
const nextConfig = {
  experimental: {
    allowedDevOrigins: ["192.168.1.9", "localhost:3000"]
  }
};
```

## VERIFICATION
- Log "apple 100g" via chat.
- Verify it appears in the diary with all macros filled.
- Verify no CORS warnings in the console for `192.168.1.9`.

Использованные скиллы: postgres-best-practices, nodejs-backend-patterns, systematic-debugging, typescript-advanced-types
