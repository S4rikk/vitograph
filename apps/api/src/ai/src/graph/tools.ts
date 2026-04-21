import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pythonCore } from "../lib/python-core.js";
import { createClient } from "@supabase/supabase-js";
import { embeddings } from "../services/memory.service.js";

// ── Singleton admin Supabase client (for GI cache writes, bypasses RLS) ──
const supabaseAdmin = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createClient(url, key);
  console.warn('[tools.ts] SUPABASE_SERVICE_ROLE_KEY not set — GI cache disabled');
  return null;
})();

/**
 * Tool for calculating dynamic biomarker norms.
 * Binds our internal pythonCore HTTP client to a LangChain tool.
 */
export const calculateNormsTool = new DynamicStructuredTool({
  name: "calculate_biomarker_norms",
  description:
    "Calculates personalized optimal ranges (norms) for a specific medical biomarker based on a patient's profile variables like age, smoking status, etc. Always use this to get medical reference ranges.",
  schema: z.object({
    biomarker: z
      .string()
      .describe(
        "The exact name of the biomarker to calculate norms for (e.g., 'Vitamin C', 'Ferritin')."
      ),
    age: z.number().describe("The user's age in years."),
    is_smoker: z
      .boolean()
      .default(false)
      .describe("True if the user smokes tobacco."),
    is_pregnant: z
      .boolean()
      .default(false)
      .describe("True if the user is pregnant."),
  }),
  func: async ({ biomarker, age, is_smoker, is_pregnant }) => {
    try {
      console.log(`[Tool: calculate_biomarker_norms] Calling Python for ${biomarker}`);
      const result = await pythonCore.calculateNormsAction(biomarker, {
        age,
        is_smoker,
        is_pregnant,
      });
      return JSON.stringify(result);
    } catch (error) {
      console.error(`[Tool: calculate_biomarker_norms] Error:`, error);
      return `Failed to calculate norm: ${(error as Error).message}`;
    }
  },
});

