import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pythonCore } from "../lib/python-core.js";
import { createClient } from "@supabase/supabase-js";

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
  description: "Logs a food item into the user's daily meal diary. You MUST estimate the calories, macros, and micronutrients. You MUST ALSO evaluate the overall healthiness of the meal and provide a `meal_quality_score` (0-100) and `meal_quality_reason` based on the system instructions. NEVER leave micronutrients empty if the food contains them.",
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
  func: async ({ meal_type, food_name, weight_g, calories, protein_g, fat_g, carbs_g, micronutrients, meal_quality_score, meal_quality_reason, source }, runManager, config) => {
    const userId = config?.configurable?.user_id;
    const token = config?.configurable?.token;
    const ctx = config?.configurable?.nutritionalContext;

    if (!userId || !token) {
      return "Error: User context not available. Cannot log meal without user auth.";
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return "Server Database Error.";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // --- SMART MERGE LOGIC ---
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
      const totalEstimatedWeight = res.items.reduce((sum: number, i: any) => sum + (i.estimated_weight_g || 0), 0);
      const scaleRatio = totalEstimatedWeight > 0 ? (ctx.userEnteredWeight / totalEstimatedWeight) : 1;
      
      console.log(`[SmartMerge] Vision result found. Scaling by ${scaleRatio.toFixed(2)} (User: ${ctx.userEnteredWeight} / GPT: ${totalEstimatedWeight})`);
      
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

      // 1. Use context macros (more accurate for vision)
      if (res.meal_summary) {
        finalCalories = res.meal_summary.total_calories_kcal * scaleRatio;
        finalProtein = res.meal_summary.total_protein_g * scaleRatio;
        finalFat = res.meal_summary.total_fat_g * scaleRatio;
        finalCarbs = res.meal_summary.total_carbs_g * scaleRatio;
      }

      // 2. Aggregate Micronutrients from all items (SCALED)
      res.items.forEach((item: any) => {
        const itemWeightFactor = (item.estimated_weight_g || 0) / 100;
        Object.entries(item.per_100g).forEach(([key, val]) => {
          if (typeof val === 'number' && mapping[key]) {
             finalMicros[mapping[key]] = (finalMicros[mapping[key]] || 0) + (val * itemWeightFactor * scaleRatio);
          }
        });
      });

      // 3. Aggregate Active Ingredients from all supplements (UNSCALED)
      if (res.supplements) {
        res.supplements.forEach((s: any) => {
          s.active_ingredients?.forEach((ing: any) => {
            const key = `${ing.ingredient_name} (${ing.unit})`;
            finalMicros[key] = (finalMicros[key] || 0) + ing.amount;
          });
        });
      }
      
      finalScore = res.meal_quality_score;
      finalReason = res.meal_quality_reason;
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
      meal_quality_reason: finalReason,
      logged_at: isoNow,
      notes: ctx ? `Vision Smart Log` : `AI Logged`,
      source: finalSource
    }).select("id");

    if (logError || !log || log.length === 0) return `Failed to create meal log: ${logError?.message}`;
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
    });

    if (itemError) return `Failed to add meal item: ${itemError.message}`;

    const microsList = Object.entries(finalMicros).map(([k, v]) => `${k} (${v.toFixed(1)})`).join(', ');

    let baseResponse = `Successfully logged ${weight_g}g of ${food_name} (${finalCalories.toFixed(0)} kcal) for ${meal_type}.`;

    if (microsList.length > 0) {
      baseResponse += ` Micronutrients found: ${microsList}. AI INSTRUCTION: You MUST mention these micronutrients in your final response to the user. When mentioning them, you MUST wrap each micronutrient name and value in a strict XML tag format: <nutr type="[type]">[Name] ([Value])</nutr>. Valid types are: iron, magnesium, vitamin_c, vitamin_b, omega, calcium, default. Example: <nutr type="iron">Железо (2мг)</nutr>. Note: Always use proper Types, e.g. use "calcium" for Кальций, "vitamin_b" for Фолиевая кислота, etc.`;
    } else {
      baseResponse += ` Confirm this back to the user.`;
    }

    if (finalScore !== undefined && finalScore !== null) {
      baseResponse += ` AI INSTRUCTION: You MUST append the following xml tag exactly as is at the end of your response: <meal_score score="${finalScore}" reason="${finalReason || ''}" />`;
    }

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

// We can export an array of all available tools for easy binding
export const agentTools = [calculateNormsTool, updateProfileTool, logMealTool, log_supplement_intake_tool];


