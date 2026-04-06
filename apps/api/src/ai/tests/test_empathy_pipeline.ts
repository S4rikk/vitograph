/**
 * Test Script: Empathetic Memory Pipeline (L3: Sentiment Extraction)
 * 
 * Tests the full chain:
 * 1. Auth — login and get JWT
 * 2. DB Check — verify user_emotional_profile exists and has data
 * 3. DB Check — verify trigger exists on ai_chat_messages
 * 4. Direct Edge Function call — sentiment-extractor 
 * 5. Verify DB update — check if emotional profile was updated
 * 6. memory.service.ts simulation — check if emotional data is readable via user token
 */

const SUPABASE_URL = "https://edsfslhypcbcrcenufdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTQ2MjUsImV4cCI6MjA4NjM5MDYyNX0.dwVcybh5VudWSWpqqu3vWPcNLk_mtC2308v6ZFDV50k";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgxNDYyNSwiZXhwIjoyMDg2MzkwNjI1fQ.Qd5MIshjZSVZh2Vvxd9VL_JDpmdWofSicReuW1aYQ-g";

let RESULTS: string[] = [];
let passCount = 0;
let failCount = 0;

function pass(msg: string) { passCount++; RESULTS.push(`  ✅ ${msg}`); console.log(`  ✅ ${msg}`); }
function fail(msg: string) { failCount++; RESULTS.push(`  ❌ ${msg}`); console.log(`  ❌ ${msg}`); }
function info(msg: string) { RESULTS.push(`  ℹ️ ${msg}`); console.log(`  ℹ️ ${msg}`); }

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  VITOGRAPH — Empathetic Memory Pipeline L3 Audit");
  console.log("═══════════════════════════════════════════════════════\n");

  // ═══ TEST 1: Authentication ═══
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
    fail(`Auth failed: ${await authRes.text()}`);
    return;
  }

  const authData = await authRes.json();
  const token = authData.access_token;
  const userId = authData.user.id;
  pass(`Authenticated: user_id=${userId}`);

  // ═══ TEST 2: Check existing emotional profile (via user token — tests RLS) ═══
  console.log("\n── TEST 2: Read emotional profile (user token, tests RLS SELECT) ──");
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_emotional_profile?user_id=eq.${userId}&select=current_mood,mood_trend,trust_level,total_interactions,positive_interactions,negative_interactions,engagement_score,updated_at`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${token}`,
      },
    }
  );

  const profileData = await profileRes.json();
  
  if (Array.isArray(profileData) && profileData.length > 0) {
    const p = profileData[0];
    pass(`Emotional profile found (RLS SELECT works)`);
    info(`  mood=${p.current_mood} | trend=${p.mood_trend} | trust=${p.trust_level}`);
    info(`  interactions: total=${p.total_interactions} pos=${p.positive_interactions} neg=${p.negative_interactions}`);
    info(`  engagement=${p.engagement_score} | updated_at=${p.updated_at}`);
  } else if (Array.isArray(profileData) && profileData.length === 0) {
    info("No emotional profile yet (first-time user). Will be created after Test 4.");
  } else {
    fail(`Unexpected response: ${JSON.stringify(profileData)}`);
  }

  // ═══ TEST 3: Check _app_config (via service role — trigger needs this) ═══
  console.log("\n── TEST 3: Verify _app_config (edge_function_url & service_role_key) ──");
  const configRes = await fetch(
    `${SUPABASE_URL}/rest/v1/_app_config?select=key,value`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );

  const configData = await configRes.json();
  
  if (Array.isArray(configData)) {
    const edgeUrl = configData.find((c: any) => c.key === 'edge_function_url');
    const srvKey = configData.find((c: any) => c.key === 'service_role_key');
    
    if (edgeUrl) {
      pass(`edge_function_url configured: ${edgeUrl.value}`);
    } else {
      fail("edge_function_url NOT FOUND in _app_config — trigger cannot fire!");
    }
    
    if (srvKey) {
      pass(`service_role_key configured (${srvKey.value.substring(0, 30)}...)`);
    } else {
      fail("service_role_key NOT FOUND in _app_config — trigger cannot authenticate!");
    }
  } else {
    fail(`Cannot read _app_config: ${JSON.stringify(configData)}`);
  }

  // ═══ TEST 4: Direct call to sentiment-extractor Edge Function ═══
  console.log("\n── TEST 4: Direct call to sentiment-extractor ──");
  
  const testMessages = [
    { msg: "Я очень устал и мне грустно сегодня", expected_mood: "sad", expected_valence_sign: "negative" },
    { msg: "Отлично себя чувствую, полон сил!", expected_mood: "happy", expected_valence_sign: "positive" },
  ];

  for (const test of testMessages) {
    info(`Testing: "${test.msg}"`);
    
    const sentimentRes = await fetch(`${SUPABASE_URL}/functions/v1/sentiment-extractor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        user_id: userId,
        message: test.msg,
      }),
    });

    if (!sentimentRes.ok) {
      fail(`sentiment-extractor returned ${sentimentRes.status}: ${await sentimentRes.text()}`);
      continue;
    }

    const sentimentData = await sentimentRes.json();
    
    if (sentimentData.success) {
      const moodOk = sentimentData.mood !== undefined;
      const valenceOk = test.expected_valence_sign === "negative" 
        ? sentimentData.valence < 0 
        : sentimentData.valence > 0;
      
      if (moodOk && valenceOk) {
        pass(`mood=${sentimentData.mood}, valence=${sentimentData.valence} (expected: ${test.expected_valence_sign})`);
      } else {
        fail(`mood=${sentimentData.mood}, valence=${sentimentData.valence} — expected ${test.expected_valence_sign} valence`);
      }
    } else {
      fail(`Edge Function error: ${JSON.stringify(sentimentData)}`);
    }
  }

  // ═══ TEST 5: Verify emotional profile was updated after sentiment calls ═══
  console.log("\n── TEST 5: Verify emotional profile updated (post-sentiment) ──");
  
  // Small delay for DB to settle
  await new Promise(r => setTimeout(r, 1000));
  
  const profile2Res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_emotional_profile?user_id=eq.${userId}&select=current_mood,mood_trend,trust_level,total_interactions,learned_preferences,updated_at`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${token}`,
      },
    }
  );

  const profile2Data = await profile2Res.json();
  
  if (Array.isArray(profile2Data) && profile2Data.length > 0) {
    const p = profile2Data[0];
    pass(`Profile updated: mood=${p.current_mood} trend=${p.mood_trend} trust=${p.trust_level}`);
    info(`total_interactions=${p.total_interactions}`);
    
    // Check recent_valences in learned_preferences
    const recentValences = p.learned_preferences?.recent_valences;
    if (Array.isArray(recentValences) && recentValences.length > 0) {
      pass(`recent_valences tracked: [${recentValences.join(', ')}] (${recentValences.length} entries)`);
    } else {
      fail("recent_valences not found in learned_preferences");
    }
    
    // Check that updated_at is recent (within last 30 seconds)
    const updatedAt = new Date(p.updated_at);
    const timeDiffSec = (Date.now() - updatedAt.getTime()) / 1000;
    if (timeDiffSec < 30) {
      pass(`updated_at is fresh: ${timeDiffSec.toFixed(1)}s ago`);
    } else {
      info(`updated_at is ${timeDiffSec.toFixed(0)}s old — may not have been updated by Test 4`);
    }
  } else {
    fail("Emotional profile not found after direct sentiment calls!");
  }

  // ═══ TEST 6: Simulate memory.service.ts read path (user token SELECT) ═══
  console.log("\n── TEST 6: Simulate memory.service.ts read (user token) ──");
  const memReadRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_emotional_profile?user_id=eq.${userId}&select=current_mood,mood_trend,trust_level`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${token}`,
      },
    }
  );

  const memReadData = await memReadRes.json();
  if (memReadData.length > 0 && memReadData[0].current_mood) {
    pass(`memory.service.ts path works: mood=${memReadData[0].current_mood}, trend=${memReadData[0].mood_trend}`);
  } else {
    fail("memory.service.ts path broken — cannot read emotional profile with user token!");
  }

  // ═══ SUMMARY ═══
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log("═══════════════════════════════════════════════════════\n");
  
  if (failCount === 0) {
    console.log("🎉 ALL TESTS PASSED — Empathetic Memory Pipeline L3 is HEALTHY!");
  } else {
    console.log("⚠️ SOME TESTS FAILED — see details above.");
  }
}

main().catch(console.error);
