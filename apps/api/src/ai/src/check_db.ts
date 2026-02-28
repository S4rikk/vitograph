import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); // Load .env from api/

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMessages() {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  console.log('Last 5 messages:');
  data?.forEach(msg => {
    console.log(`[${msg.created_at}] thread: ${msg.thread_id} | role: ${msg.role} | content: ${msg.content.substring(0, 30)}`);
  });
}

checkMessages();
