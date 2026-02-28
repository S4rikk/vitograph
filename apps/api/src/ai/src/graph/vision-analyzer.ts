import { callLlmStructured, LLM_TIMEOUTS, LLM_RETRIES } from "../llm-client.js";
import { SomaticDiagnosticsOutputSchema, type SomaticDiagnosticsOutput } from "../ai-schemas.js";
import { createClient } from "@supabase/supabase-js";

const SYSTEM_PROMPTS: Record<"nails" | "tongue" | "skin", string> = {
  nails: `You are a strict, medical-grade Vision AI specialist in visual nail diagnostics.
ROLE: Analyze the provided photo of patient nails (without polish) to identify any of the 11 key visual markers from the medical specification.

MARKERS TO LOOK FOR:
- Leukonychia (White spots/lines)
- Longitudinal striations (Vertical ridges)
- Beau's lines (Transverse grooves)
- Onychorrhexis (Brittle, splitting nails)
- Terry's nails (Pale nail bed)
- Koilonychia (Spoon-shaped nails)
- Yellow nail syndrome
- Absent lunula (No white moons)
- Red lunula
- Clubbing (Hippocratic fingers)
- Pitting (Thimble-like depressions)

CONSTRAINTS:
- Do NOT make definitive medical diagnoses.
- Return ONLY the markers you are reasonably confident are present.
- In 'interpretation', speak as a supportive AI friend (in Russian). Example: "Я проанализировал твое фото ногтей. Вижу продольные борозды — это частый признак нехватки белка и железа..."
`,
  tongue: `You are a strict, medical-grade Vision AI specialist in visual tongue diagnostics.
ROLE: Analyze the provided photo of the patient's tongue to identify any key visual markers.

MARKERS TO LOOK FOR:
- Белый налет (White coating)
- Желтый налет (Yellow coating)
- Отпечатки зубов по краям (Teeth marks/Scalloped tongue - indicative of thyroid/edema)
- Трещины/бороздки (Cracks/fissures - indicative of B-vitamin deficiency)
- "Географический язык" (Geographic tongue - indicative of inflammation/GI issues)
- Бледность (Paleness - indicative of anemia)
- Ярко-красный цвет (Bright red color - indicative of B12 deficiency)

CONSTRAINTS:
- Do NOT make definitive medical diagnoses.
- Return ONLY the markers you are reasonably confident are present.
- In 'interpretation', speak as a supportive AI friend (in Russian). Example: "Я проанализировал твое фото языка. Заметил отпечатки зубов по краям..."
`,
  skin: `You are a strict, medical-grade Vision AI specialist in visual skin diagnostics.
ROLE: Analyze the provided photo of the patient's skin to identify any key visual markers.

MARKERS TO LOOK FOR:
- Акне/высыпания (Acne/breakouts - indicative of zinc, vit A, hormones)
- Бледность (Paleness - indicative of iron deficiency)
- Сухость/шелушение (Dryness/flakiness - indicative of Omega-3 deficiency, hypothyroidism)
- Гиперпигментация (Hyperpigmentation - indicative of insulin resistance/cortisol)

CONSTRAINTS:
- Do NOT make definitive medical diagnoses.
- Return ONLY the markers you are reasonably confident are present.
- In 'interpretation', speak as a supportive AI friend (in Russian). Example: "Я проанализировал твое фото кожи. Вижу склонность к сухости..."
`
};

const VISION_FALLBACK: SomaticDiagnosticsOutput = {
  markers: [],
  interpretation: "Не удалось проанализировать фото в данный момент.",
  confidence: 0,
};

/**
 * Invokes the GPT-4o Vision model using an image URL and appends the 
 * analysis result to the user's history log in the database (capped at 5).
 */
export async function runSomaticVisionAnalyzer(
  imageUrl: string,
  userId: string,
  token: string,
  bodyPart: "nails" | "tongue" | "skin"
): Promise<SomaticDiagnosticsOutput> {
  const bodyPartNames = { nails: "nails", tongue: "tongue", skin: "skin" };
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: `Please analyze this image of my ${bodyPartNames[bodyPart]}.` },
        { type: "image", image: new URL(imageUrl) }
      ]
    }
  ];

  const result = await callLlmStructured({
    schema: SomaticDiagnosticsOutputSchema,
    schemaName: "somatic_diagnostics",
    systemPrompt: SYSTEM_PROMPTS[bodyPart],
    messages: messages,
    timeoutMs: LLM_TIMEOUTS.async,
    maxRetries: LLM_RETRIES.sync,
    fallback: VISION_FALLBACK,
    temperature: 0.2, // Low temp for clinical vision
  });

  if (result.source === "fallback") {
    console.warn("[AI:SomaticVisionNode] Using fallback — LLM unavailable");
    return result.data;
  }

  // Save to Database History Log
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Fetch current profile to append to history
    const { data: profile } = await supabase.from("profiles").select("lifestyle_markers").eq("id", userId).single();
    if (profile) {
      const markers = profile.lifestyle_markers as Record<string, any> || {};
      markers.somatic_data = markers.somatic_data || {};
      markers.somatic_data[bodyPart] = result.data.markers; // Update current state

      // Append to history and keep last 5
      const historyKey = `${bodyPart}_analysis_history`;
      const historyLog = markers.somatic_data[historyKey] || [];
      historyLog.push({
        timestamp: new Date().toISOString(),
        imageUrl: imageUrl, // Safe since it's an authenticated public URL
        analysis: result.data
      });
      markers.somatic_data[historyKey] = historyLog.slice(-5); // Keep only last 5 entries

      await supabase.from("profiles").update({ lifestyle_markers: markers }).eq("id", userId);
      console.log(`[SomaticVisionNode] Updated user ${userId} ${historyKey}. Total entries: ${markers.somatic_data[historyKey].length}`);
    }
  }

  return result.data;
}
