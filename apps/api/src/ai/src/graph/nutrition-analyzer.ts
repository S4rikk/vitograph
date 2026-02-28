import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const TargetSchema = z.object({
    macros: z.object({
        calories: z.number().describe("Target daily calorie intake"),
        protein: z.number().describe("Target daily protein in grams"),
        fat: z.number().describe("Target daily fat in grams"),
        carbs: z.number().describe("Target daily carbohydrates in grams")
    }).describe("Daily macronutrient targets"),
    micros: z.array(z.object({
        name: z.string().describe("EXACT Nutrient name in Russian WITHOUT units (must be exactly one of: 'Калий', 'Магний', 'Витамин A', 'Витамин B12', 'Цинк', 'Натрий', 'Витамин C', 'Железо', 'Кальций', 'Витамин D', 'Фолиевая кислота', 'Витамин E', 'Селен', 'Витамин B6', 'Йод', 'Фосфор', 'Омега-3')"),
        amount: z.number().describe("Target amount (number only) based on standard clinical units for that nutrient")
    })).describe("List of specific micronutrient targets. You MUST include ALL the 17 standard nutrients listed above, adjusting their amounts based on the user's data."),
    rationale: z.string().describe("A 2-3 sentence explanation in Russian explaining why these specific targets were set based on the user's data.")
});

export async function runNutritionAnalyzer(userId: string, token: string) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // 1. Gather User Context
    const [profileRes, resultsRes, kbRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("test_results")
            .select("*, biomarkers(name_en, name_ru, unit)")
            .eq("user_id", userId)
            .order("test_date", { ascending: false })
            .limit(30),
        supabase.from("active_condition_knowledge_bases")
            .select("*")
            .eq("profile_id", userId)
            .eq("is_active", true)
    ]);

    if (profileRes.error || !profileRes.data) {
        throw new Error("User profile not found");
    }

    const profile = profileRes.data;
    const recentTests = resultsRes.data || [];
    const knowledgeBases = kbRes.data || [];

    // Filter for anomalous test results if possible (simple heuristic: look for notes or rely on LLM to read values)
    const testsSummary = recentTests.map(t =>
        `- ${t.biomarkers?.name_ru || t.biomarkers?.name_en || 'Unknown Biomarker'}: ${t.value} ${t.unit} (Date: ${t.test_date})`
    ).join("\n");

    const kbSummary = knowledgeBases.map(kb =>
        `Condition: ${kb.condition_name} (Severity: ${kb.severity})\nKnowledge Data: ${JSON.stringify(kb.knowledge_data)}`
    ).join("\n\n");

    const somaticData = profile.lifestyle_markers?.somatic_data || {};
    const somaticSummary = Object.entries(somaticData).map(([key, value]: [string, any]) => {
        if (value && typeof value === 'object' && value.markers) {
            return `${key}: ${value.markers.join(", ")}`;
        }
        return "";
    }).filter(Boolean).join("\n");

    // 2. Prepare Context for LLM
    const systemPrompt = `You are an expert clinical nutritionist and endocrinologist.
Your task is to generate personalized daily nutrition targets (macros and micros) for a user based on their profile, lab test results, somatic signs, and active clinical knowledge bases.

Guidelines:
1. Baseline calculation: Start with the user's basic profile (weight, height, age, activity level) and the provided STANDARD Base Targets.
2. Clinical adjustments: Modify these standard targets ONLY IF there are specific diseases, symptoms, or deficiencies in the user context (e.g., increase iron or Vitamin C if there's latent anemia, reduce carbs if there's insulin resistance). If the user is healthy, return values close to the baseline.
3. The response MUST adhere to the provided JSON schema.
4. The \`rationale\` property should be in Russian and clearly explain *why* these targets differ from the standard base targets (mention specific conditions or test results). Provide direct, actionable context for the user.`;

    const standardBaseMacros = {
        calories: profile.biological_sex === 'female' ? 2000 : 2500,
        protein: profile.weight_kg ? Math.round(profile.weight_kg * 1.5) : 100,
        fat: profile.biological_sex === 'female' ? 60 : 80,
        carbs: profile.biological_sex === 'female' ? 200 : 250
    };

    const standardBaseMicros = {
        "Калий": 3500, "Магний": 400, "Витамин A": 900, "Витамин B12": 2.4,
        "Цинк": 11, "Натрий": 1500, "Витамин C": 90, "Железо": profile.biological_sex === 'female' ? 18 : 8,
        "Кальций": 1000, "Витамин D": 15, "Фолиевая кислота": 400, "Витамин E": 15,
        "Селен": 55, "Витамин B6": 1.3, "Йод": 150, "Фосфор": 700, "Омега-3": 1.1
    };

    const humanPayload = `
### Standard Base Targets (Modify these based on clinical data)
- Macros: ${JSON.stringify(standardBaseMacros)}
- Micros: ${JSON.stringify(standardBaseMicros)}

### User Profile
- Sex: ${profile.biological_sex}
- Age: ${profile.date_of_birth ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear() : 'Unknown'}
- Weight: ${profile.weight_kg} kg
- Height: ${profile.height_cm} cm
- Activity Level: ${profile.activity_level}
- Stress Level: ${profile.stress_level}
- Diet Type: ${profile.diet_type || 'Unknown'}
- Climate Zone: ${profile.climate_zone || 'Unknown'}
- Sun Exposure: ${profile.sun_exposure || 'Unknown'}
- Alcohol Frequency: ${profile.alcohol_frequency || 'Unknown'}
- Is Smoker: ${profile.is_smoker ? 'Yes' : 'No'}
- Pregnancy Status: ${profile.pregnancy_status || 'not_applicable'}
- Work Lifestyle: ${profile.work_lifestyle || 'Unknown'}
- Physical Activity (min/week): ${profile.physical_activity_minutes_weekly || 'Unknown'}

### Active Medical Conditions (Knowledge Bases)
${kbSummary || "None"}

### Recent Lab Test Results
${testsSummary || "None"}

### Somatic Physical Signs
${somaticSummary || "None"}

Generate the JSON with macros, micros, and rationale based on adjusting the Standard Base Targets.`;

    // 3. Call LLM
    const model = new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0.1,
    }).withStructuredOutput(TargetSchema);

    console.log(`[Nutrition Analyzer] Formulating targets for user ${userId}...`);

    const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(humanPayload),
    ]);

    // 4. Transform micros array to a record for DB/Frontend compatibility
    const microsRecord: Record<string, number> = {};
    for (const item of response.micros) {
        microsRecord[item.name] = item.amount;
    }

    const finalResponse = {
        ...response,
        micros: microsRecord
    };

    // 5. Save back to database
    const { error: updateError } = await supabase
        .from("profiles")
        .update({ active_nutrition_targets: finalResponse })
        .eq("id", userId);

    if (updateError) {
        throw new Error(`Failed to save nutrition targets to DB: ${updateError.message}`);
    }

    return finalResponse;
}
