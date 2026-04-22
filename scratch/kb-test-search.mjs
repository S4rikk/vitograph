import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceKey);

  console.log("Generating embedding for query 'завтрак утром' via EF...");
  
  // 1. Get embedding from Edge Function
  const response = await fetch(`${supabaseUrl}/functions/v1/kb-embed-query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ text: "завтрак утром" }),
  });

  if (!response.ok) {
    console.error(`Failed to generate query embedding: ${response.statusText}`);
    const errText = await response.text();
    console.error(errText);
    process.exit(1);
  }

  const { embedding } = await response.json();
  console.log("Generating embedding OK! Returned Vector. Now querying RPC...");

  // 2. Query hybrid_search_kb
  const { data, error } = await sb.rpc('hybrid_search_kb', {
    p_query_text: "завтрак утром",
    p_query_embedding: JSON.stringify(embedding),
    p_top_k: 5,
    p_category: null
  });

  if (error) {
    console.error("RPC Error:", error.message);
    process.exit(1);
  }

  console.log("Results found:", data?.length ?? 0);
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
