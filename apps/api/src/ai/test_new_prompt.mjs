import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://edsfslhypcbcrcenufdf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgxNDYyNSwiZXhwIjoyMDg2MzkwNjI1fQ.Qd5MIshjZSVZh2Vvxd9VL_JDpmdWofSicReuW1aYQ-g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function testPromptLogic(skills, userDateStr) {
    const items = skills.map(s => {
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
        
        const lastCompleted = s.steps
          ?.filter(st => st.status === 'completed' && st.completed_at)
          .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];
        
        const stepStartDate = lastCompleted?.completed_at || s.created_at;
        if (stepStartDate) {
          let stepActiveDays;
          if (userDateStr) {
            const parts = userDateStr.split('.');
            const todayMs = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`).getTime();
            const startMs = new Date(new Date(stepStartDate).toISOString().split('T')[0] + 'T00:00:00Z').getTime();
            stepActiveDays = Math.max(0, Math.floor((todayMs - startMs) / (1000 * 60 * 60 * 24)));
          } else {
            stepActiveDays = Math.floor((Date.now() - new Date(stepStartDate).getTime()) / (1000 * 60 * 60 * 24));
          }
          
          const startDateStr = new Date(stepStartDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
          line += `\n  ⏱️ Шаг активен: ${stepActiveDays} дн. (с ${startDateStr})`;
          
          const stepText = (currentStep.title || '') + ' ' + (currentStep.description || '');
          const timePeriodMatch = stepText.match(/(\d+)\s*(дн|день|дней|суток|недел)/i);
          if (timePeriodMatch) {
            const totalDays = timePeriodMatch[2]?.toLowerCase().startsWith('недел')
              ? parseInt(timePeriodMatch[1]) * 7
              : parseInt(timePeriodMatch[1]);
            const currentDay = Math.min(stepActiveDays + 1, totalDays + 1);
            if (stepActiveDays >= totalDays) {
              line += `\n  📅 День ${currentDay} — СРОК ВЫПОЛНЕН (из ${totalDays} дн.) ⚠️ Пора завершить шаг (advance_step)`;
            } else {
              line += `\n  📅 День ${currentDay} из ${totalDays}`;
            }
          }
        }
      }
      
      const completedWithDates = s.steps?.filter(st => st.status === 'completed' && st.completed_at) || [];
      if (completedWithDates.length > 0) {
        const doneList = completedWithDates.map(cs => {
          const doneDate = new Date(cs.completed_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
          return `${cs.order}. "${cs.title}" (${doneDate})`;
        }).join(', ');
        line += `\n  ✅ Завершённые: ${doneList}`;
      }
      return line;
    }).join('\n');
    return items;
}

async function main() {
  const { data: skills } = await supabase
    .from('user_active_skills')
    .select('id, title, category, status, steps, current_step_index, diagnosis_basis, priority, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('=== TEST PROMPT BUILDER OUTPUT ===');
  const userLocalDateStr = "17.04.2026";
  const output = testPromptLogic(skills, userLocalDateStr);
  console.log(output);
}

main().catch(console.error);
