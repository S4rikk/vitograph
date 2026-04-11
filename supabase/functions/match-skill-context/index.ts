import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const model = new Supabase.ai.Session('gte-small');

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, user_id } = await req.json();

    if (!message || !user_id) {
      return new Response(
        JSON.stringify({ error: "message and user_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate embedding for user message via Supabase.ai (FREE)
    const embedding = await model.run(message, {
      mean_pool: true,
      normalize: true,
    });

    // Call RPC for vector similarity search
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.rpc('match_skill_by_context', {
      query_embedding: JSON.stringify(embedding),
      p_user_id: user_id,
      match_threshold: 0.6,
    });

    if (error) {
      console.warn("[match-skill-context] RPC error:", error.message);
      return new Response(
        JSON.stringify({ match: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const match = data && data.length > 0 ? data[0] : null;

    // ── KB Fallback: if no user skill matched, search global KB ──
    let finalMatch = match;
    if (!finalMatch) {
      try {
        const { data: kbResults, error: kbError } = await supabase.rpc('hybrid_search_kb', {
          p_query_text: message,
          p_query_embedding: JSON.stringify(embedding),
          p_top_k: 3,
          p_category: null,
        });

        if (!kbError && kbResults && kbResults.length > 0) {
          const kbDoc = kbResults.map((r: any) => {
            let chunk = `## ${r.document_title}`;
            if (r.section_heading) chunk += ` — ${r.section_heading}`;
            chunk += `\n${r.content}`;
            return chunk;
          }).join('\n\n');

          finalMatch = {
            id: `kb-${kbResults[0].chunk_id}`,
            title: kbResults[0].document_title,
            skill_document: kbDoc,
            category: kbResults[0].category,
            steps: [],
            current_step_index: 0,
            similarity: kbResults[0].rrf_score,
            source: 'knowledge_base',
          };

          console.log(`[match-skill-context] KB fallback matched: "${finalMatch.title}" (rrf: ${kbResults[0].rrf_score})`);
        }
      } catch (kbErr) {
        console.warn(`[match-skill-context] KB fallback failed (non-fatal):`, kbErr);
      }
    }

    console.log(`[match-skill-context] ${finalMatch ? `Matched: "${finalMatch.title}" (sim: ${finalMatch.similarity})` : 'No match'}`);

    return new Response(
      JSON.stringify({ match: finalMatch }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[match-skill-context] ERROR:", error);
    return new Response(
      JSON.stringify({ match: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
