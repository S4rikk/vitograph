import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Fetching all users from auth.users...");
  // Fetch users (up to 1000 for simplicity of MVP)
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }
  
  console.log(`Found ${users.length} users in auth.users.`);

  for (const user of users) {
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!existingProfile) {
      console.log(`Missing profile for user ${user.email} (${user.id}). Creating...`);
      const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: user.id,
          // Extract reasonable default display name from email
          display_name: user.email ? user.email.split("@")[0] : "New User",
        });
      
      if (insertError) {
         console.error(`Failed to create profile for ${user.id}:`, insertError);
      } else {
         console.log(`✅ Profile created for ${user.email}`);
      }
    } else {
      console.log(`Profile already exists for ${user.email}`);
    }
  }
  console.log("Done checking backfill.");
}

main();
