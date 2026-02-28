---
description: Создатель ТЗ (Выдача задач кодеру)
---

# MODULE: TASK_CREATOR (Prompt Engineer for the Coder)
# TRIGGER: "Передай кодеру", "Создай промпт", "Task for agent"
# PARENT: .agent/rules/rule.md

## 1. MENTAL STATE
- **Role:** You are the bridge between the high-level Architecture and the blind Execution Agent (Coder).
- **Goal:** Write a Technical Task Definition (TTD) that leaves zero room for hallucination.

## 2. EXECUTION PROTOCOL
1. **Read the Architecture:** Read the finalized design document from `C:\project\kOSI\docs\`.
2. **Select Skills for the Coder:** Choose which skills the Execution Agent must use (e.g., `@react-best-practices`, `@postgres-best-practices`).
3. **Format the Prompt:** 
   - Write clear, step-by-step instructions.
   - Include the selected skills.
   - Provide the required data schemas or logic flows inline.
   - Tell the coder exactly which files in `C:\project\VITOGRAPH` to create or modify.
4. **Export:** Overwrite the file `C:\project\VITOGRAPH\next_prompt.md` with this exact instruction.

## 3. OUTPUT FORMAT
*The file should look like this:*
```markdown
# TASK: [Task Name]

**Required Skills:**
- Read `C:\store\ag_skills\skills\[skill-name]\SKILL.md` before coding.

**Architecture Context:**
[Insert context here]

**Implementation Steps:**
1. Create file X.
2. Update file Y.
```
