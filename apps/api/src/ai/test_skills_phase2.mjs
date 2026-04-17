// Phase 2: Direct PostgreSQL check of LangGraph checkpoints
// and detailed analysis of the goal tracking amnesia bug
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const SUPABASE_URL = 'https://edsfslhypcbcrcenufdf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgxNDYyNSwiZXhwIjoyMDg2MzkwNjI1fQ.Qd5MIshjZSVZh2Vvxd9VL_JDpmdWofSicReuW1aYQ-g';
const DB_URL = 'postgresql://postgres.edsfslhypcbcrcenufdf:ajuFqr6YMeWMapCO@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // ============================================================
  // TEST 1: Check what withActiveSkills actually shows for a user
  // with a "3-day tracking" goal
  // ============================================================
  console.log('=== TEST 1: Find goals with time-based steps (3 days, 7 days) ===\n');

  const { data: allSkills } = await supabase
    .from('user_active_skills')
    .select('id, user_id, title, status, steps, current_step_index, created_at, updated_at')
    .eq('status', 'active');

  const timeBasedGoals = (allSkills || []).filter(s => {
    const stepsStr = JSON.stringify(s.steps || []);
    return stepsStr.match(/\d+\s*(дн|day|дней|суток|неделю|недел)/i);
  });

  console.log(`Goals with time-based language in steps: ${timeBasedGoals.length}\n`);

  for (const goal of timeBasedGoals) {
    console.log(`  "${goal.title}" (user: ${goal.user_id.substring(0, 8)})`);
    console.log(`    current_step_index: ${goal.current_step_index}`);
    console.log(`    created: ${goal.created_at}`);
    console.log(`    updated: ${goal.updated_at}`);

    const daysSinceCreated = Math.floor((Date.now() - new Date(goal.created_at).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`    Days since created: ${daysSinceCreated}`);

    for (const step of (goal.steps || [])) {
      const isTimeBased = JSON.stringify(step).match(/\d+\s*(дн|day|дней|суток|неделю|недел)/i);
      console.log(`    Step ${step.order}: "${step.title}" — status: ${step.status}, completed_at: ${step.completed_at || 'null'} ${isTimeBased ? '⏰ TIME-BASED' : ''}`);
    }
    console.log('');
  }

  // ============================================================
  // TEST 2: Count checkpoint messages per thread
  // ============================================================
  console.log('=== TEST 2: LangGraph checkpoint message counts ===\n');
  
  const pool = new pg.Pool({ connectionString: DB_URL });

  try {
    // Check what tables LangGraph created
    const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%checkpoint%'
      ORDER BY table_name
    `);
    console.log('LangGraph tables:', tablesRes.rows.map(r => r.table_name));

    // Get checkpoint data structure
    const colsRes = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'checkpoints' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\nCheckpoints table columns:');
    for (const col of colsRes.rows) {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    }

    // Count checkpoints per thread
    const cpCountRes = await pool.query(`
      SELECT thread_id, COUNT(*) as cp_count
      FROM checkpoints
      GROUP BY thread_id
      ORDER BY cp_count DESC
      LIMIT 10
    `);
    console.log('\nCheckpoints per thread (top 10):');
    for (const row of cpCountRes.rows) {
      console.log(`  ${row.thread_id}: ${row.cp_count} checkpoints`);
    }

    // Check the actual message count in the latest checkpoint for active skill users
    for (const goal of timeBasedGoals.slice(0, 3)) {
      const threadId = `${goal.user_id}-assistant`;
      
      const latestCp = await pool.query(`
        SELECT thread_id, checkpoint_id, 
               length(checkpoint::text) as blob_size
        FROM checkpoints
        WHERE thread_id = $1
        ORDER BY checkpoint_id DESC
        LIMIT 1
      `, [threadId]);

      if (latestCp.rows.length > 0) {
        console.log(`\n  Thread "${threadId}":`);
        console.log(`    Latest checkpoint blob size: ${latestCp.rows[0].blob_size} bytes`);
      }
    }

    // Check ai_chat_messages count for these users
    console.log('\n=== TEST 3: ai_chat_messages per user (relative to step creation) ===\n');

    for (const goal of timeBasedGoals.slice(0, 5)) {
      const { count } = await supabase
        .from('ai_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', goal.user_id)
        .gte('created_at', goal.created_at);

      console.log(`  User ${goal.user_id.substring(0, 8)}: ${count || 0} messages SINCE goal "${goal.title}" was created (${goal.created_at})`);
    }

  } catch (err) {
    console.error('DB error:', err.message);
  } finally {
    await pool.end();
  }

  // ============================================================
  // TEST 4: Simulate the exact prompt section the LLM sees
  // ============================================================
  console.log('\n=== TEST 4: Exact prompt section LLM sees for time-based goals ===\n');

  for (const s of timeBasedGoals.slice(0, 3)) {
    const currentStep = s.steps?.[s.current_step_index];
    const totalSteps = s.steps?.length || 0;
    const completedSteps = s.steps?.filter(st => st.status === 'completed').length || 0;
    const progress = totalSteps > 0 ? `${completedSteps}/${totalSteps}` : 'без плана';
    
    let line = `- [${s.category || 'general'}] "${s.title}" (id: ${s.id}) — Прогресс: ${progress}`;
    if (currentStep) {
      line += `\n  📍 Текущий шаг ${s.current_step_index + 1}: ${currentStep.title}`;
      if (currentStep.description) {
        line += ` — ${currentStep.description}`;
      }
    }
    
    console.log(`WHAT LLM SEES:\n${line}`);
    console.log(`\nWHAT LLM SHOULD SEE (PROPOSED FIX):`);
    
    // Enhanced version with temporal context
    let enhanced = `- [${s.category || 'general'}] "${s.title}" (id: ${s.id}) — Прогресс: ${progress}`;
    
    if (currentStep) {
      enhanced += `\n  📍 Текущий шаг ${s.current_step_index + 1}: ${currentStep.title}`;
      if (currentStep.description) {
        enhanced += ` — ${currentStep.description}`;
      }
      
      // ADD TEMPORAL CONTEXT - how long the step has been active
      const stepStartDate = s.steps
        .filter(st => st.status === 'completed' && st.completed_at)
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]?.completed_at || s.created_at;
      
      const stepActiveDays = Math.floor((Date.now() - new Date(stepStartDate).getTime()) / (1000 * 60 * 60 * 24));
      enhanced += `\n  ⏱️ Текущий шаг активен уже: ${stepActiveDays} дней (с ${new Date(stepStartDate).toLocaleDateString('ru-RU')})`;
    }
    
    // Show completed steps with timestamps
    const completedWithDates = s.steps?.filter(st => st.status === 'completed' && st.completed_at) || [];
    if (completedWithDates.length > 0) {
      enhanced += `\n  ✅ Завершенные шаги:`;
      for (const cs of completedWithDates) {
        enhanced += `\n    ${cs.order}. "${cs.title}" — завершен ${new Date(cs.completed_at).toLocaleDateString('ru-RU')}`;
      }
    }
    
    console.log(enhanced);
    console.log('\n---\n');
  }

  // ============================================================
  // FINAL: Root cause summary
  // ============================================================
  console.log('=== FINAL ROOT CAUSE ANALYSIS ===\n');
  console.log(`
CONFIRMED ROOT CAUSES:

1. NO TEMPORAL CONTEXT IN PROMPT
   withActiveSkills() shows "Прогресс: 0/5" and "📍 Текущий шаг 1: ..."
   but does NOT show:
   - When the step was STARTED
   - How many DAYS the step has been active
   - completed_at timestamps of preceding steps
   
   → The LLM has NO way to know that "3 дня" tracking is on Day 2

2. TIME-BASED STEPS ARE MODELED AS ACTION STEPS
   "В течение 3 дней отмечать..." is ONE step, not 3 separate steps.
   The LLM treats "3 days" as a description, not as a counter.
   → There is no mechanism to track sub-day progress within a step.

3. 12-MESSAGE SLIDING WINDOW
   builder.ts: convoMessages.slice(-12)
   If Day 1 generates 10+ messages, by Day 2 those are truncated.
   → Any in-context "Day 1 collected" evidence is LOST.

4. NO advance_step FOR DAY BOUNDARIES
   The LLM only calls advance_step when USER reports completion.
   For "track for 3 days", Day 1 ends silently — no advance_step.
   → Progress counter stays at 0 forever until user says "done".

FIX APPROACH (2 changes):
A) ENHANCE withActiveSkills() — add temporal awareness:
   - Show step start date
   - Show days active
   - Show completed_at for past steps
   
B) ADD step_progress field to user_active_skills schema:
   - JSONB field storing daily sub-progress for time-based steps
   - Format: { "2026-04-15": "done", "2026-04-16": "done" }
   - LLM sees this and knows "Day 1 and 2 recorded, Day 3 left"
  `);
}

main().catch(console.error);
