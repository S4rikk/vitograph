import { createClient } from "@supabase/supabase-js";

/**
 * Calculates max pressure drop from hourly surface pressure data.
 */
function calculateMaxPressureDrop(hourlyPressure: number[]): number {
  if (!hourlyPressure || hourlyPressure.length < 2) return 0;
  let maxDrop = 0;
  for (let i = 1; i < hourlyPressure.length; i++) {
    const drop = hourlyPressure[i - 1] - hourlyPressure[i];
    if (drop > maxDrop) maxDrop = drop;
  }
  return maxDrop;
}

/**
 * Ensures environmental logs (weather/magnetic) are cached for today.
 * Strict timeout of 4 seconds to avoid blocking chat.
 */
export async function getOrFetchWeatherContext(profile: any, userId: string, authHeader?: string): Promise<{ max_kp_index: number; pressure_drop_max_hpa: number } | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Timezone formatting
  const tz = profile?.timezone || "Europe/Moscow"; // default to Moscow if not set
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });

  try {
    // 1. Check DB First
    const { data: existingLog } = await supabase
      .from("environmental_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (existingLog && existingLog.synced_at) {
      const syncedAt = new Date(existingLog.synced_at);
      const startOfTodayUTC = new Date();
      startOfTodayUTC.setUTCHours(0, 0, 0, 0);

      if (syncedAt >= startOfTodayUTC) {
        return {
          max_kp_index: existingLog.max_kp_index || 0,
          pressure_drop_max_hpa: existingLog.pressure_drop_max_hpa || 0,
        };
      }
    }

    // 2. Not found, we need to fetch. 
    // Use an AbortContext with 4s timeout.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    let lat = 55.75; // Default Moscow
    let lon = 37.61;
    let city = profile?.city || "Moscow";

    // 2a. Geocoding
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`, { signal: controller.signal as RequestInit["signal"] });
      const geoData = await geoRes.json() as any;
      if (geoData.results && geoData.results.length > 0) {
        lat = geoData.results[0].latitude;
        lon = geoData.results[0].longitude;
      }
    } catch (e) {
      console.warn(`[WeatherService] Geocoding failed for ${city}:`, e);
    }

    const dailyPressureDrops: Record<string, number> = {};
    // 2b. Surface Pressure
    try {
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=surface_pressure&timezone=auto&forecast_days=7`, { signal: controller.signal as RequestInit["signal"] });
      const weatherData = await weatherRes.json() as any;
      if (weatherData?.hourly?.time && weatherData?.hourly?.surface_pressure) {
        const times = weatherData.hourly.time;
        const pressures = weatherData.hourly.surface_pressure;
        
        const dayPressures: Record<string, number[]> = {};
        for(let i = 0; i < times.length; i++) {
          const day = times[i].substring(0, 10);
          if (!dayPressures[day]) dayPressures[day] = [];
          if (pressures[i] !== null) dayPressures[day].push(pressures[i]);
        }
        
        for (const [day, values] of Object.entries(dayPressures)) {
          dailyPressureDrops[day] = calculateMaxPressureDrop(values);
        }
      }
    } catch (e) {
      console.warn(`[WeatherService] Weather fetch failed:`, e);
    }

    const dailyKp: Record<string, number> = {};
    // 2c. NOAA Kp-Index (3-day forecast)
    try {
      const noaaRes = await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json", { signal: controller.signal as RequestInit["signal"] });
      const noaaData = await noaaRes.json() as any[][];
      // Skip header row [0]
      if (Array.isArray(noaaData) && noaaData.length > 1) {
        for (let i = 1; i < noaaData.length; i++) {
          const row = noaaData[i];
          const timeStr = row[0]; // e.g. "2025-03-24 00:00:00"
          const kpStr = row[2];
          if (timeStr && kpStr) {
            const day = timeStr.substring(0, 10);
            const kp = parseFloat(kpStr);
            if (!isNaN(kp)) {
              dailyKp[day] = Math.max(dailyKp[day] || 0, kp);
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[WeatherService] NOAA Kp fetch failed:`, e);
    }

    clearTimeout(timeout);

    const nowISO = new Date().toISOString();
    const payloads = [];
    
    // We want today through today + 6
    // Determine user's local start of today
    const now = new Date();
    // Use the user's timezone if possible, otherwise rely on the 'today' string logic
    // We can just construct dates incrementing from 'today' to avoid manual tz math:
    const baseDate = new Date(`${today}T00:00:00`); 
    for(let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      // Constructing string back as YYYY-MM-DD
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dayStr = `${yyyy}-${mm}-${dd}`;
      
      payloads.push({
        user_id: userId,
        date: dayStr,
        city_name: city,
        latitude: lat,
        longitude: lon,
        max_kp_index: dailyKp[dayStr] || 0,
        pressure_drop_max_hpa: dailyPressureDrops[dayStr] || 0,
        created_at: nowISO,
        synced_at: nowISO
      });
    }

    // 3. Upsert to DB
    await supabase.from("environmental_logs").upsert(payloads, { onConflict: "user_id,date" });

    const todayPayload = payloads.find(p => p.date === today);
    return { 
      max_kp_index: todayPayload?.max_kp_index || 0, 
      pressure_drop_max_hpa: todayPayload?.pressure_drop_max_hpa || 0 
    };

  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn("[WeatherService] Fetch timed out (4s)");
    } else {
      console.error("[WeatherService] Encountered error:", err);
    }
    // Fail gracefully so chat continues
    return null;
  }
}
