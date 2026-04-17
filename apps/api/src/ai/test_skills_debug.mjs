// Debug script: Analyze user_active_skills data and LangGraph checkpoints
// to find why goal progress is "forgotten" between days
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://edsfslhypcbcrcenufdf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgxNDYyNSwiZXhwIjoyMDg2MzkwNjI1fQ.Qd5MIshjZSVZh2Vvxd9VL_JDpmdWofSicReuW1aYQ-g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('=== PHASE 1: Analyze user_active_skills table structure ===\n');

  // Get ALL skills (active + completed + any status)
  const { data: allSkills, error: skillsError } = await supabase
    .from('user_active_skills')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (skillsError) {
    console.error('Error fetching skills:', skillsError);
    return;
  }

  console.log(`Total skills found: ${allSkills?.length || 0}\n`);

  for (const skill of (allSkills || [])) {
    console.log(`--- Skill: "${skill.title}" ---`);
    console.log(`  ID: ${skill.id}`);
    console.log(`  User: ${skill.user_id}`);
    console.log(`  Status: ${skill.status}`);
    console.log(`  Category: ${skill.category}`);
    console.log(`  Current Step Index: ${skill.current_step_index}`);
    console.log(`  Created: ${skill.created_at}`);
    console.log(`  Updated: ${skill.updated_at}`);
    
    if (skill.steps && Array.isArray(skill.steps)) {
      console.log(`  Steps (${skill.steps.length}):`);
      for (const step of skill.steps) {
        console.log(`    [${step.order || '?'}] "${step.title}" — status: ${step.status}, completed_at: ${step.completed_at || 'null'}`);
      }
    }
    
    if (skill.diagnosis_basis) {
      console.log(`  Diagnosis Basis: ${JSON.stringify(skill.diagnosis_basis).substring(0, 100)}`);
    }
    console.log('');
  }

  console.log('\n=== PHASE 2: Check withActiveSkills prompt generation ===\n');

  // Simulate what withActiveSkills would produce
  const activeSkills = (allSkills || []).filter(s => s.status === 'active');
  console.log(`Active skills count: ${activeSkills.length}`);

  for (const s of activeSkills) {
    const currentStep = s.steps?.[s.current_step_index];
    const totalSteps = s.steps?.length || 0;
    const completedSteps = s.steps?.filter(st => st.status === 'completed').length || 0;
    const progress = totalSteps > 0 ? `${completedSteps}/${totalSteps}` : 'без плана';
    
    let line = `- [${s.category}] "${s.title}" (id: ${s.id}) — Прогресс: ${progress}`;
    if (currentStep) {
      line += `\n  📍 Текущий шаг ${s.current_step_index + 1}: ${currentStep.title}`;
      if (currentStep.description) {
        line += ` — ${currentStep.description}`;
      }
    }
    console.log(`\nPrompt would show:\n${line}`);
    
    // KEY CHECK: Does the prompt show completed_at timestamps?
    console.log(`\n  ⚠️ CRITICAL: completed_at for steps is ${currentStep?.completed_at ? 'PRESENT' : 'NOT SHOWN IN PROMPT'}`);
    console.log(`  ⚠️ The prompt does NOT show when steps were completed — this is a potential blind spot for date-aware goals.`);
  }

  console.log('\n=== PHASE 3: Check LangGraph checkpoint tables ===\n');
  
  // Check if checkpoint tables exist and have data
  const { data: checkpoints, error: cpError } = await supabase
    .from('checkpoints')
    .select('thread_id, checkpoint_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (cpError) {
    console.log('checkpoints table error (may not be accessible via API):', cpError.message);
  } else {
    console.log(`Checkpoints found: ${checkpoints?.length || 0}`);
    for (const cp of (checkpoints || [])) {
      console.log(`  thread: ${cp.thread_id}, checkpoint: ${cp.checkpoint_id?.substring(0, 20)}..., created: ${cp.created_at}`);
    }
  }

  console.log('\n=== PHASE 4: Check message truncation impact ===\n');

  // Count messages per thread to see if truncation (12 msg limit) affects goal tracking
  const { data: users, error: usersErr } = await supabase
    .from('profiles')
    .select('id, ai_name, display_name')
    .limit(10);

  if (!usersErr && users) {
    for (const user of users) {
      const { count } = await supabase
        .from('ai_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('thread_id', `${user.id}-assistant`);
      
      console.log(`User "${user.display_name || user.ai_name}" (${user.id.substring(0, 8)}...): ${count || 0} assistant messages`);
    }
  }

  console.log('\n=== PHASE 5: Analyze the core issue — temporal blindness ===\n');

  console.log(`
HYPOTHESIS: The bug is NOT in data storage, but in CONTEXT AMNESIA.

The LLM sees:
1. System prompt with withActiveSkills() → shows current step, progress fraction
2. System prompt with withCoachingMode() → coaching rules + first-message check-in
3. Last 12 conversation messages from LangGraph checkpoint

PROBLEM SCENARIO (3-day tracking goal):
- Day 1: User discusses tracking. AI collects data, says "Day 1 done, 2 left."
  The AI does NOT call advance_step (because the step is "3-day tracking" as ONE step, not 3 separate steps).
  
- Day 2: User starts new conversation about the goal.
  System prompt STILL shows: "📍 Current step 1: Track for 3 days — Progress: 0/3"
  Last 12 messages MAY OR MAY NOT contain Day 1 context (depends on chat volume).
  AI sees no evidence of Day 1 being done → repeats "Day 1, 2 left."

ROOT CAUSES:
a) Steps are designed as ACTION steps, not TIME steps. The LLM creates "Track X for 3 days" 
   as ONE step, not 3 separate day-steps.
b) Even if 3 separate day-steps exist, the LLM doesn't call advance_step automatically
   at the end of each day — it relies on the USER explicitly reporting completion.
c) The system prompt does NOT show completed_at timestamps, so the AI has no temporal
   awareness of WHEN a step was completed.
d) The 12-message sliding window in builder.ts means that Day 1 conversations may be
   completely truncated by Day 2, removing any in-context evidence of progress.
e) There is NO background process that auto-advances time-based steps.
  `);
}

main().catch(console.error);
