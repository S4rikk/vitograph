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

    console.log(`[match-skill-context] ${match ? `Matched: "${match.title}" (sim: ${match.similarity})` : 'No match'}`);

    return new Response(
      JSON.stringify({ match }),
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
