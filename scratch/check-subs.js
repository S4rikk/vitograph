require('dotenv').config({ path: 'apps/api/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: subs, error } = await supabase.from('push_subscriptions').select('*');
  if (error) {
    console.error("Error fetching subs:", error);
    return;
  }
  console.log(`Found ${subs.length} subscriptions`);
  console.log(JSON.stringify(subs, null, 2));
}

main();
