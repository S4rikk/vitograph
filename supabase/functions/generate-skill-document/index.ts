import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const model = new Supabase.ai.Session('gte-small');

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    user_id: string;
    title: string;
    category: string;
    steps: any[];
    diagnosis_basis: any;
  };
  schema: string;
}

const SKILL_GENERATION_PROMPT = `Ты — медицинский AI-ассистент. Сгенерируй ПЕРСОНАЛЬНЫЙ ПРОТОКОЛ здоровья.

ФОРМАТ ДОКУМЕНТА:
# Протокол: [название цели]
## Профиль пациента
[возраст, пол, существующие состояния — кратко]
## Клиническое основание
[диагноз, ключевые маркеры, их значения vs референс]
## Стратегия
[основной подход, обоснование, ожидаемые сроки]
## Препараты и дозировки
[конкретные назначения: форма, доза, время приёма, длительность]
## Кофакторы и антагонисты
[что усиливает эффект, что НЕ совмещать]
## Диета
[рекомендации по питанию в контексте цели]
## Контрольные точки
[когда и какие анализы сдать повторно, целевые значения]
## Красные флаги
[при каких симптомах СРОЧНО к врачу]
## Правила для ассистента
[как вести разговор: вопросы, внимание к побочкам, когда менять тактику]

СТИЛЬ: Строгий, evidence-based. Все дозировки — с обоснованием.
ОБЪЁМ: Максимум 800 слов.
ЯЗЫК: Русский.
ОБЯЗАТЕЛЬНО: Укажи что это план САМОКОНТРОЛЯ, НЕ замена врачу.`;

function calculateAge(birthdate: string): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();
    const { id, user_id, title, steps, diagnosis_basis, category } = payload.record;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Mark as generating
    await supabase.from("user_active_skills")
      .update({ document_status: "generating" })
      .eq("id", id);

    // Fetch user profile for personalization
    const { data: profile } = await supabase
      .from("profiles")
      .select("sex, birthdate, chronic_conditions")
      .eq("id", user_id)
      .single();

    const age = profile?.birthdate ? calculateAge(profile.birthdate) : null;

    // Build context for OpenAI
    const userContext = JSON.stringify({
      goal: title,
      category,
      steps: steps || [],
      diagnosis: diagnosis_basis || {},
      patient: {
        sex: profile?.sex || "unknown",
        age: age,
        conditions: profile?.chronic_conditions || []
      }
    });

    // Generate skill document via OpenAI
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY not set");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SKILL_GENERATION_PROMPT },
          { role: "user", content: userContext }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    const skillDocument = result.choices?.[0]?.message?.content;

    if (!skillDocument) {
      throw new Error("Empty response from OpenAI");
    }

    // Generate embedding via Supabase.ai (FREE — runs on edge runtime)
    const embeddingInput = `${title} ${category} ${skillDocument.substring(0, 500)}`;
    const embedding = await model.run(embeddingInput, {
      mean_pool: true,
      normalize: true,
    });

    // Store document + embedding
    const { error: updateError } = await supabase.from("user_active_skills")
      .update({
        skill_document: skillDocument,
        skill_embedding: JSON.stringify(embedding),
        document_status: "ready"
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(`Failed to update skill: ${updateError.message}`);
    }

    console.log(`[generate-skill-document] SUCCESS for skill ${id}`);
    return new Response(JSON.stringify({ success: true, skill_id: id }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`[generate-skill-document] ERROR:`, error);

    // Try to mark as failed
    try {
      const payload = await req.clone().json();
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("user_active_skills")
        .update({ document_status: "failed" })
        .eq("id", payload.record.id);
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
