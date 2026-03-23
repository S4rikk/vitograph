import { StateGraph, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { GraphAnnotation } from "./state.js";
import { agentTools } from "./tools.js";
import { checkpointer } from "./checkpointer.js";
const primaryModel = new ChatOpenAI({
  modelName: "gemini-3.1-pro-preview-thinking",
  configuration: {
    baseURL: "https://api.ourzhishi.top/v1",
    apiKey: process.env.GEMINI_API,
  },
  temperature: 0.2,
}).bindTools(agentTools);

const diaryModel = new ChatOpenAI({
  modelName: "gpt-4o",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
}).bindTools(agentTools);

const backupModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.2,
}).bindTools(agentTools);

async function callModel(state: typeof GraphAnnotation.State, config?: any) {
  const modelToUse = config?.configurable?.chatMode === "diary" ? diaryModel : primaryModel.withFallbacks([backupModel]);
  
  // Prevent token explosion: 
  // 1. Keep only the LATEST SystemMessage (LangGraph appends a new one on every request)
  // 2. Keep only the last 20 conversation messages
  const systemMessages = state.messages.filter(m => m._getType && m._getType() === "system");
  const latestSystemMessage = systemMessages.length > 0 ? systemMessages[systemMessages.length - 1] : null;
  
  let convoMessages = state.messages.filter(m => !m._getType || m._getType() !== "system");
  if (convoMessages.length > 12) {
    convoMessages = convoMessages.slice(convoMessages.length - 12);
  }

  // Phase 54: Nutritional Context scaling preservation
  const nutritionalContext = config?.configurable?.nutritionalContext;
  if (nutritionalContext) {
    const { SystemMessage } = await import("@langchain/core/messages");
    const visionSystemMessage = new SystemMessage(
      `CRITICAL VISION ENFORCEMENT: The user has previously analyzed this meal via Vision. 
       You MUST use EXACTLY these nutritional values for the \`log_meal\` tool:
       ${JSON.stringify(nutritionalContext)}
       Do not estimate them yourself. If the user changed the weight, these values have already been scaled correctly.`
    );
    convoMessages = [visionSystemMessage, ...convoMessages];
  }

  const finalMessages = latestSystemMessage ? [latestSystemMessage, ...convoMessages] : convoMessages;
  
  // DEBUG: Log full prompt to a file for Sasha (Surgical Pruning Verification)
  try {
    const fs = await import("fs");
    const chatMode = config?.configurable?.chatMode || 'default';
    const logFile = chatMode === 'diary' ? "debug_diary_prompt.txt" : "debug_assistant_prompt.txt";
    const fullPromptLog = finalMessages.map(m => `--- ${m._getType?.() || 'unknown'} ---\n${m.content}`).join("\n\n");
    fs.writeFileSync(logFile, `[FULL PROMPT LOG (${chatMode}) - ${new Date().toISOString()}]\n${fullPromptLog}\n`);
  } catch (err) {
    console.error("[DEBUG] Failed to write full prompt log:", err);
  }

  console.log(`[AGENT] 🧠 Thinking... Mode: ${config?.configurable?.chatMode || 'default'}`);
  
  const response = await modelToUse.invoke(finalMessages);
  
  const usage = response.usage_metadata;
  const usageInfo = usage ? ` | tokens: P=${usage.input_tokens}, C=${usage.output_tokens}, T=${usage.total_tokens}` : "";

  console.log(`[AGENT] ✅ Response received | model=${response.response_metadata?.model_name || 'unknown'}${usageInfo}`);
  return { messages: [response] };
}
const toolNode = new ToolNode(agentTools);
function shouldContinue(state: typeof GraphAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  return END;
}
const workflow = new StateGraph(GraphAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "agent");
export const appGraph = workflow.compile({
  checkpointer,
});
