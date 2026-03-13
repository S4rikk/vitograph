const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './apps/api/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMeals() {
  console.log('--- Checking Meal Logs ---');
  const { data: meals, error } = await supabase
    .from('meal_logs')
    .select('id, user_id, logged_at, total_calories, micronutrients, meal_quality_score')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching meals:', error);
    return;
  }

  console.log('Last 10 meals in meal_logs:');
  meals.forEach(m => {
    console.log(`[${m.id}] User: ${m.user_id} | LoggedAt: ${m.logged_at} | Cal: ${m.total_calories} | Score: ${m.meal_quality_score}`);
  });

  if (meals.length > 0) {
    console.log('\n--- Checking Meal Items for last meal ---');
    const { data: items, error: itemsError } = await supabase
      .from('meal_items')
      .select('*')
      .eq('meal_log_id', meals[0].id);
    
    if (itemsError) {
      console.error('Error fetching items:', itemsError);
    } else {
      console.log(`Items for meal ${meals[0].id}:`);
      console.log(JSON.stringify(items, null, 2));
    }
  }
}

checkMeals();
