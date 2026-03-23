import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Or Service key if available
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("Missing supabase URL");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey || supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('meal_logs')
    .select('*')
    .order('logged_at', { ascending: false })
    .limit(2);

  if (error) {
    console.error("Error fetching meal_logs:", error);
  } else {
    console.log("Latest meal_logs:", JSON.stringify(data, null, 2));
  }
}

run();
