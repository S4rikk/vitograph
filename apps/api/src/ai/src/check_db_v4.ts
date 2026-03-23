
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const targetId = "179c5a18-c7ce-41a4-b5f9-dd193a2236b0";

    console.log(`Searching for Meal Log: ${targetId}...`);

    const { data: log, error } = await supabase
        .from("meal_logs")
        .select("*, meal_items(*)")
        .eq("id", targetId)
        .single();

    if (error) {
        console.error("Error fetching log:", error.message);
    } else {
        console.log("Log Found:", JSON.stringify(log, null, 2));
    }
}

main();
