/**
 * Prompt Registry — Central exports for all system prompts.
 *
 * Usage:
 *   import { FOOD_VISION_PROMPT } from "../prompts/index.js";
 *   const systemPrompt = FOOD_VISION_PROMPT.template.replace("{userContext}", ctx);
 */

export { ChatPromptBuilder, type PromptBuildResult } from "./chat-prompt-builder.js";
export { FOOD_VISION_PROMPT } from "./food-vision.prompt.js";
export { LAB_DIAGNOSTIC_PROMPT } from "./lab-diagnostic.prompt.js";
export { PSYCHOLOGICAL_PROMPT } from "./psychological.prompt.js";
