import { createClient } from "@supabase/supabase-js";

interface AppConfig {
  diary_llm: string;
  agent_llm: string;
  analysis_llm: string;
}

let configCache: AppConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getLLMConfig(): Promise<AppConfig> {
  const now = Date.now();
  if (configCache && (now - lastFetchTime) < CACHE_TTL_MS) {
    return configCache;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fallbacks if not configured or DB fails
  const defaultConfig: AppConfig = {
    diary_llm: "gpt-4o-mini",
    agent_llm: "gpt-4o-mini",
    analysis_llm: "gpt-4o-mini",
  };

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[ConfigService] Missing Supabase keys, using default LLM config.");
    return defaultConfig;
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabaseAdmin
      .from("_app_config")
      .select("key, value")
      .in("key", ["diary_llm", "agent_llm", "analysis_llm"]);

    if (error) {
      console.error("[ConfigService] Error fetching _app_config:", error);
      return configCache || defaultConfig;
    }

    const fetchedConfig = { ...defaultConfig };
    data?.forEach(row => {
      if (row.key === "diary_llm") fetchedConfig.diary_llm = String(row.value);
      if (row.key === "agent_llm") fetchedConfig.agent_llm = String(row.value);
      if (row.key === "analysis_llm") fetchedConfig.analysis_llm = String(row.value);
    });

    configCache = fetchedConfig;
    lastFetchTime = now;
    console.log("[ConfigService] Updated LLM Config from DB:", configCache);
    return configCache;

  } catch (err) {
    console.error("[ConfigService] Exception fetching config:", err);
    return configCache || defaultConfig;
  }
}
