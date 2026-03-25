import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env relative to current working directory or from specific path if needed
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  console.error("Error: Missing required environment variables in .env.");
  console.error("Ensure SUPABASE_URL, SUPABASE_ANON_KEY, TEST_USER_EMAIL, and TEST_USER_PASSWORD are set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY as string);

async function runTest() {
  console.log("Starting weather alert test...");

  // 1. Authenticate user
  console.log(`Authenticating user: ${TEST_USER_EMAIL}`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL as string,
    password: TEST_USER_PASSWORD as string,
  });

  if (authError || !authData.session) {
    console.error("Authentication failed:", authError?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  const userId = authData.user.id;
  console.log("Authentication successful! User ID:", userId);

  // 2. Mock conditions using Admin Client
  const today = new Date().toISOString().split('T')[0];
  console.log(`Mocking environmental logs for ${today}...`);

  const mockLog = {
    user_id: userId,
    date: today,
    max_kp_index: 7,
    pressure_drop_max_hpa: 15,
    city_name: "TestCity",
    synced_at: new Date().toISOString()
  };

  const { error: upsertError } = await adminSupabase
    .from('environmental_logs')
    .upsert(mockLog, { onConflict: 'user_id, date' });

  if (upsertError) {
    console.error("Failed to mock environmental logs:", upsertError.message);
    process.exit(1);
  }

  console.log("Successfully mocked extreme weather conditions.");

  // 3. Send message to AI Chat
  console.log("Sending message to AI Chat...");
  try {
    const response = await fetch("http://localhost:3001/api/v1/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        message: "Что-то мне сегодня тяжело, голова раскалывается и вообще нет сил.",
        chatMode: "assistant",
        threadId: "test-weather-thread-123"
      }),
    });

    if (!response.ok) {
      console.error(`AI Chat request failed with status: ${response.status}`);
      const text = await response.text();
      console.error("Response body:", text);
    } else {
      // It's a streaming response or JSON? Usually it returns JSON or streams. 
      // If server returns JSON: { message: "..." } or streams text.
      // We will try JSON first, fallback to text.
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const json = await response.json();
        console.log("\n=== AI RESPONSE ===");
        console.log(json.message || JSON.stringify(json, null, 2));
        console.log("===================\n");
      } else {
        const text = await response.text();
        console.log("\n=== AI RESPONSE (Stream/Text) ===");
        console.log(text);
        console.log("===================\n");
      }
    }
  } catch (err: any) {
    console.error("Error calling AI Chat:", err.message);
  } finally {
    // 4. Cleanup mocked data
    console.log("Cleaning up mocked environmental logs...");
    const { error: cleanError } = await adminSupabase
      .from('environmental_logs')
      .delete()
      .eq('user_id', userId)
      .eq('date', today);
      
    if (cleanError) {
      console.warn("Cleanup failed:", cleanError.message);
    } else {
      console.log("Cleanup successful.");
    }
  }
}

runTest().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
