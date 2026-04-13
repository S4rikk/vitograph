import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve("../../.env") });

const supabaseUrl = process.env.SUPABASE_URL || "https://edsfslhypcbcrcenufdf.supabase.co";
const supabaseAnonKey = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgxNDYyNSwiZXhwIjoyMDg2MzkwNjI1fQ.Qd5MIshjZSVZh2Vvxd9VL_JDpmdWofSicReuW1aYQ-g";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TEST_EMAIL = "ivan@test.com";
const TEST_PASSWORD = "12332100";
const API_URL = "http://69.12.79.201:3001/api/v1/ai/chat";

async function runTest() {
  console.log("🔐 1. Auth...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError || !authData.session) {
    console.error("❌ Auth Failed:", authError?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  const threadId = `vps-test-${Date.now()}`;
  
  const msg = "Привет! Запомни, я начал новую привычку: каждое утро делаю зарядку по 10 минут. Это для здоровья спины. Создай для меня скилл 'Утренняя зарядка' в моих целях.";
  console.log(`👤 User: "${msg}"`);
  
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ message: msg, threadId })
  });
  
  if (!response.ok) {
     console.error("❌ Request Failed:", response.status, await response.text());
     process.exit(1);
  }
  let result = await response.json();
  console.log(`🤖 Agent:\n${result.data?.response || JSON.stringify(result)}`);
}

runTest().catch(console.error);
