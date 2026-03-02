import { StateGraph, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { GraphAnnotation } from "./state.js";
import { agentTools } from "./tools.js";
import { checkpointer } from "./checkpointer.js";
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2,
}).bindTools(agentTools);
async function callModel(state: typeof GraphAnnotation.State) {
  // Prevent token explosion: 
  // 1. Keep only the LATEST SystemMessage (LangGraph appends a new one on every request)
  // 2. Keep only the last 20 conversation messages
  const systemMessages = state.messages.filter(m => m._getType && m._getType() === "system");
  const latestSystemMessage = systemMessages.length > 0 ? systemMessages[systemMessages.length - 1] : null;
  
  let convoMessages = state.messages.filter(m => !m._getType || m._getType() !== "system");
  if (convoMessages.length > 20) {
    convoMessages = convoMessages.slice(convoMessages.length - 20);
  }
  const finalMessages = latestSystemMessage ? [latestSystemMessage, ...convoMessages] : convoMessages;
  const response = await model.invoke(finalMessages);
  if (response.tool_calls && response.tool_calls.length > 1) {
    const seenMeals = new Set<string>();
    const filteredCalls: any[] = [];
    for (const call of response.tool_calls) {
      if (call.name === "log_meal" && call.args) {
        const sig = `${call.args.food_name}-${call.args.weight_g}`;
        if (seenMeals.has(sig)) {
          continue;
        }
        seenMeals.add(sig);
      }
      filteredCalls.push(call);
    }
    const newAdditionalKwargs = { ...response.additional_kwargs };
    if (Array.isArray(newAdditionalKwargs.tool_calls)) {
      newAdditionalKwargs.tool_calls = newAdditionalKwargs.tool_calls.filter(
        (tc: any) => filteredCalls.some((fc) => fc.id === tc.id)
      );
    }
    const { AIMessage } = await import("@langchain/core/messages");
    const deduplicatedMessage = new AIMessage({
      content: response.content,
      tool_calls: filteredCalls,
      additional_kwargs: newAdditionalKwargs,
      response_metadata: response.response_metadata,
      id: response.id,
      name: response.name,
    });
    return { messages: [deduplicatedMessage] };
  }
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
