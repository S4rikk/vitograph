# VITOGRAPH: TECHNICAL TASK (Phase 56 v7.1 - QUICK FIX)
# Objectives: Fix ReferenceError + Proper Admin Init

## 1. Context: ReferenceError
The v7 implementation failed with `ReferenceError: supabaseAdmin is not defined`. 
You used the variable but didn't initialize it in the function scope.

## 2. Technical Task - BACKEND (`ai.controller.ts`)

### 2.1 handleUpdateMealLog & handleDeleteMealLog
**MANDATORY**: Initialize `supabaseAdmin` at the start of BOTH functions (where `supabase` is initialized).

```ts
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // <-- ADD THIS

// Standard user client
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { Authorization: `Bearer ${token}` } },
});

// Admin client for sync
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey); // <-- ADD THIS
```

Ensuring `supabaseAdmin` is available for:
- Updating `ai_chat_messages` in `handleUpdateMealLog`.
- Deleting from `meal_items` and `ai_chat_messages` in `handleDeleteMealLog`.

## 3. Verification
1. Run server -> Edit meal.
2. Verified: No `ReferenceError`.
3. Verified: Cards updated on F5.

Использованные скиллы: [list of skill names from vitograph_skills.json]
