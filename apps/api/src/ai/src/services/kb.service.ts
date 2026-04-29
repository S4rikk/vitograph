/**
 * Knowledge Base Service — v1.0.0
 *
 * Provides hybrid search (semantic + lexical + RRF fusion) over the global
 * medical knowledge base (kb_documents → kb_sections → kb_chunks).
 *
 * Reuses the `embeddings` singleton from memory.service.ts for consistent
 * embedding generation (text-embedding-3-small, 384d).
 *
 * Called in parallel alongside fetchUserContext(), fetchAdvancedMemoryContext(),
 * fetchActiveSkills(), and fetchMatchingSkillDocument() in ai.controller.ts.
 */

import { createClient } from "@supabase/supabase-js";
import { embeddings } from "./memory.service.js";

// ── Types ───────────────────────────────────────────────────────────

export interface KBSearchResult {
  chunk_id: number;
  content: string;
  section_heading: string | null;
  section_content: string | null;
  document_title: string;
  document_slug: string;
  category: string;
  semantic_score: number;
  lexical_score: number;
  rrf_score: number;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Fetches relevant knowledge base context for the user's message.
 * Uses hybrid search (semantic + lexical) with RRF fusion via the
 * `hybrid_search_kb` Postgres RPC.
 *
 * Reuses the embeddings singleton from memory.service.ts (gte-small
 * compatible, text-embedding-3-small 384d).
 *
 * All errors are swallowed internally — returns null on failure
 * so the chat pipeline continues without KB context.
 *
 * @param userMessage - The user's message to search against
 * @param token - JWT token for authenticated Supabase access
 * @param categoryFilter - Optional category to scope the search
 * @returns Array of KB search results or null if none found
 */
export async function fetchKnowledgeBaseContext(
  userMessage: string,
  token: string,
  categoryFilter?: string,
): Promise<KBSearchResult[] | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    // Generate embedding via Edge Function proxy (gte-small) to match kb_chunks
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const response = await fetch(`${supabaseUrl}/functions/v1/kb-embed-query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ text: userMessage }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate query embedding: ${response.statusText}`);
    }
    const { embedding: queryEmbedding } = await response.json() as any;

    // Call RPC hybrid_search_kb
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase.rpc("hybrid_search_kb", {
      p_query_text: userMessage,
      p_query_embedding: queryEmbedding,
      p_top_k: 5,
      p_category: categoryFilter || null,
    });

    if (error) {
      console.warn("[KBService] Error in hybrid_search_kb:", error.message);
      return null;
    }

    console.log(`[KBService] Found ${data?.length ?? 0} KB results.`);
    return data && data.length > 0 ? (data as KBSearchResult[]) : null;
  } catch (err) {
    console.error("[KBService] Unexpected error:", err);
    return null; // Graceful degradation
  }
}
