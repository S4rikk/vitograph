import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role to bypass RLS for testing
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  // 1. Get user_id for s4rikk@gmail.com
  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) {
    console.error("Auth error:", usersErr.message);
    return;
  }
  
  const user = users.users.find(u => u.email === 's4rikk@gmail.com');
  if (!user) {
    console.error("User not found!");
    return;
  }
  
  console.log("Found user ID:", user.id);
  
  // 2. Insert dummy sleep data
  const { data, error } = await supabase.from('wearable_manual_metrics').insert({
    user_id: user.id,
    category: 'sleep',
    metrics: {
      sleepDurationHours: 8.5,
      deepSleepPercent: 22,
      remSleepPercent: 25,
      readinessScore: 88,
      hrvMs: 65,
      respiratoryRateBrpm: 14.5
    }
  }).select();
  
  if (error) {
    console.error("Insert error:", error.message);
  } else {
    console.log("Successfully inserted test data:", data);
  }
}
testInsert();
