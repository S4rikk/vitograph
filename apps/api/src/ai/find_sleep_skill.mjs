import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findSleepSkill() {
  console.log('=== Searching for Sleep Skill ===');
  const { data: skills, error } = await supabase
    .from('user_active_skills')
    .select('*')
    .ilike('title', '%глубокого сна%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (!skills || skills.length === 0) {
    console.log('No sleep skill found. Checking latest skills...');
    const { data: latest } = await supabase
      .from('user_active_skills')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('Latest titles:', latest.map(s => s.title));
    return;
  }

  const skill = skills[0];
  console.log('Found Skill:', skill.title);
  console.log('ID:', skill.id);
  console.log('System Prompt / Instructions:');
  console.log('----------------------------');
  console.log(skill.system_prompt || skill.instructions || skill.prompt || 'No prompt found in record.');
  console.log('----------------------------');
  console.log('Full record:', JSON.stringify(skill, null, 2));
}

findSleepSkill();
