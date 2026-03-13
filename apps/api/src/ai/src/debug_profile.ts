import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function checkProfile() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing DB credentials. URL:", supabaseUrl, "Key exists:", !!supabaseKey);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get one user ID from the database
  const { data: users, error: userError } = await supabase.from("profiles").select("id").limit(1);
  if (userError || !users || users.length === 0) {
    console.error("No users found");
    return;
  }
  
  const userId = users[0].id;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  
  if (error || !data) {
    console.error("Error fetching profile:", error);
    return;
  }
  
  console.log("--- Profile Diagnostic ---");
  console.log("Total length of JSON.stringify(profile):", JSON.stringify(data).length);
  
  const entries = Object.entries(data).sort((a, b) => JSON.stringify(b[1]).length - JSON.stringify(a[1]).length);
  
  for (const [key, val] of entries) {
    const len = JSON.stringify(val).length;
    if (len > 50) {
      console.log(`[${key}]: ${len} chars`);
    }
  }
}

checkProfile();
