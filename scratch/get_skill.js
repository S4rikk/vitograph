const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function getLatestSkill() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from('user_active_skills')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching skill:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No skills found.');
    return;
  }

  console.log(JSON.stringify(data[0], null, 2));
}

getLatestSkill();
