import { StateGraph, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { GraphAnnotation } from "./state.js";
import { agentTools } from "./tools.js";
import { checkpointer } from "./checkpointer.js";

// 1. Initialize the model
// We use GPT-4o-mini as specified. 
// It needs to be bound with our available tools so it knows it can call them.
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2, // Low temp for more clinical/deterministic responses
}).bindTools(agentTools);

// 2. Define the nodes
/**
 * The primary LLM node.
 * Invokes the model with the current messages state.
 */
async function callModel(state: typeof GraphAnnotation.State) {
  // We can inject a system prompt here if needed by modifying the messages array
  // or relying on the user to pass SystemMessages. For MVP, we just pass raw messages.
  const response = await model.invoke(state.messages);

  // Deduplicate log_meal tool calls to prevent LLM hallucination spam
  if (response.tool_calls && response.tool_calls.length > 1) {
    const seenMeals = new Set<string>();
    const filteredCalls = [];

    for (const call of response.tool_calls) {
      if (call.name === "log_meal" && call.args) {
        const sig = `${call.args.food_name}-${call.args.weight_g}`;
        if (seenMeals.has(sig)) {
          console.warn(`[AI:Deduplicate] Removed redundant log_meal call for: ${sig}`);
          continue; // Skip the duplicate
        }
        seenMeals.add(sig);
      }
      filteredCalls.push(call);
    }

    // Reconstruct the AIMessage to avoid LangChain serialization mismatch 
    // caused by mutating the object in place.
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

  // Return the new message to be appended to the state
  return { messages: [response] };
}

/**
 * The tools execution node.
 * Inherits from ToolNode which automatically handles executing 
 * the tools requested by the LLM in the last message.
 */
const toolNode = new ToolNode(agentTools);

// 3. Define the conditional edge logic
/**
 * Determines whether to continue to tools or end the graph execution.
 */
function shouldContinue(state: typeof GraphAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  // If there are tool calls in the last message, route to tools
  if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
    return "tools";
  }

  // Otherwise, finish
  return END;
}

// 4. Build and Compile the Graph
const workflow = new StateGraph(GraphAnnotation)
  // Add nodes
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  // Set entry point
  .addEdge("__start__", "agent")
  // Conditional routing after the agent
  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    [END]: END,
  })
  // After tools run, always return to the agent to interpret results
  .addEdge("tools", "agent");

// Compile into a runnable with our memory checkpointer
export const appGraph = workflow.compile({
  checkpointer,
});
