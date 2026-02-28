import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve("../../.env") });

// Ensure URL and Key are available (either locally set or in your .env)
const supabaseUrl = process.env.SUPABASE_URL || "https://edsfslhypcbcrcenufdf.supabase.co";
const supabaseAnonKey = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TEST_EMAIL = "ivan@test.com";
const TEST_PASSWORD = "12332100";
const API_URL = "http://localhost:3001/api/v1/ai/chat";

async function runTest() {
  console.log("🔐 1. Authenticating with Supabase...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError || !authData.session) {
    console.error("❌ Auth Failed:", authError?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  console.log("✅ Authenticated. Token acquired.");

  const threadId = `test-thread-${Date.now()}`;
  console.log(`\n🧵 Using Thread ID: ${threadId}`);

  // Test 1: Tool Calling
  console.log("\n🧪 2. Testing Tool Call (Calculate Norms)...");
  const msg1 = "Calculate vitamin C for 30 yo pregnant smoker";
  console.log(`👤 User: "${msg1}"`);
  
  let response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ message: msg1, threadId })
  });

  if (!response.ok) {
     console.error("❌ Request 1 Failed:", response.status, await response.text());
     process.exit(1);
  }
  let result = await response.json();
  console.log(`🤖 Agent:\n${result.data?.response || JSON.stringify(result)}`);

  // Test 2: Memory
  console.log("\n🧠 3. Testing Memory...");
  const msg2 = "What was her age again?";
  console.log(`👤 User: "${msg2}"`);

  response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ message: msg2, threadId })
  });
  
  if (!response.ok) {
     console.error("❌ Request 2 Failed:", response.status, await response.text());
     process.exit(1);
  }
  result = await response.json();
  console.log(`🤖 Agent:\n${result.data?.response || JSON.stringify(result)}`);
}

runTest().catch(console.error);
