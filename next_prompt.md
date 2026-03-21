# TASK: Full Account Deletion (GDPR / Right to be Forgotten)

**Priority:** High (Privacy Compliance)
**Goal:** Implement a "Delete Account" feature that wipes all user data from the database, storage buckets, and authentication layer.

**Required Skills:**
- Read `C:\store\ag_skills\skills\senior-architect\SKILL.md`
- Read `C:\store\ag_skills\skills\database-architect\SKILL.md`
- Read `C:\store\ag_skills\skills\backend-architect\SKILL.md`

## 1. Backend: Implement Deletion Logic
**File:** `C:\project\VITOGRAPH\apps\api\src\ai\src\ai.controller.ts`

### 1.1 Create `handleDeleteAccount` Handler
Implement a new endpoint `DELETE /api/v1/users/me`.
1.  **Storage Cleanup**: 
    -   Iterate through buckets: `lab_reports`, `nail_photos`, `food_photos`.
    -   List all files containing the `userId` in their path (e.g., `${userId}/`).
    -   Delete listed files via `supabase.storage.from(bucket).remove(paths)`.
2.  **Database Cleanup**:
    -   Delete rows from tables where `user_id` or `profile_id` matches the user:
        -   `test_results`, `test_sessions`, `meal_logs`, `meal_items` (if not cascaded), `active_condition_knowledge_bases`, `supplement_logs`, `ai_chat_messages`, `feedback`.
    -   Finally, delete the row from `profiles`.
3.  **Authentication Cleanup**:
    -   Use a dedicated `AdminClient` with `SUPABASE_SERVICE_ROLE_KEY` (MUST be server-side only).
    -   Call `supabase.auth.admin.deleteUser(userId)`.
    -   **Important**: This should be the very last step.

## 2. Frontend: Implement User Interface
**File:** `C:\project\VITOGRAPH\apps\web\src\views\ProfileSettings.tsx` (or appropriate settings view)

1.  **UI Component**: Add an "Удалить аккаунт" button in the Profile section.
    -   **Style**: Red/Destructive.
    -   **Confirmation Modal**: Implement a modal using `Dialog` or `Modal` component.
    -   **Text**: "Это действие необратимо. Все ваши анализы, история чата и фотографии будут удалены навсегда."
2.  **Action Flow**:
    -   Invoke the `DELETE /api/v1/users/me` API.
    -   On success: Clear all local storage/session data, log out the user, and redirect to the landing page `/`.

## 3. Verification
1.  **Multi-Table Wipe**: Populate a test account with 1 report, 3 meals, and 5 chat messages. Delete the account. Verify 0 records in all tables for that ID.
2.  **Storage Wipe**: Verify folders in all 3 buckets are empty for that User ID.
3.  **Auth Wipe**: Verify the user cannot log back in and no longer exists in the Supabase Dashboard "Users" tab.
