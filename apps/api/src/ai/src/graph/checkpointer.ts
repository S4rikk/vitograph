import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";

/**
 * Persistent Postgres-backed checkpointer — v1.0.0
 *
 * Stores LangGraph conversation state in Supabase PostgreSQL.
 * Survives server restarts, unlike the previous MemorySaver.
 *
 * Tables created automatically by .setup():
 *   - checkpoints
 *   - checkpoint_writes
 *   - checkpoint_blobs
 *
 * Connection string: SUPABASE_DB_URL env var.
 */

const dbUrl = process.env["SUPABASE_DB_URL"];

if (!dbUrl) {
  console.warn(
    "[Checkpointer] ⚠️ SUPABASE_DB_URL not set. Falling back to in-memory checkpointer (data will be lost on restart)."
  );
}

export const checkpointer: BaseCheckpointSaver = dbUrl
  ? PostgresSaver.fromConnString(dbUrl)
  : new MemorySaver();

/**
 * Must be called once at server startup BEFORE any graph invocations.
 * Creates the checkpoint tables if they don't exist.
 */
export async function initCheckpointer(): Promise<void> {
  if (dbUrl && checkpointer instanceof PostgresSaver) {
    try {
      await checkpointer.setup();
      console.log("[Checkpointer] ✅ PostgresSaver initialized (persistent mode)");
    } catch (err) {
      console.error("[Checkpointer] ❌ Failed to setup PostgresSaver:", err);
      throw err;
    }
  } else {
    console.log("[Checkpointer] ⚠️ Using MemorySaver (non-persistent, dev mode)");
  }
}
