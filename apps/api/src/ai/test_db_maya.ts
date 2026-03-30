import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Fetching profile...");
  const { data: users, error: err1 } = await supabase.from("profiles").select("id, health_goals").limit(1);
  if (err1) {
    console.error("Error 1:", err1.message);
    return;
  }
  const userId = users[0].id;
  console.log(`Current health_goals:`, users[0].health_goals);

  console.log("Updating health_goals to mock value...");
  const { error: err2 } = await supabase.from("profiles").update({ health_goals: [{ desc: "Test" }] }).eq("id", userId);
  if (err2) {
    console.error("Error 2 (Update failed):", err2.message);
  }

  console.log("Refetching health_goals...");
  const { data: user2, error: err3 } = await supabase.from("profiles").select("health_goals").eq("id", userId).single();
  
  console.log("Refetched health_goals:", user2.health_goals);
}

run();
