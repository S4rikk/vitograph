import { MemorySaver } from "@langchain/langgraph";

/**
 * In-memory checkpointer for MVP persistence.
 * Stores conversation state across graph invocations as long as
 * the Node.js process is running.
 * 
 * TODO: Replace with Postgres/Supabase saver for production.
 */
export const checkpointer = new MemorySaver();
