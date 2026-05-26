import { StateGraph, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseMessage, AIMessage, RemoveMessage } from "@langchain/core/messages";
import { GraphAnnotation } from "./state.js";
import { agentTools, assistantTools, diaryTools } from "./tools.js";
import { checkpointer } from "./checkpointer.js";
import { getLLMConfig } from "../services/config.service.js";

/**
 * Sanitizes the message history to prevent INVALID_TOOL_RESULTS errors.
 * 
 * Problem: If a previous request crashed mid-tool-call (timeout, network error),
 * the MemorySaver may contain an AI message with `tool_calls` but no corresponding
 * `tool` response. Sending this to OpenAI/Gemini causes a 400 error:
 * "messages with role 'tool' must be a response to a preceding message with 'tool_calls'"
 * 
 * Solution: Detect orphaned tool_calls (AI messages with tool_calls that are NOT 
 * followed by matching tool responses) and remove the tool_calls from those messages.
 */
function sanitizeMessages(messages: BaseMessage[]): BaseMessage[] {
  const result: BaseMessage[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgType = msg.type || '';
    
    // Check if this is an AI message with tool_calls
    if (msgType === 'ai' && 'tool_calls' in msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      // Look ahead: the next message(s) should be tool responses
      const expectedToolCallIds = new Set(msg.tool_calls.map((tc: any) => tc.id));
      let allToolCallsAnswered = true;
      
      // Check subsequent messages for matching tool responses
      const foundIds = new Set<string>();
      for (let j = i + 1; j < messages.length; j++) {
        const nextMsg = messages[j];
        const nextType = nextMsg.type || '';
        if (nextType === 'tool' && 'tool_call_id' in nextMsg) {
          foundIds.add((nextMsg as any).tool_call_id);
        } else {
          break; // Stop looking when we hit a non-tool message
        }
      }
      
      // If not all tool_calls have responses, this message is corrupted
      for (const id of expectedToolCallIds) {
        if (!foundIds.has(id)) {
          allToolCallsAnswered = false;
          break;
        }
      }
      
      if (!allToolCallsAnswered) {
        // Strip tool_calls from this message — convert to plain AI message
        console.warn(`[Sanitizer] ⚠️ Removing orphaned tool_calls from AI message (${msg.tool_calls.length} calls without responses)`);
        const cleanContent = typeof msg.content === 'string' && msg.content.trim() 
          ? msg.content 
          : 'Извините, предыдущий запрос был прерван. Пожалуйста, повторите.';
        result.push(new AIMessage(cleanContent));
        continue;
      }
    }
    
    // Check if this is an orphaned tool response (tool message without preceding tool_calls)
    if (msgType === 'tool') {
      const prevMsg = result[result.length - 1];
      const prevType = prevMsg?.type || '';
      
      // If the previous message in result is not an AI with tool_calls, skip this tool message
      if (prevType !== 'ai' || !('tool_calls' in prevMsg) || !Array.isArray(prevMsg.tool_calls) || prevMsg.tool_calls.length === 0) {
        // Check if any prior AI message in result has matching tool_calls
        let hasParent = false;
        for (let k = result.length - 1; k >= 0; k--) {
          const candidate = result[k];
          if (candidate.type === 'ai' && 'tool_calls' in candidate) {
            hasParent = true;
            break;
          }
          if (candidate.type !== 'tool') break;
        }
        if (!hasParent) {
          console.warn(`[Sanitizer] ⚠️ Removing orphaned tool response (no parent tool_calls)`);
          continue;
        }
      }
    }
    
    result.push(msg);
  }
  
  return result;
}

async function callModel(state: typeof GraphAnnotation.State, config?: any) {
  const llmConfig = await getLLMConfig();
  const isDiary = config?.configurable?.chatMode === "diary";
  
  const mainModelName = isDiary ? llmConfig.diary_llm : llmConfig.agent_llm;
  const toolsToBind = isDiary ? diaryTools : assistantTools;

  const mainModel = new ChatOpenAI({
    modelName: mainModelName,
    apiKey: process.env.OPENAI_API_KEY,
    temperature: isDiary ? 0 : 0.2,
  }).bindTools(toolsToBind);

  const backupModel = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.2,
  }).bindTools(toolsToBind);

  const modelToUse = mainModel.withFallbacks([backupModel]);
  
  // Prevent token explosion: 
  // 1. Keep only the LATEST SystemMessage (LangGraph appends a new one on every request)
  // 2. Keep only the last 20 conversation messages
  const systemMessages = state.messages.filter(m => m.type === "system");
  const latestSystemMessage = systemMessages.length > 0 ? systemMessages[systemMessages.length - 1] : null;
  
  let convoMessages = state.messages.filter(m => m.type !== "system");
  
  // Identify messages to prune from the persistent state (keep last 20)
  const PRUNE_THRESHOLD = 20;
  const messagesToPrune: RemoveMessage[] = [];
  
  if (convoMessages.length > PRUNE_THRESHOLD) {
    const toRemove = convoMessages.slice(0, convoMessages.length - PRUNE_THRESHOLD);
    toRemove.forEach(m => {
      if (m.id) {
        messagesToPrune.push(new RemoveMessage({ id: m.id }));
      }
    });
    // For the LLM prompt, we keep a smaller window (12 messages)
    convoMessages = convoMessages.slice(convoMessages.length - 12);
  }

  // Sanitize: remove orphaned tool_calls that crash OpenAI/Gemini
  convoMessages = sanitizeMessages(convoMessages);

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
    const fullPromptLog = finalMessages.map(m => `--- ${m.type || 'unknown'} ---\n${m.content}`).join("\n\n");
    fs.writeFileSync(logFile, `[FULL PROMPT LOG (${chatMode}) - ${new Date().toISOString()}]\n${fullPromptLog}\n`);
  } catch (err) {
    console.error("[DEBUG] Failed to write full prompt log:", err);
  }

  console.log(`[AGENT] 🧠 Thinking... Mode: ${config?.configurable?.chatMode || 'default'}`);
  
  let response;
  try {
    response = await modelToUse.invoke(finalMessages);
  } catch (error: any) {
    console.error(`[AGENT] ❌ Model invocation failed: ${error.message}`);
    // If the error is INVALID_TOOL_RESULTS, the sanitizer missed something — 
    // last resort: strip ALL tool-related messages and retry once
    if (error.message?.includes('INVALID_TOOL_RESULTS') || error.message?.includes("role 'tool'")) {
      console.warn(`[AGENT] 🔄 Retrying with fully cleaned messages (no tool history)`);
      const cleanMessages = finalMessages.filter(m => {
        return m.type !== 'tool';
      }).map(m => {
        if (m.type === 'ai' && 'tool_calls' in m && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
          return new AIMessage(typeof m.content === 'string' ? m.content : 'Предыдущий запрос был прерван.');
        }
        return m;
      });
      response = await modelToUse.invoke(cleanMessages);
    } else {
      throw error; // Re-throw non-tool errors
    }
  }
  
  const usage = response.usage_metadata;
  const usageInfo = usage ? ` | tokens: P=${usage.input_tokens}, C=${usage.output_tokens}, T=${usage.total_tokens}` : "";

  console.log(`[AGENT] ✅ Response received | model=${response.response_metadata?.model_name || 'unknown'}${usageInfo}`);
  return { messages: [...messagesToPrune, response] };
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
