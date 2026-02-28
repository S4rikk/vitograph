import "dotenv/config";
import { appGraph } from "./graph/builder.js";
import { HumanMessage } from "@langchain/core/messages";

async function runTests() {
  const threadId = "test-thread-01";
  const config = { configurable: { thread_id: threadId } };

  console.log("🧪 Starting LangGraph Test...\n");

  // 1. Initial tool call test
  console.log(`👤 User: Calculate the vitamin C norm for a 30 year old pregnant smoker.`);
  let result = await appGraph.invoke(
    { messages: [new HumanMessage("Calculate the vitamin C norm for a 30 year old pregnant smoker.")] },
    config
  );
  
  let finalMessage = result.messages[result.messages.length - 1];
  console.log(`🤖 Agent:\n${finalMessage.content}\n`);

  // 2. Memory test
  console.log(`👤 User: What was her age again?`);
  result = await appGraph.invoke(
    { messages: [new HumanMessage("What was her age again?")] },
    config
  );

  finalMessage = result.messages[result.messages.length - 1];
  console.log(`🤖 Agent:\n${finalMessage.content}\n`);
}

runTests();
