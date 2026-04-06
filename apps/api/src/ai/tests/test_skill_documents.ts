/**
 * Test Script: Supabase-Native Skill Documents (Phase 3.5)
 * 
 * Tests:
 * 1. Auth — login and get JWT
 * 2. Edge Function match-skill-context — direct call
 * 3. Chat API — full integration test (coaching + skill document)
 */

const SUPABASE_URL = "https://edsfslhypcbcrcenufdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTQ2MjUsImV4cCI6MjA4NjM5MDYyNX0.dwVcybh5VudWSWpqqu3vWPcNLk_mtC2308v6ZFDV50k";
const LOCAL_API = "http://localhost:3001";

async function main() {
  console.log("=== Test: Supabase-Native Skill Documents ===\n");

  // ── Test 1: Auth ──────────────────────────────────
  console.log("── TEST 1: Authentication ──");
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email: "test1@test.com",
      password: "12332100",
    }),
  });

  if (!authRes.ok) {
    console.error("❌ Auth failed:", await authRes.text());
    return;
  }

  const authData = await authRes.json();
  const token = authData.access_token;
  const userId = authData.user.id;
  console.log(`✅ Authenticated: user_id=${userId}`);
  console.log(`   Token: ${token.substring(0, 30)}...`);

  // ── Test 2: Check existing active skills ──────────
  console.log("\n── TEST 2: Check active skills ──");
  const skillsRes = await fetch(`${SUPABASE_URL}/rest/v1/user_active_skills?user_id=eq.${userId}&status=eq.active&select=id,title,category,status,document_status,skill_document,current_step_index`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${token}`,
    },
  });

  const skills = await skillsRes.json();
  console.log(`   Active skills: ${skills.length}`);
  if (skills.length > 0) {
    for (const s of skills) {
      console.log(`   - "${s.title}" (${s.category}) | doc_status: ${s.document_status} | has_document: ${!!s.skill_document}`);
    }
  } else {
    console.log("   ⚠️ No active skills found. Skill document test will be skipped.");
  }

  // ── Test 3: Edge Function match-skill-context ─────
  console.log("\n── TEST 3: Edge Function match-skill-context ──");
  const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-skill-context`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      message: "У меня низкий ферритин, что делать?",
      user_id: userId,
    }),
  });

  if (!matchRes.ok) {
    console.error(`❌ match-skill-context returned ${matchRes.status}: ${await matchRes.text()}`);
  } else {
    const matchData = await matchRes.json();
    if (matchData.match) {
      console.log(`✅ Matched: "${matchData.match.title}" (similarity: ${matchData.match.similarity})`);
      console.log(`   Document preview: ${matchData.match.skill_document?.substring(0, 100)}...`);
    } else {
      console.log("   ℹ️ No match (expected if no active skills with ready documents)");
    }
  }

  // ── Test 4: Chat API (skipped — test later with local server) ──
  console.log("\n── TEST 4: Chat API — SKIPPED (run with local server) ──");

  // ── Test 5: Check if webhook generates document ───
  console.log("\n── TEST 5: Webhook — create skill & check generation ──");
  console.log("   ⚠️ This test creates a real skill to verify webhook pipeline.");
  console.log("   Inserting test skill...");

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_active_skills`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      title: "Нормализация витамина D",
      category: "supplement",
      source: "manual",
      status: "active",
      priority: 1,
      document_status: "pending",
      diagnosis_basis: {
        pattern: "vitamin_d_deficiency",
        markers: { vitamin_d: 15 },
        detected_at: new Date().toISOString(),
      },
      steps: [
        { order: 1, title: "Сдать 25(OH)D", status: "active", completed_at: null },
        { order: 2, title: "Начать приём D3 5000 МЕ/день", status: "pending", completed_at: null },
        { order: 3, title: "Контрольный анализ через 3 мес", status: "pending", completed_at: null },
      ],
      current_step_index: 0,
    }),
  });

  if (!insertRes.ok) {
    console.error(`❌ Insert failed: ${await insertRes.text()}`);
    return;
  }

  const [inserted] = await insertRes.json();
  console.log(`✅ Skill created: id=${inserted.id}, document_status=${inserted.document_status}`);

  // Wait for webhook to process (Edge Function needs time)
  console.log("   ⏳ Waiting 18 seconds for webhook + OpenAI generation...");
  await new Promise(r => setTimeout(r, 18000));

  // Check if document was generated
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/user_active_skills?id=eq.${inserted.id}&select=id,title,document_status,skill_document`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${token}`,
    },
  });

  const [updated] = await checkRes.json();
  console.log(`   Document status: ${updated.document_status}`);
  
  if (updated.document_status === "ready" && updated.skill_document) {
    console.log(`✅ Webhook pipeline WORKS! Document generated (${updated.skill_document.length} chars)`);
    console.log(`   Preview: ${updated.skill_document.substring(0, 200)}...`);
  } else if (updated.document_status === "generating") {
    console.log("⏳ Still generating... (OpenAI might be slow). Try checking in 10 more seconds.");
  } else if (updated.document_status === "failed") {
    console.log("❌ Document generation FAILED. Check Edge Function logs in Supabase Dashboard.");
  } else {
    console.log("⚠️ Document status is still 'pending'. Webhook might not have fired.");
  }

  // ── Test 6: Match the new skill ──────────────
  if (updated.document_status === "ready") {
    console.log("\n── TEST 6: Match new skill by context ──");
    const match2Res = await fetch(`${SUPABASE_URL}/functions/v1/match-skill-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        message: "Мне нужно поднять витамин Д, какую дозировку принимать?",
        user_id: userId,
      }),
    });

    const match2Data = await match2Res.json();
    if (match2Data.match) {
      console.log(`✅ Context routing WORKS! Matched: "${match2Data.match.title}" (sim: ${match2Data.match.similarity})`);
    } else {
      console.log("❌ No match — embedding might not be ready yet.");
    }
  }

  // Cleanup: delete test skill
  console.log("\n── CLEANUP: Deleting test skill ──");
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/user_active_skills?id=eq.${inserted.id}`, {
    method: "DELETE",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${token}`,
    },
  });
  console.log(`   Deleted: ${delRes.ok ? "✅" : "❌"} (${delRes.status})`);

  console.log("\n=== Test Complete ===");
}

main().catch(console.error);
