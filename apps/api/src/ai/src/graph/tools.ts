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
  func: async ({ meal_type, food_name, weight_g, calories, protein_g, fat_g, carbs_g, micronutrients, meal_quality_score, meal_quality_reason }, runManager, config) => {
    const userId = config?.configurable?.user_id;
    const token = config?.configurable?.token;

    if (!userId || !token) {
      return "Error: User context not available. Cannot log meal without user auth.";
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return "Server Database Error.";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const microsDb: Record<string, number> = {};
    if (micronutrients) {
      if (micronutrients.vitamin_a_mcg) microsDb["Витамин A (мкг)"] = micronutrients.vitamin_a_mcg;
      if (micronutrients.vitamin_c_mg) microsDb["Витамин C (мг)"] = micronutrients.vitamin_c_mg;
      if (micronutrients.vitamin_d_mcg) microsDb["Витамин D (мкг)"] = micronutrients.vitamin_d_mcg;
      if (micronutrients.vitamin_e_mg) microsDb["Витамин E (мг)"] = micronutrients.vitamin_e_mg;
      if (micronutrients.vitamin_b12_mcg) microsDb["Витамин B12 (мкг)"] = micronutrients.vitamin_b12_mcg;
      if (micronutrients.folate_mcg) microsDb["Фолиевая кислота (мкг)"] = micronutrients.folate_mcg;
      if (micronutrients.iron_mg) microsDb["Железо (мг)"] = micronutrients.iron_mg;
      if (micronutrients.calcium_mg) microsDb["Кальций (мг)"] = micronutrients.calcium_mg;
      if (micronutrients.magnesium_mg) microsDb["Магний (мг)"] = micronutrients.magnesium_mg;
      if (micronutrients.zinc_mg) microsDb["Цинк (мг)"] = micronutrients.zinc_mg;
      if (micronutrients.selenium_mcg) microsDb["Селен (мкг)"] = micronutrients.selenium_mcg;
      if (micronutrients.potassium_mg) microsDb["Калий (мг)"] = micronutrients.potassium_mg;
      if (micronutrients.sodium_mg) microsDb["Натрий (мг)"] = micronutrients.sodium_mg;
    }

    const isoNow = new Date().toISOString();
    
    // 1. Create Meal Log
    const { data: log, error: logError } = await supabase.from("meal_logs").insert({
      user_id: userId,
      meal_type: meal_type,
      total_calories: Number(calories),
      total_protein: Number(protein_g),
      total_fat: Number(fat_g),
      total_carbs: Number(carbs_g),
      micronutrients: microsDb,
      meal_quality_score: meal_quality_score,
      meal_quality_reason: meal_quality_reason,
      logged_at: isoNow,
      notes: `AI Logged`,
      source: "manual"
    }).select("id");

    if (logError || !log || log.length === 0) return `Failed to create meal log: ${logError?.message}`;
    const logId = log[0].id;

    // 2. Add Meal Item
    const { error: itemError } = await supabase.from("meal_items").insert({
      meal_log_id: logId,
      food_name: food_name,
      weight_g: weight_g,
      calories: Number(calories),
      protein_g: Number(protein_g),
      fat_g: Number(fat_g),
      carbs_g: Number(carbs_g),
    });

    if (itemError) return `Failed to add meal item: ${itemError.message}`;

    const microsList = Object.entries(microsDb).map(([k, v]) => `${k} (${v})`).join(', ');

    let baseResponse = `Successfully logged ${weight_g}g of ${food_name} (${calories} kcal) for ${meal_type}.`;

    if (microsList.length > 0) {
      baseResponse += ` Micronutrients found: ${microsList}. AI INSTRUCTION: You MUST mention these micronutrients in your final response to the user. When mentioning them, you MUST wrap each micronutrient name and value in a strict XML tag format: <nutr type="[type]">[Name] ([Value])</nutr>. Valid types are: iron, magnesium, vitamin_c, vitamin_b, omega, calcium, default. Example: <nutr type="iron">Железо (2мг)</nutr>. Note: Always use proper Types, e.g. use "calcium" for Кальций, "vitamin_b" for Фолиевая кислота, etc.`;
    } else {
      baseResponse += ` Confirm this back to the user.`;
    }

    if (meal_quality_score !== undefined && meal_quality_score !== null) {
      baseResponse += ` AI INSTRUCTION: You MUST append the following xml tag exactly as is at the end of your response: <meal_score score="${meal_quality_score}" reason="${meal_quality_reason || ''}" />`;
    }

    return baseResponse;
  }
});

// We can export an array of all available tools for easy binding
export const agentTools = [calculateNormsTool, updateProfileTool, logMealTool];

