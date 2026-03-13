import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debug() {
  const userId = '840ce1c7-7434-4b95-a6a9-45d27572d426'; // I'll try to find a real ID or use a guess
  
  // First, get the last user who logged a message
  const { data: lastMsg } = await supabase.from('ai_chat_messages').select('user_id').order('created_at', { ascending: false }).limit(1).single();
  const targetId = lastMsg?.user_id || userId;
  
  console.log('Target User ID:', targetId);

  const lookbackTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
  console.log('Lookback Time (UTC):', lookbackTime.toISOString());

  const { data: meals, error } = await supabase
    .from('meal_logs')
    .select('id, logged_at, total_calories, source')
    .eq('user_id', targetId)
    .gte('logged_at', lookbackTime.toISOString());

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${meals?.length} meals for user ${targetId} in the last 24h.`);
    meals?.forEach(m => console.log(`- [${m.id}] ${m.logged_at} | ${m.total_calories} kcal | source: ${m.source}`));
  }
  
  // Also check without the time filter to see if they are just "old"
  const { data: allMeals } = await supabase.from('meal_logs').select('id, logged_at').eq('user_id', targetId).order('logged_at', { ascending: false }).limit(5);
  console.log('\nLast 5 meals (any time):');
  allMeals?.forEach(m => console.log(`- ${m.logged_at} | ${m.id}`));
}

debug();
