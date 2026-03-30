import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  // Используем SERVICE ROLE KEY для обхода RLS и полного доступа!
  const supabaseKey = process.env.SUPABASE_ANON_KEY!; 
  // Мы используем anon/service ключи. Если есть SUPABASE_SERVICE_ROLE_KEY в .env, возьми его.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  console.log('--- НАЧАЛО ДИАГНОСТИКИ ---');
  
  // 1. Пытаемся перезагрузить кэш PostgREST принудительно (если есть права)
  console.log('1. Отправляем сигнал NOTIFY pgrst, reload schema...');
  // rpc('reload_schema_if_possible') doesn't typically exist out of the box, but we'll try just in case.
  const { error: rpcError } = await supabaseAdmin.rpc('reload_schema_if_possible'); 
  
  // 2. Ищем пользователя и его цели
  const { data: users, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('id, health_goals')
    .limit(3);

  if (fetchError) {
    console.error('❌ Ошибка чтения БД:', fetchError.message);
    return;
  }

  console.log('2. Данные профилей из БД (health_goals):');
  users.forEach(u => {
    console.log(`User: ${u.id} | Goals IS UNDEFINED? : ${u.health_goals === undefined} | Goals IS NULL? : ${u.health_goals === null} | Значение: ${JSON.stringify(u.health_goals)}`);
  });

  console.log('--- ДИАГНОСТИКА ЗАВЕРШЕНА ---');
  console.log('Если goals = undefined (поля нет в ответе) или null, значит REST API кэширует схему.');
}

run().catch(console.error);
