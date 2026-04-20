const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://edsfslhypcbcrcenufdf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgxNDYyNSwiZXhwIjoyMDg2MzkwNjI1fQ.Qd5MIshjZSVZh2Vvxd9VL_JDpmdWofSicReuW1aYQ-g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('=== Checking Latest Goals ===');
  const { data: skills, error: skillsError } = await supabase
    .from('user_active_skills')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (skillsError) {
    console.error('Error fetching skills:', skillsError.message);
  } else {
    for (const skill of skills) {
       console.log(`\nGoal: "${skill.title}"`);
       console.log(`  Category: ${skill.category}`);
       console.log(`  Created: ${skill.created_at}`);
       console.log(`  Steps: ${skill.steps ? skill.steps.length : 0}`);
       if (skill.steps) {
         skill.steps.forEach(step => {
           console.log(`  - Step ${step.order}: ${step.title} (Status: ${step.status})`);
         });
       }
    }
  }

  console.log('\n=== Checking Latest Tool Calls (manage_health_goals) ===');
  // Look into checkpoints or try to find how it responded
  // Just querying active skills is enough to see if it was created with a plan
}

main().catch(console.error);
