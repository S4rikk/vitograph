
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'apps/api/src/ai/.env') });

async function check() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  
  console.log('--- MEAL_LOGS COLUMNS ---');
  const { data: logs, error: e1 } = await supabase.from('meal_logs').select('*').limit(1);
  if (logs && logs.length > 0) console.log(Object.keys(logs[0]));
  else console.log('No data or error:', e1);

  console.log('\n--- MEAL_ITEMS COLUMNS ---');
  const { data: items, error: e2 } = await supabase.from('meal_items').select('*').limit(1);
  if (items && items.length > 0) console.log(Object.keys(items[0]));
  else console.log('No data or error:', e2);
}

check();
