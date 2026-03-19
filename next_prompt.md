# Task: AI Assistant Chat Aesthetics & Premium Rendering

## Context & Problem
The AI Assistant chat currently leaks technical reasoning (`<think>` tags), raw JSON tool call summaries, and displays Markdown as plain text. This provides a poor user experience.

## Required Skills
- `frontend-developer`
- `ui-ux-pro-max`
- `nodejs-backend-patterns`
- `react-ui-patterns`

## Instructions

### 1. Backend: Clean Response Output
**File:** `apps/api/src/ai/src/ai.controller.ts`

- **Filter Reasoning**: In `handleChat`, before sending the `finalContent` back to the user (and before saving it to the DB), use a regex to strip all `<think>...</think>` blocks (including the tags).
- **System Prompt**: Update the `systemPrompt` for the assistant mode to explicitly command the AI: "DO NOT include raw JSON or technical tool call summaries in your final conversational response. Always provide a natural human-like answer."

### 2. Frontend: Premium Markdown Rendering
**File:** `apps/web/src/components/assistant/AiAssistantView.tsx`

- **Markdown Support**: Implement a Markdown renderer (e.g., `react-markdown`). If adding a new dependency is problematic, ensure you handle at least `**bold**`, `### headers`, and `* lists` correctly using a robust regex-to-HTML approach or a lightweight library.
- **Custom Badge Components**: Create custom renderers for our specialized XML tags:
    - **`<meal_score score="X" reason="Y" />`**: Render as a colorful card/badge. 
        - 86-100: Green (Ideal)
        - 70-85: Yellow (Good)
        - 40-69: Orange (Average)
        - 0-39: Red (Poor)
    - **`<nutr type="T">Name (Val)</nutr>`**: Render as a small, colored pill/badge (e.g., vitamins are light purple, minerals are light blue).
- **Typography**: Apply Tailwind's `prose` classes (or custom equivalents) to ensure headers, lists, and bold text have appropriate spacing, font weights, and premium aesthetics.
- **Thoughtfulness**: Ensure any internal tags not handled (like unclosed `<think>`) are sanitized and hidden.

### 3. Verification
- Verify that `#`, `**`, and `-` are rendered as actual headers, bold text, and lists.
- Verify that `<think>` blocks are completely invisible in the chat.
- Verify that sending a message like "Log 2 eggs" results in a clean text reply + a visual "Health Score" badge.

---
**Использованные скиллы: frontend-developer, ui-ux-pro-max, nodejs-backend-patterns, react-ui-patterns**
