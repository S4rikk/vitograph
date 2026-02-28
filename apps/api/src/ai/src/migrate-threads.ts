import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); 

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateThreads() {
  console.log('Fetching all ai_chat_messages...');
  const { data: messages, error } = await supabase
    .from('ai_chat_messages')
    .select('id, user_id, thread_id');

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  let updatedCount = 0;

  for (const msg of messages || []) {
    let newThreadId = null;

    if (msg.thread_id.startsWith('ast-thread-')) {
      newThreadId = `${msg.user_id}-assistant`;
    } else if (msg.thread_id.startsWith('session-')) {
      newThreadId = `${msg.user_id}-diary`;
    }

    if (newThreadId) {
      const { error: updateError } = await supabase
        .from('ai_chat_messages')
        .update({ thread_id: newThreadId })
        .eq('id', msg.id);

      if (updateError) {
        console.error(`Failed to update msg ${msg.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} messages.`);
}

migrateThreads();
