# VITOGRAPH: TECHNICAL TASK (Phase 58 v3 - ASSISTANT CHAT UX)
# Objectives: Auto-expanding Textarea for Assistant Chat

## 1. Context: Parity with Food Diary 
The Food Diary chat input now correctly expands as a textarea. We must apply the EXACT same logic to the **Main Assistant Chat** (`AiAssistantView.tsx`) to ensure a consistent experience.

## 2. Technical Task - WEB (`AiAssistantView.tsx`)

### 2.1 Textarea Transformation
1. **Locate the Input**: In `AiAssistantView.tsx`, find the `input type="text"` around line 417.
2. **Replace with Textarea**:
   Swap it for a `<textarea />` with the following attributes:
   ```tsx
   <textarea
     value={input}
     onChange={(e) => setInput(e.target.value)}
     disabled={isLoading}
     placeholder="Задайте вопрос о здоровье..."
     rows={1}
     style={{ fieldSizing: "content" } as any}
     onKeyDown={(e) => {
       if (e.key === "Enter" && !e.shiftKey) {
         e.preventDefault();
         handleSubmit(e);
       }
     }}
     className="flex-1 rounded-xl border-cloud-dark bg-white px-4 py-3 text-[15px] text-ink shadow-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 max-h-[150px] min-h-[44px] overflow-y-auto resize-none"
   />
   ```
3. **No UI Changes**: Do NOT add any new buttons (camera, gallery, etc.). The Assistant Chat remains text-only. Only the input field type changes.

### 2.2 Layout & Scroll
- Verify that when the textarea expands, the chat history scrolls to the bottom properly (existing `ResizeObserver` or `useEffect` should handle this, but double check).

---

## 3. Verification
1. Open Assistant Chat.
2. Type long text (2+ lines). Verify it grows.
3. Verify "Enter" sends and "Shift + Enter" creates a newline.

Использованные скиллы: [list of skill names from vitograph_skills.json]
