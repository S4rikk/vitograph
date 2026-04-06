/**
 * Deep Diagnostic: Empathetic Memory Pipeline L3
 * 
 * Focuses on diagnosing the 401 from sentiment-extractor
 * and checking if the pipeline EVER worked for ANY user.
 */

const SUPABASE_URL = "https://edsfslhypcbcrcenufdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTQ2MjUsImV4cCI6MjA4NjM5MDYyNX0.dwVcybh5VudWSWpqqu3vWPcNLk_mtC2308v6ZFDV50k";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgxNDYyNSwiZXhwIjoyMDg2MzkwNjI1fQ.Qd5MIshjZSVZh2Vvxd9VL_JDpmdWofSicReuW1aYQ-g";

async function main() {
  console.log("=== Deep Diagnostic: Empathetic Memory Pipeline ===\n");

  // ── DIAG 1: Check if emotional profiles exist for ANY user ──
  console.log("── DIAG 1: Check ALL emotional profiles (service_role) ──");
  const allProfilesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_emotional_profile?select=user_id,current_mood,mood_trend,trust_level,total_interactions,updated_at&order=updated_at.desc&limit=10`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  
  const allProfiles = await allProfilesRes.json();
  if (Array.isArray(allProfiles) && allProfiles.length > 0) {
    console.log(`  Found ${allProfiles.length} emotional profile(s):`);
    for (const p of allProfiles) {
      console.log(`    user=${p.user_id.substring(0,8)}... mood=${p.current_mood} trend=${p.mood_trend} trust=${p.trust_level} interactions=${p.total_interactions} updated=${p.updated_at}`);
    }
  } else {
    console.log("  ⚠️ ZERO emotional profiles exist in the entire database!");
    console.log("  → This means the sentiment-extractor has NEVER successfully run.");
  }

  // ── DIAG 2: Check if pg_net is enabled ──
  console.log("\n── DIAG 2: Check pg_net extension (via RPC) ──");
  const pgNetRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/check_pg_extensions`,
    {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );
  
  if (pgNetRes.ok) {
    const extensions = await pgNetRes.json();
    console.log(`  Extensions: ${JSON.stringify(extensions)}`);
  } else {
    console.log(`  RPC not available (${pgNetRes.status}). Trying direct query...`);
    
    // Alternative: check _net_requests table (created by pg_net)
    const netReqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/_net_response?select=id,status_code,created&order=created.desc&limit=5`,
      {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    
    if (netReqRes.ok) {
      const netReqs = await netReqRes.json();
      if (Array.isArray(netReqs) && netReqs.length > 0) {
        console.log(`  ✅ pg_net is active. Recent ${netReqs.length} responses:`);
        for (const r of netReqs) {
          console.log(`    id=${r.id} status=${r.status_code} created=${r.created}`);
        }
      } else {
        console.log("  pg_net response table exists but is empty.");
      }
    } else {
      console.log(`  _net_response query: ${netReqRes.status}`);
      console.log("  pg_net status unknown. Check Supabase Dashboard → Database → Extensions.");
    }
  }

  // ── DIAG 3: Check recent ai_chat_messages ──
  console.log("\n── DIAG 3: Check recent ai_chat_messages (trigger source) ──");
  const msgsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ai_chat_messages?select=id,user_id,role,created_at,content&role=eq.user&order=created_at.desc&limit=5`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  
  if (msgsRes.ok) {
    const msgs = await msgsRes.json();
    if (Array.isArray(msgs) && msgs.length > 0) {
      console.log(`  Found ${msgs.length} recent user messages:`);
      for (const m of msgs) {
        const preview = (m.content || "").substring(0, 60);
        console.log(`    [${m.created_at}] user=${m.user_id.substring(0,8)}... "${preview}..."`);
      }
    } else {
      console.log("  ⚠️ No user messages found in ai_chat_messages!");
    }
  } else {
    console.log(`  Query failed: ${msgsRes.status} — ${await msgsRes.text()}`);
  }

  // ── DIAG 4: Edge Function health check ──
  console.log("\n── DIAG 4: Edge Function connectivity check ──");
  
  // Try with ANON key first (just to see if function is deployed)
  const healthRes = await fetch(`${SUPABASE_URL}/functions/v1/sentiment-extractor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ user_id: "test", message: "test" }),
  });
  
  console.log(`  Call with ANON_KEY: status=${healthRes.status}`);
  const healthBody = await healthRes.text();
  console.log(`  Response: ${healthBody.substring(0, 200)}`);

  // Try with SERVICE_ROLE_KEY
  const healthRes2 = await fetch(`${SUPABASE_URL}/functions/v1/sentiment-extractor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ user_id: "test", message: "hello" }),
  });
  
  console.log(`  Call with SERVICE_ROLE_KEY: status=${healthRes2.status}`);
  const healthBody2 = await healthRes2.text();
  console.log(`  Response: ${healthBody2.substring(0, 200)}`);

  // ── DIAG 5: Check _app_config service_role_key matches ──
  console.log("\n── DIAG 5: Compare _app_config key vs our key ──");
  const cfgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/_app_config?key=eq.service_role_key&select=value`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  const cfgData = await cfgRes.json();
  if (cfgData.length > 0) {
    const dbKey = cfgData[0].value;
    const match = dbKey === SERVICE_ROLE_KEY;
    console.log(`  Keys match: ${match ? "✅ YES" : "❌ NO"}`);
    if (!match) {
      console.log(`  DB key starts with: ${dbKey.substring(0, 40)}...`);
      console.log(`  Our key starts with: ${SERVICE_ROLE_KEY.substring(0, 40)}...`);
    }
  }

  console.log("\n=== Diagnostic Complete ===");
}

main().catch(console.error);
