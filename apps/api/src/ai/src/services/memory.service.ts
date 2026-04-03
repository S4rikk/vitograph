import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";

// Singleton embeddings model (reuse across requests)
const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  dimensions: 384,
});

/**
 * Fetch emotional profile and semantic memories for the current user.
 * Returns a tuple: [emotionalProfile, semanticMemories]
 * Designed to be called via Promise.all alongside other async operations.
 * 
 * IMPORTANT: All errors are swallowed internally. If anything fails,
 * the function returns [null, null] so the chat still works.
 */
export async function fetchAdvancedMemoryContext(
  userId: string,
  userMessage: string,
  token: string
): Promise<[EmotionalProfile | null, SemanticMemory[] | null]> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  // Run both queries in parallel
  const [emotionalProfile, semanticMemories] = await Promise.all([
    fetchEmotionalProfile(supabase, userId),
    fetchSemanticMemories(supabase, userId, userMessage)
  ]);

  // Production log: compact summary
  console.log(`[MemoryService] emotional=${emotionalProfile?.current_mood ?? 'none'} | memories=${semanticMemories?.length ?? 0}`);

  return [emotionalProfile, semanticMemories];
}

// ── Types ──────────────────────────────────────────────────────────

export interface EmotionalProfile {
  current_mood: string;
  mood_trend: string;
  trust_level: number;
}

export interface SemanticMemory {
  id: number;
  content: string;
  memory_type: string;
  importance: number;
  similarity: number;
}

// ── Internal functions ──────────────────────────────────────────────

async function fetchEmotionalProfile(
  supabase: ReturnType<typeof createClient>, 
  userId: string
): Promise<EmotionalProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_emotional_profile')
      .select('current_mood, mood_trend, trust_level')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 = "not_found" (no profile yet — totally normal)
      if (error.code !== 'PGRST116') {
        console.warn('[MemoryService] Emotional profile error:', error.message);
      }
      return null;
    }
    return data as EmotionalProfile;
  } catch (err) {
    console.error('[MemoryService] Unexpected error fetching emotional profile:', err);
    return null;
  }
}

async function fetchSemanticMemories(
  supabase: ReturnType<typeof createClient>, 
  userId: string, 
  message: string
): Promise<SemanticMemory[] | null> {
  if (!message || message.trim().length === 0) return null;

  try {
    // 1. Generate embedding for current user message
    //    Uses @langchain/openai OpenAIEmbeddings (already installed)
    const queryEmbedding = await embeddings.embedQuery(message);

    // 2. Search memories via RPC (SECURITY DEFINER — bypasses RLS, filters by p_user_id)
    const { data, error } = await supabase.rpc('match_user_memories', {
      p_user_id: userId,
      query_embedding: queryEmbedding,
      match_count: 5,
      similarity_threshold: 0.25,
    });

    if (error) {
      console.warn('[MemoryService] RPC match_user_memories error:', error.message);
      return null;
    }

    return data && data.length > 0 ? (data as SemanticMemory[]) : null;
  } catch (err) {
    console.error('[MemoryService] Unexpected error fetching semantic memories:', err);
    return null;
  }
}
