import { createClient } from "@supabase/supabase-js";

export interface ActiveSkill {
  id: string;
  title: string;
  category: string;
  status: string;
  steps: SkillStep[];
  current_step_index: number;
  diagnosis_basis: any;
  priority: number;
  created_at: string;
}

export interface SkillStep {
  order: number;
  title: string;
  description?: string;
  status: string;        // 'active' | 'pending' | 'completed' | 'skipped'
  completed_at: string | null;
}

/**
 * Fetches active skills for a user (max 3, ordered by priority).
 * This is called in parallel alongside fetchUserContext() and fetchAdvancedMemoryContext().
 */
export async function fetchActiveSkills(
  userId: string,
  token: string
): Promise<ActiveSkill[] | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase
      .from("user_active_skills")
      .select("id, title, category, status, steps, current_step_index, diagnosis_basis, priority, created_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("priority", { ascending: true })
      .limit(3);

    if (error) {
      console.warn("[SkillsService] Error fetching active skills:", error.message);
      return null;
    }

    console.log(`[SkillsService] Fetched ${data?.length ?? 0} active skills for user.`);
    return data && data.length > 0 ? (data as ActiveSkill[]) : null;
  } catch (err) {
    console.error("[SkillsService] Unexpected error:", err);
    return null;
  }
}

export interface MatchedSkillDocument {
  id: string;
  title: string;
  skill_document: string;
  category: string;
  steps: any[];
  current_step_index: number;
  similarity: number;
}

/**
 * Fetches matching skill document by semantic context.
 * Calls Edge Function match-skill-context which:
 * 1. Generates message embedding (gte-small, FREE in Supabase.ai)
 * 2. Performs pgvector similarity search via RPC
 * Returns the best matching skill document or null.
 */
export async function fetchMatchingSkillDocument(
  userId: string,
  message: string
): Promise<MatchedSkillDocument | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/match-skill-context`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ message, user_id: userId }),
      }
    );

    if (!response.ok) {
      console.warn(`[SkillsService] match-skill-context returned ${response.status}`);
      return null;
    }

    const { match } = await response.json();
    if (match) {
      console.log(`[SkillsService] Matched skill document: "${match.title}" (similarity: ${match.similarity})`);
    }
    return match || null;
  } catch (err) {
    console.error("[SkillsService] Error fetching skill document:", err);
    return null;
  }
}
