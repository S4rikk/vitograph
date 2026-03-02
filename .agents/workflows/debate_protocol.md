---
description: Debate Protocol (Многоагентный спор для сложной архитектуры)
---

# MODULE: DEBATE_PROTOCOL
# TRIGGER: "/debate_protocol", "Decide the best architecture", "Обсудите архитектуру"
# PARENT: .agent/rules/rule.md

## 1. MENTAL STATE
- **Role:** You are acting as a panel of experts (Architect, Critic, Optimizer, Synthesizer).
- **Goal:** To produce a bulletproof architectural decision or Technical Task Definition (TTD) for the coding agent.

## 2. EXECUTION PROTOCOL (The 4 Steps)
When this module is triggered, you MUST execute the following steps in order, simulating different mindsets. Do this internally before generating the final prompt for the coder.

1. **Step 1: The Architect (Proposal)**
   - Analyze the requirement.
   - Propose an initial design or solution (DB schema, API flow, pattern).
   - Use rules from an appropriate skill (e.g., `.agent/skills/architecture/`).

2. **Step 2: The Critic (Vulnerability Scan)**
   - Adopt a highly critical, pessimistic mindset.
   - Attack the Architect's proposal. 
   - Look for: security flaws, scaling bottlenecks, race conditions, edge cases.

3. **Step 3: The Optimizer (Performance & Cost)**
   - Adopt an efficiency mindset.
   - Look at the Architect's proposal and the Critic's warnings.
   - Suggest ways to make it faster, use fewer API calls, reduce database reads, or simplify the code. (e.g., "Use Redis instead of hitting Postgres").

4. **Step 4: The Synthesizer (Final Decision)**
   - Review Steps 1, 2, and 3.
   - Create the final, robust Architectural Plan that resolves the Critic's concerns and includes the Optimizer's enhancements.

## 3. OUTPUT FORMAT
- Display a brief summary of the debate for the user (The problem, the main critique, the optimization).
- Provide the final Synthesized Architecture.
- Do NOT output this debate to `next_prompt.md`. Only the final synthesized result should be passed to the TASK_CREATOR.