export const updateProfileTool = new DynamicStructuredTool({
  name: "update_user_profile",
  description: "Updates the user's lifestyle markers in the database. Use this when the user mentions a lifestyle change (e.g., sleeping less, starting to run, moving to a new city). ALWAYS confirm update success to the user.",
  schema: z.object({
    field_name: z.string().describe("The name of the marker to update (e.g. 'sleep_hours', 'activity_level', 'stress_level')"),
    new_value: z.any().describe("The new value for the marker")
  }),
  func: async ({ field_name, new_value }, runManager, config) => {
    const userId = config?.configurable?.user_id;
    const token = config?.configurable?.token;

    if (!userId || !token) {
      return "Error: User context not available. Cannot update profile.";
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return "Server Database Error.";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Fetch current lifestyle_markers
    const { data: profile } = await supabase.from("profiles").select("lifestyle_markers").eq("id", userId).single();
    const markers = profile?.lifestyle_markers || {};

    // Treat markers as Record<string, any> safely
    (markers as Record<string, any>)[field_name] = new_value;

    const { error } = await supabase.from("profiles").update({ lifestyle_markers: markers }).eq("id", userId);
    if (error) return `Failed to update profile: ${error.message}`;

    return `Successfully updated ${field_name} to ${new_value} in user profile.`;
  }
});

export const logMealTool = new DynamicStructuredTool({
  name: "log_meal",
  description: "Logs a food item into the user's daily meal diary. You MUST estimate calories, macros, micronutrients, AND glycemic data (glycemic_index, response_type, peak_time_min, energy_duration_hours). Evaluate meal healthiness with meal_quality_score (0-100). After successful logging, preserve the <meal_id/> tag. GLYCEMIC DATA IS CRITICAL — always provide glycemic_index and response_type for every food item.",
  schema: z.object({
    meal_type: z.enum(["breakfast", "lunch", "dinner", "snack", "drink"]).describe("The category of the meal"),
    food_name: z.string().describe("The name of the food eaten (e.g. 'Oatmeal', 'Chicken Breast')"),
    weight_g: z.number().describe("The total weight of the consumed food in grams"),
    calories: z.number().describe("Estimated total calories"),
    protein_g: z.number().describe("Estimated total protein in grams"),
    fat_g: z.number().describe("Estimated total fat in grams"),
    carbs_g: z.number().describe("Estimated total carbohydrates in grams"),
    meal_quality_score: z.number().optional().describe("REQUIRED. A score from 0-100 indicating the nutritional quality/healthiness of the meal."),
    meal_quality_reason: z.string().optional().describe("REQUIRED. A short explanation of the meal quality score in Russian."),
    source: z.string().optional().describe("Source of the log (e.g., 'photo', 'manual')"),
    glycemic_index: z.number().min(0).max(100).optional().describe(
      "ALWAYS PROVIDE. Estimated Glycemic Index of the food (0-100). Low: 0-55, Medium: 56-69, High: 70+. " +
      "Use standard GI tables. IMPORTANT: Apply biochemical modifiers! If starchy food (potato, rice, pasta) is cold/cooled, lower GI by ~25-30 down to moderate (Resistant Starch). If acid/vinegar is present, lower GI by ~15-20%. If large amounts of fat/fiber are present, lower GI by ~10%."
    ),
    insulin_index: z.number().min(0).max(150).optional().describe(
      "Insulin Index (0-150). Only specify if significantly different from GI (e.g., dairy products have high II ~90-100 but low GI ~30). Otherwise omit."
    ),
    response_type: z.enum(["flat", "moderate", "spike"]).optional().describe(
      "ALWAYS PROVIDE. Insulin response type. flat: GI < 40 (slow glucose release, steady energy). moderate: GI 40-69. spike: GI 70+ (rapid glucose surge, 'sugar needle')."
    ),
    peak_time_min: z.number().min(5).max(180).optional().describe(
      "ALWAYS PROVIDE. Minutes until predicted glucose peak after eating. Typical: 15-30 for spike, 30-60 for moderate, 45-90 for flat."
    ),
    energy_duration_hours: z.number().min(0.5).max(8).optional().describe(
      "ALWAYS PROVIDE. How long the food provides sustained energy in hours. High-GI: 0.5-1.5h, Low-GI: 3-6h, Protein+Fat rich: 4-8h."
    ),
    cooking_method: z.enum([
      "raw", "boiled", "steamed", "fried", "grilled",
      "baked", "deep_fried", "microwaved", "stewed", "unknown"
    ]).optional().describe(
      "How the food was prepared. CRITICAL for GI accuracy. " +
      "Boiled potato GI=78, fried=95, baked=85. Al dente pasta GI=45, overcooked=65. " +
      "Raw vegetables GI is lower than cooked. If user didn't specify, use 'unknown'."
    ),
    micronutrients: z.object({
      vitamin_a_mcg: z.number().optional().describe("Vitamin A (mcg). DO NOT translate key."),
      vitamin_c_mg: z.number().optional().describe("Vitamin C (mg). DO NOT translate key."),
      vitamin_d_mcg: z.number().optional().describe("Vitamin D (mcg). DO NOT translate key."),
      vitamin_e_mg: z.number().optional().describe("Vitamin E (mg). DO NOT translate key."),
      vitamin_b12_mcg: z.number().optional().describe("Vitamin B12 (mcg). DO NOT translate key."),
      folate_mcg: z.number().optional().describe("Folate / Folic Acid (mcg). DO NOT translate key."),
      iron_mg: z.number().optional().describe("Iron (mg). DO NOT translate key."),
      calcium_mg: z.number().optional().describe("Calcium (mg). DO NOT translate key."),
      magnesium_mg: z.number().optional().describe("Magnesium (mg). DO NOT translate key."),
      zinc_mg: z.number().optional().describe("Zinc (mg). DO NOT translate key."),
      selenium_mcg: z.number().optional().describe("Selenium (mcg). DO NOT translate key."),
      potassium_mg: z.number().optional().describe("Potassium (mg). DO NOT translate key."),
      sodium_mg: z.number().optional().describe("Sodium (mg). DO NOT translate key.")
    }).optional().describe("Estimated vitamins and minerals based on weight. Provide absolute values. NEVER leave empty if food contains them. DO NOT TRANSLATE JSON KEYS INTO RUSSIAN.")
  }),
  func: async ({ meal_type, food_name, weight_g, calories, protein_g, fat_g, carbs_g, micronutrients, meal_quality_score, meal_quality_reason, source, glycemic_index, insulin_index, response_type, peak_time_min, energy_duration_hours, cooking_method }, runManager, config) => {
    const userId = config?.configurable?.user_id;
    const token = config?.configurable?.token;
    const ctx = config?.configurable?.nutritionalContext;

    if (!userId || !token) {
      return "Error: User context not available. Cannot log meal without user auth.";
    }

    // ── RED ZONE GUARD (code-level guarantee) ──────────────────────────
    // If meal_quality_score ≤ 40, REJECT the log and force the LLM to
    // explain risks and ask for user confirmation first.
    // The redZoneConfirm flag is generated by the frontend UI, NOT the LLM.
    const isRedZoneConfirmed = config?.configurable?.redZoneConfirm === true;
    if (meal_quality_score != null && meal_quality_score <= 40 && !isRedZoneConfirmed) {
      const reasons = [];
      if (glycemic_index && glycemic_index >= 70) reasons.push('high GI (sugar spike)');
      if (cooking_method === 'deep_fried' || cooking_method === 'fried') reasons.push('fried food (trans fats, LDL cholesterol risk)');
      if (meal_quality_reason) reasons.push(meal_quality_reason);
      
      return `⚠️ RED ZONE BLOCKED (score: ${meal_quality_score}/100). This meal was NOT logged yet. `
        + `Detected risks: ${reasons.join('; ') || 'low nutritional quality'}. `
        + `You MUST now explain to the user IN RUSSIAN why this food is harmful using vivid, accessible language. `
        + `Describe the specific health risks (e.g., trans fats from frying damage blood vessels, high GI causes energy crash). `
        + `Then conclude by saying: "Уверен? Если хочешь обсудить варианты замены — задай вопрос Ассистенту в соседней вкладке." Do NOT ask open-ended questions like "What do you want instead?" because this Diary mode does not support branching dialogues. `
        + `At the END of your message, you MUST append this exact tag (replacing values): <red_zone_confirm food="${food_name}" weight="${weight_g}"/> `
        + `If the user confirms, the system will handle the override explicitly. `
        + `Do NOT suggest smoothing tips — that becomes an excuse for junk food. `
        + `After logging, recommend what to eat NEXT to balance today's intake.`;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return "Server Database Error.";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    let finalCalories = Number(calories);
    let finalProtein = Number(protein_g);
    let finalFat = Number(fat_g);
    let finalCarbs = Number(carbs_g);
    let finalMicros: Record<string, number> = {};
    let finalScore = meal_quality_score;
    let finalReason = meal_quality_reason;
    let finalSource = source || "manual";

    if (ctx?.fullVisionResult) {
      const res = ctx.fullVisionResult;
      const totalEstimatedWeight = res.items?.reduce((sum: number, i: any) => sum + (i.estimated_weight_g || 0), 0) || 0;
      const scaleRatio = totalEstimatedWeight > 0 ? ((ctx.userEnteredWeight || totalEstimatedWeight) / totalEstimatedWeight) : 1;
      
      const mapping: Record<string, string> = {
        vitamin_a_mcg: "Витамин A (мкг)",
        vitamin_c_mg: "Витамин C (мг)",
        vitamin_d_mcg: "Витамин D (мкг)",
        vitamin_e_mg: "Витамин E (мг)",
        vitamin_b12_mcg: "Витамин B12 (мкг)",
        folate_mcg: "Фолиевая кислота (мкг)",
        iron_mg: "Железо (мг)",
        calcium_mg: "Кальций (мг)",
        magnesium_mg: "Магний (мг)",
        zinc_mg: "Цинк (мг)",
        selenium_mcg: "Селен (мкг)",
        potassium_mg: "Калий (мг)",
        sodium_mg: "Натрий (мг)"
      };

      // 1. Aggregate Micronutrients from all items (SCALED)
      res.items?.forEach((item: any) => {
        const itemWeightFactor = (item.estimated_weight_g || 0) / 100;
        if (item.per_100g) {
          Object.entries(item.per_100g).forEach(([key, val]) => {
            if (typeof val === 'number' && mapping[key]) {
               finalMicros[mapping[key]] = (finalMicros[mapping[key]] || 0) + (val * itemWeightFactor * scaleRatio);
            }
          });
        }
      });

      // 2. Aggregate Active Ingredients from all supplements (UNSCALED)
      if (res.supplements) {
        res.supplements.forEach((s: any) => {
          s.active_ingredients?.forEach((ing: any) => {
            const key = `${ing.ingredient_name} (${ing.unit})`;
            finalMicros[key] = (finalMicros[key] || 0) + ing.amount;
          });
        });
      }
      
      if (!finalScore && res.meal_quality_score) finalScore = res.meal_quality_score;
      if (!finalReason && res.meal_quality_reason) finalReason = res.meal_quality_reason;
      finalSource = "photo";
    }

    // 3. Fallback/Augment with AI provided micros if context missing or for specific items
    if (micronutrients && Object.keys(finalMicros).length === 0) {
      if (micronutrients.vitamin_a_mcg) finalMicros["Витамин A (мкг)"] = micronutrients.vitamin_a_mcg;
      if (micronutrients.vitamin_c_mg) finalMicros["Витамин C (мг)"] = micronutrients.vitamin_c_mg;
      if (micronutrients.vitamin_d_mcg) finalMicros["Витамин D (мкг)"] = micronutrients.vitamin_d_mcg;
      if (micronutrients.vitamin_e_mg) finalMicros["Витамин E (мг)"] = micronutrients.vitamin_e_mg;
      if (micronutrients.vitamin_b12_mcg) finalMicros["Витамин B12 (мкг)"] = micronutrients.vitamin_b12_mcg;
      if (micronutrients.folate_mcg) finalMicros["Фолиевая кислота (мкг)"] = micronutrients.folate_mcg;
      if (micronutrients.iron_mg) finalMicros["Железо (мг)"] = micronutrients.iron_mg;
      if (micronutrients.calcium_mg) finalMicros["Кальций (мг)"] = micronutrients.calcium_mg;
      if (micronutrients.magnesium_mg) finalMicros["Магний (мг)"] = micronutrients.magnesium_mg;
      if (micronutrients.zinc_mg) finalMicros["Цинк (мг)"] = micronutrients.zinc_mg;
      if (micronutrients.selenium_mcg) finalMicros["Селен (мкг)"] = micronutrients.selenium_mcg;
      if (micronutrients.potassium_mg) finalMicros["Калий (мг)"] = micronutrients.potassium_mg;
      if (micronutrients.sodium_mg) finalMicros["Натрий (мг)"] = micronutrients.sodium_mg;
    }

    const isoNow = new Date().toISOString();
    
    if (finalCalories === 0 && (weight_g > 0 || ctx?.userEnteredWeight > 0)) {
      console.warn('[Tool:log_meal] POSSIBLE MAPPING FAILURE: 0 calories calculated for positive weight.', { food_name, weight_g, ctxWeight: ctx?.userEnteredWeight });
    }

    console.log('[Tool:log_meal] Attempting insert:', { userId, meal_type, food_name, finalCalories, isoNow });
    
    // 1. Create Meal Log
    const { data: log, error: logError } = await supabase.from("meal_logs").insert({
      user_id: userId,
      meal_type: meal_type,
      total_calories: Number(finalCalories.toFixed(1)),
      total_protein: Number(finalProtein.toFixed(1)),
      total_fat: Number(finalFat.toFixed(1)),
      total_carbs: Number(finalCarbs.toFixed(1)),
      micronutrients: finalMicros,
      meal_quality_score: finalScore,
      glycemic_load_total: (glycemic_index != null && finalCarbs > 0) ? Number(((glycemic_index * finalCarbs) / 100).toFixed(1)) : null,
      response_type: response_type ?? null,
    }).select("id");
    
    if (logError || !log || log.length === 0) {
      console.error('[Tool:log_meal] INSERT FAILED:', logError || 'Empty result');
      return `Failed to create meal log: ${logError?.message || 'Empty result'}`;
    }
    const logId = log[0].id;

    // 2. Add Meal Item
    const { error: itemError } = await supabase.from("meal_items").insert({
      meal_log_id: logId,
      food_name: food_name,
      weight_g: weight_g,
      calories: Number(finalCalories.toFixed(1)),
      protein_g: Number(finalProtein.toFixed(1)),
      fat_g: Number(finalFat.toFixed(1)),
      carbs_g: Number(finalCarbs.toFixed(1)),
      glycemic_index: glycemic_index ?? null,
      glycemic_load: (glycemic_index != null && finalCarbs > 0) ? Number(((glycemic_index * finalCarbs) / 100).toFixed(1)) : null,
      insulin_index: insulin_index ?? null,
      response_type: response_type ?? null,
      peak_time_min: peak_time_min ?? null,
      energy_duration_hours: energy_duration_hours ?? null,
      cooking_method: cooking_method ?? null,
    });

    if (itemError) return `Failed to add meal item: ${itemError.message}`;

    // ── GI Cache: Save for future lookups (non-blocking) ──
    if (glycemic_index != null && supabaseAdmin) {
      const normalizedKey = food_name.toLowerCase().trim();
      supabaseAdmin.from("food_glycemic_cache").upsert({
        food_name_key: normalizedKey,
        glycemic_index,
        insulin_index: insulin_index ?? null,
        response_type: response_type ?? 'moderate',
        peak_time_min: peak_time_min ?? 30,
        energy_duration_hours: energy_duration_hours ?? 2.0,
        source: 'llm',
        confidence: 0.7,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'food_name_key' })
        .then(() => console.log(`[Tool:log_meal] GI cached for: ${normalizedKey}`))
        .catch((err: any) => console.warn('[Tool:log_meal] GI cache write failed (non-blocking):', err));
    }

    const mappingUnits: Record<string, string> = {
      "Витамин A (мкг)": "мкг", "Витамин C (мг)": "мг", "Витамин D (мкг)": "мкг",
      "Витамин E (мг)": "мг", "Витамин B12 (мкг)": "мкг", "Фолиевая кислота (мкг)": "мкг",
      "Железо (мг)": "мг", "Кальций (мг)": "мг", "Магний (мг)": "мг", "Цинк (мг)": "мг",
      "Селен (мкг)": "мкг", "Калий (мг)": "мг", "Натрий (мг)": "мг"
    };

    const microsList = Object.entries(finalMicros).map(([k, v]) => {
      const unit = mappingUnits[k] || "";
      return `${k} (${v.toFixed(1)}${unit})`;
    }).join(', ');

    const giLabel = response_type === 'spike' ? '▲ Spike' : response_type === 'flat' ? '▬ Flat' : '↗ Moderate';
    const responseWord = response_type === 'spike' ? 'spike' : response_type === 'flat' ? 'flat' : 'moderate';
    const energyLabel = energy_duration_hours ? `${energy_duration_hours}h energy` : '';

    // ── Technical parseable line (CRITICAL for FoodCard rendering) ──
    // Frontend parser relies on this EXACT format: "Записал [вес]г [название] | GI:[число] | [flat/moderate/spike] | [часы]ч энергии"
    const technicalLine = `Записал ${weight_g}г ${food_name} | GI:${glycemic_index ?? '?'} | ${responseWord} | ${energy_duration_hours ?? '?'}ч энергии`;

    let baseResponse = `Successfully logged ${weight_g}g of ${food_name} (GI: ${glycemic_index ?? '?'}, Response: ${giLabel}${energyLabel ? ', ' + energyLabel : ''}) for ${meal_type}. AI INSTRUCTION: Do NOT mention calories, КБЖУ, or macros (protein/fat/carbs) to the user. Focus ONLY on glycemic impact, response type, and energy duration. CRITICAL: You MUST include this EXACT technical line at the END of your response (after your human text): ${technicalLine}`;

    if (microsList.length > 0) {
      baseResponse += ` Micronutrients found: ${microsList}. AI INSTRUCTION: You MUST mention these micronutrients in your final response to the user. When mentioning them in the main text, use <nutr type="marker">Name</nutr>. IN THE TECHNICAL BLOCK AT THE END, you MUST wrap each micronutrient name and value in a strict XML tag: <nutr type="micro">[Name] ([Value])</nutr>. Valid types for the main text are: iron, magnesium, vitamin_c, vitamin_b, omega, calcium, marker.`;
    } else {
      baseResponse += ` Confirm this back to the user.`;
    }

    if (finalScore !== undefined && finalScore !== null) {
      baseResponse += ` AI INSTRUCTION: You MUST append the following xml tag exactly as is at the end of your response: <meal_score score="${finalScore}" reason="${finalReason || ''}" />`;
    }

    // ── Post-log impact note (for direct logs where preview was skipped) ──
    const peakEstimate = peak_time_min ?? 30;
    const scoreVal = finalScore ?? 50;
    baseResponse += ` AI INSTRUCTION (POST-LOG IMPACT): In your response, include a brief glycemic impact note in 1-2 natural sentences: predicted peak in ~${peakEstimate} minutes. ${scoreVal > 40 ? 'You may suggest ONE brief smoothing tip if GI is elevated. ' : 'This meal scored ' + scoreVal + '/100 (red zone). Do NOT suggest smoothing for THIS meal — instead briefly recommend what to eat NEXT to help balance today\'s intake. '}Do NOT use lists or markdown. Keep it conversational.`;

    baseResponse += ` <meal_id id="${logId}" />`;

    return baseResponse;
  }
});

export const log_supplement_intake_tool = new DynamicStructuredTool({
  name: "log_supplement_intake",
  description: "Logs the intake of a supplement from the user's protocol.",
  schema: z.object({
    supplement_name: z.string().describe("The name of the supplement (e.g., 'Omega-3', 'Zinc')"),
    dosage: z.string().describe("The dosage taken (e.g., '1000mg', '1 pill')"),
    was_on_time: z.boolean().describe("Whether the intake was according to the schedule")
  }),
  func: async ({ supplement_name, dosage, was_on_time }, runManager, config) => {
    const userId = config?.configurable?.user_id;
    const token = config?.configurable?.token;

    if (!userId || !token) {
      return "Error: User context not available. Cannot log supplement intake.";
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return "Server Database Error.";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { error } = await supabase.from("supplement_logs").insert({
      user_id: userId,
      supplement_name,
      dosage_taken: dosage,
      was_on_time,
      taken_at: new Date().toISOString(),
      source: "assistant"
    });

    if (error) return `Failed to log supplement intake: ${error.message}`;

    return `Successfully logged intake of ${supplement_name} (${dosage}).`;
  }
});

export const get_today_diary_summary = new DynamicStructuredTool({
  name: "get_today_diary_summary",
  description: "Fetches the user's food diary for today. Includes all meal logs and glycemic data. ALWAYS call this tool when the user asks about their diet or what they ate today. NEVER mention calories, КБЖУ, or macros to the user — focus on glycemic impact, response type, and energy duration.",
  schema: z.object({
    dummy: z.string().optional().describe("Optional dummy parameter to prevent empty schema errors.")
  }),
  func: async (_, runManager, config) => {
    const userId = config?.configurable?.user_id;
    const token = config?.configurable?.token;

    if (!userId || !token) {
      return "Error: User context not available. Cannot fetch diary.";
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return "Server Database Error.";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const timezone = config?.configurable?.timezone || 'UTC';

    const now = new Date();
    const userLocalStr = now.toLocaleString("en-US", { timeZone: timezone });
    const userLocalTime = new Date(userLocalStr);
    const offsetMs = new Date(userLocalStr).getTime() - now.getTime();

    const startOf5AMLocal = new Date(userLocalTime);
    startOf5AMLocal.setHours(5, 0, 0, 0);

    if (userLocalTime.getHours() < 5) {
      startOf5AMLocal.setDate(startOf5AMLocal.getDate() - 1);
    }

    const startOf5AM_UTC = new Date(startOf5AMLocal.getTime() - offsetMs);
    const startISO = startOf5AM_UTC.toISOString();

    const { data: logs, error } = await supabase
      .from("meal_logs")
      .select(`
        id, logged_at, meal_type, total_carbs, glycemic_load_total, response_type,
        meal_items ( food_name, weight_g, glycemic_index, response_type, peak_time_min, energy_duration_hours )
      `)
      .eq("user_id", userId)
      .gte("logged_at", startISO)
      .order("logged_at", { ascending: true });

    if (error) return `Failed to fetch diary: ${error.message}`;

    if (!logs || logs.length === 0) {
      return JSON.stringify({ message: "You haven't logged any meals today yet.", total_meals: 0 });
    }

    let dailyCarbs = 0;
    let dailyGL = 0;

    const summary = logs.map(log => {
      dailyCarbs += log.total_carbs || 0;
      dailyGL += log.glycemic_load_total || 0;
      return {
        meal_type: log.meal_type,
        time: log.logged_at,
        glycemic_load: log.glycemic_load_total,
        response_type: log.response_type,
        items: log.meal_items?.map((item: any) => `${item.food_name} (${item.weight_g}g, GI:${item.glycemic_index ?? '?'}, ${item.response_type ?? 'moderate'}, ${item.energy_duration_hours ?? '?'}h energy)`) || []
      };
    });

    return JSON.stringify({
      summary_date: startISO,
      total_glycemic_load_today: Math.round(dailyGL * 10) / 10,
      total_meals: logs.length,
      meals: summary,
      ai_instruction: "NEVER mention calories, КБЖУ, or macros (protein/fat/carbs) to the user. Report on glycemic load, response types, and energy duration only."
    });
  }
});

export const manageHealthGoalsTool = new DynamicStructuredTool({
  name: "manage_health_goals",
  description:
    "Manages user health goal journeys (skills). Use this tool to: " +
    "(1) ADD a new goal with a personalized step plan, " +
    "(2) REMOVE/abandon a goal, " +
    "(3) PAUSE or RESUME a goal, " +
    "(4) ADVANCE to the next step after user confirms completion. " +
    "ALWAYS use 'add_with_plan' (not 'add') when creating a new goal — generate 3-7 personalized steps.",
  schema: z.object({
    action: z.enum(["add", "add_with_plan", "remove", "pause", "resume", "advance_step"])
      .describe("Action: add (simple), add_with_plan (with step plan), remove, pause, resume, advance_step"),
    goal_title: z.string().optional().describe("Short goal title (e.g., 'Нормализация ферритина'). REQUIRED for add/add_with_plan. Optional for other actions. CRITICAL: Must be strictly UNIQUE. If the user already has a similar active goal in context, do NOT create a duplicate."),
    category: z.string().optional().describe("Category: iron_deficiency, weight, sleep, nutrition, fitness, habit, vitamin_d, etc."),
    skill_id: z.string().optional().describe("UUID of the existing skill (REQUIRED for remove/pause/resume/advance_step)"),
    diagnosis_basis: z.object({
      source_type: z.string().optional().describe("Source: 'lab_report', 'manual', 'assistant'"),
      pattern: z.string().optional().describe("Diagnosis pattern name (e.g., 'Железодефицитная анемия')"),
      markers: z.array(z.object({
        name: z.string(),
        value: z.number(),
        unit: z.string(),
        status: z.string()
      })).optional().describe("Relevant biomarkers from lab report")
    }).optional().describe("Medical basis for this goal (use for add_with_plan)"),
    steps: z.array(z.object({
      order: z.number(),
      title: z.string(),
      description: z.string().optional()
    })).optional().describe("Personalized step plan (3-7 steps). REQUIRED for add_with_plan.")
  }),
  func: async ({ action, goal_title, category, skill_id, diagnosis_basis, steps }, _runManager, config) => {
    const userId = config?.configurable?.user_id;
    const token = config?.configurable?.token;

    if (!userId || !token) {
      return "Error: User context not available.";
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return "Server Database Error.";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    if (action === "add" || action === "add_with_plan") {
      if (!goal_title) return `Error: goal_title is required for ${action}.`;

      const normalizedTitle = goal_title.trim();
      const { data: existingGoal } = await supabase
        .from("user_active_skills")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .ilike("title", normalizedTitle)
        .limit(1)
        .maybeSingle();

      if (existingGoal) {
        return `Action rejected: An active health goal with the exact title "${normalizedTitle}" already exists (ID: ${existingGoal.id}). Please refer to the existing goal or create a NEW goal with a distinctly different title.`;
      }
    }

    // ── ADD (simple, no plan) ─────────────────────────────────────
    if (action === "add") {
      // Guard: max 3 active skills
      const { count } = await supabase
        .from("user_active_skills")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");

      if ((count ?? 0) >= 3) {
        return "Максимум 3 активных цели. Завершите или приостановите одну из текущих, прежде чем добавлять новую.";
      }

      const { data, error } = await supabase.from("user_active_skills").insert({
        user_id: userId,
        title: goal_title,
        category: category || "general",
        source: "manual",
        steps: [],
        status: "active",
      }).select("id").single();

      if (error) return `Failed to add goal: ${error.message}`;
      return `Цель "${goal_title}" добавлена (id: ${data.id}). Но пока без пошагового плана.`;
    }

    // ── ADD WITH PLAN ─────────────────────────────────────────────
    if (action === "add_with_plan") {
      // Guard: max 3 active skills
      const { count } = await supabase
        .from("user_active_skills")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");

      if ((count ?? 0) >= 3) {
        return "Максимум 3 активных цели. Завершите или приостановите одну из текущих.";
      }
      if (!steps || steps.length === 0) {
        return "Error: steps array is required for add_with_plan.";
      }

      // Format steps with status
      const formattedSteps = steps.map((s, i) => ({
        order: s.order || i + 1,
        title: s.title,
        description: s.description || "",
        status: i === 0 ? "active" : "pending",
        completed_at: null,
      }));

      const { data, error } = await supabase.from("user_active_skills").insert({
        user_id: userId,
        title: goal_title,
        category: category || "general",
        source: diagnosis_basis?.source_type || "assistant",
        diagnosis_basis: diagnosis_basis || {},
        steps: formattedSteps,
        current_step_index: 0,
        status: "active",
      }).select("id").single();

      if (error) return `Failed to create skill: ${error.message}`;

      const stepList = formattedSteps.map(s => `${s.order}. ${s.title}`).join("; ");
      return `Маршрут "${goal_title}" создан (id: ${data.id}). Шаги: ${stepList}. Текущий шаг: 1 — ${formattedSteps[0].title}`;
    }

    // ── REMOVE (abandon) ──────────────────────────────────────────
    if (action === "remove") {
      if (!skill_id) {
        // Fallback: find by title match
        const { data: match } = await supabase
          .from("user_active_skills")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "active")
          .ilike("title", `%${goal_title}%`)
          .limit(1)
          .single();

        if (!match) return `Цель "${goal_title}" не найдена среди активных.`;
        skill_id = match.id;
      }

      const { error } = await supabase
        .from("user_active_skills")
        .update({ status: "abandoned", updated_at: new Date().toISOString() })
        .eq("id", skill_id)
        .eq("user_id", userId);

      if (error) return `Failed to remove goal: ${error.message}`;
      return `Цель "${goal_title}" завершена/удалена.`;
    }

    // ── PAUSE ─────────────────────────────────────────────────────
    if (action === "pause") {
      if (!skill_id) return "Error: skill_id is required for pause.";

      const { error } = await supabase
        .from("user_active_skills")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", skill_id)
        .eq("user_id", userId);

      if (error) return `Failed to pause goal: ${error.message}`;
      return `Цель "${goal_title}" поставлена на паузу.`;
    }

    // ── RESUME ────────────────────────────────────────────────────
    if (action === "resume") {
      if (!skill_id) return "Error: skill_id is required for resume.";

      // Guard: max 3 active skills
      const { count } = await supabase
        .from("user_active_skills")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");

      if ((count ?? 0) >= 3) {
        return "Максимум 3 активных цели. Завершите или приостановите одну, прежде чем возобновлять.";
      }

      const { error } = await supabase
        .from("user_active_skills")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", skill_id)
        .eq("user_id", userId);

      if (error) return `Failed to resume goal: ${error.message}`;
      return `Цель "${goal_title}" снова активна.`;
    }

    // ── ADVANCE STEP ──────────────────────────────────────────────
    if (action === "advance_step") {
      if (!skill_id) return "Error: skill_id is required for advance_step.";

      // Fetch current skill
      const { data: skill, error: fetchErr } = await supabase
        .from("user_active_skills")
        .select("steps, current_step_index, title")
        .eq("id", skill_id)
        .eq("user_id", userId)
        .single();

      if (fetchErr || !skill) return `Skill not found: ${fetchErr?.message || "unknown"}`;

      const currentSteps = Array.isArray(skill.steps) ? [...skill.steps] : [];
      const idx = skill.current_step_index ?? 0;

      // Mark current step as completed
      if (currentSteps[idx]) {
        currentSteps[idx] = {
          ...currentSteps[idx],
          status: "completed",
          completed_at: new Date().toISOString(),
        };
      }

      const nextIdx = idx + 1;
      const isLastStep = nextIdx >= currentSteps.length;

      if (isLastStep) {
        // All steps done — mark skill as completed
        const { error } = await supabase
          .from("user_active_skills")
          .update({
            steps: currentSteps,
            current_step_index: nextIdx,
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", skill_id)
          .eq("user_id", userId);

        if (error) return `Failed to complete skill: ${error.message}`;
        return `🎉 Поздравляю! Все шаги маршрута "${skill.title}" выполнены! Цель завершена!`;
      } else {
        // Activate next step
        if (currentSteps[nextIdx]) {
          currentSteps[nextIdx] = { ...currentSteps[nextIdx], status: "active" };
        }

        const { error } = await supabase
          .from("user_active_skills")
          .update({
            steps: currentSteps,
            current_step_index: nextIdx,
            updated_at: new Date().toISOString(),
          })
          .eq("id", skill_id)
          .eq("user_id", userId);

        if (error) return `Failed to advance step: ${error.message}`;
        return `Шаг ${idx + 1} выполнен! Переходим к шагу ${nextIdx + 1}: "${currentSteps[nextIdx]?.title}".`;
      }
    }

    return "Unknown action.";
  },
});

export const logAssistantActionTool = new DynamicStructuredTool({
  name: "log_assistant_action",
  description:
    "INTERNAL: Logs your own medical recommendation or action for future reference. " +
    "Use ONLY when you give a SPECIFIC medical recommendation: prescribing a test, changing a diet plan, " +
    "assigning/modifying a supplement, or creating a step-by-step action plan. " +
    "DO NOT use for greetings, general chat, acknowledgments, or trivial interactions.",
  schema: z.object({
    action_summary: z
      .string()
      .describe(
        "A concise 1-sentence summary of the recommendation (e.g., 'Рекомендовал сдать ферритин при подозрении на дефицит железа')"
      ),
    linked_goal_id: z
      .string()
      .uuid()
      .optional()
      .describe(
        "The UUID of the active health goal this action relates to (for Phase 2 integration). Omit if not goal-related."
      ),
  }),
  func: async ({ action_summary, linked_goal_id }, _runManager, config) => {
    const userId = config?.configurable?.user_id;
    const token = config?.configurable?.token;

    if (!userId || !token) {
      console.warn("[Tool:log_assistant_action] No user context, skipping.");
      return "logged";
    }

    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) {
        console.warn("[Tool:log_assistant_action] Missing env vars, skipping.");
        return "logged";
      }

      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      // 1. Generate embedding
      const actionEmbedding = await embeddings.embedQuery(action_summary);

      // 2. Dedup check: cosine search for existing similar action (threshold 0.85)
      const { data: existing } = await supabase.rpc("match_user_memories", {
        p_user_id: userId,
        query_embedding: actionEmbedding,
        match_count: 1,
        similarity_threshold: 0.85,
        filter_type: "assistant_action",
      });

      if (existing && existing.length > 0) {
        // Duplicate found — update timestamp and access_count instead of inserting
        const dupId = existing[0].id;
        await supabase
          .from("user_memory_vectors")
          .update({
            updated_at: new Date().toISOString(),
            access_count: (existing[0].access_count || 0) + 1,
          })
          .eq("id", dupId);
        console.log(
          `[Tool:log_assistant_action] Dedup hit (id=${dupId}), updated timestamp.`
        );
        return "logged";
      }

      // 3. No duplicate — INSERT new record
      const metadata: Record<string, unknown> = {};
      if (linked_goal_id) {
        metadata.linked_goal_id = linked_goal_id;
      }

      const { error } = await supabase.from("user_memory_vectors").insert({
        user_id: userId,
        content: action_summary,
        memory_type: "assistant_action",
        importance: 0.7,
        embedding: actionEmbedding,
        metadata,
      });

      if (error) {
        console.error("[Tool:log_assistant_action] INSERT error:", error.message);
      } else {
        console.log(
          `[Tool:log_assistant_action] ✅ Saved: "${action_summary.substring(0, 50)}..."`
        );
      }

      return "logged";
    } catch (err) {
      console.error("[Tool:log_assistant_action] Unexpected error:", err);
      return "logged"; // Never fail — graceful degradation
    }
  },
});

export const assistantTools = [calculateNormsTool, updateProfileTool, get_today_diary_summary, manageHealthGoalsTool, logAssistantActionTool];
export const diaryTools = [calculateNormsTool, updateProfileTool, logMealTool, log_supplement_intake_tool, get_today_diary_summary, logAssistantActionTool];

// We can export an array of all available tools for easy binding to ToolNode
export const agentTools = [
  calculateNormsTool, 
  updateProfileTool, 
  logMealTool, 
  log_supplement_intake_tool, 
  get_today_diary_summary, 
  manageHealthGoalsTool,
  logAssistantActionTool,
];
