import { runLabReportAnalyzer } from "./graph/lab-report-analyzer.js";

async function main() {
    try {
        console.log("Starting local test...");
        const biomarkers = [
            { original_name: "Ferritin", standardized_slug: "ferritin", value_numeric: 12, unit: "ng/mL", flag: "Low" },
            { original_name: "Vitamin D", standardized_slug: "vitamin_d", value_numeric: 18, unit: "ng/mL", flag: "Low" },
            { original_name: "Vitamin B12", standardized_slug: "vitamin_b12", value_numeric: 350, unit: "pg/mL", flag: "Normal" }
        ];

        const userContext = JSON.stringify({ profile: { age: 30 } });
        const result = await runLabReportAnalyzer(biomarkers, userContext, "test-user-id", "test-token");
        console.log("SUCCESS:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
}

main();
