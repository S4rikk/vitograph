const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://edsfslhypcbcrcenufdf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgxNDYyNSwiZXhwIjoyMDg2MzkwNjI1fQ.Qd5MIshjZSVZh2Vvxd9VL_JDpmdWofSicReuW1aYQ-g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
    console.log('List users:', users?.users.length, 'Error:', usersErr);
    
    if (users && users.users) {
       console.log(users.users.find(u => u.email === 's4rikk@gmail.com') ? 'User exists' : 'User missing');
    }
    
    const { data, error } = await supabase.from('wearable_manual_metrics').select('*').limit(1);
    console.log('Test table query error:', error);
  } catch(e) {
    console.error('Exception:', e);
  }
}
test();
