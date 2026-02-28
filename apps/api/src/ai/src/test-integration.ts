
import { pythonCore } from "./lib/python-core.js";

async function testIntegration() {
  console.log("🧪 Testing Python Integration...");

  // 1. Test Norm Calculation
  try {
    console.log("   Calculating Norms...");
    const norm = await pythonCore.calculateNormsAction("Vitamin C", {
      age: 30,
      is_smoker: true,
      is_pregnant: false,
    });
    console.log("   ✅ Norm Result:", norm);
  } catch (error) {
    console.error("   ❌ Norm Calculation Failed:", error);
  }

  // 2. Test PDF Parsing (Mock File)
  try {
    console.log("   Parsing PDF...");
    // Minimal PDF buffer
    const pdfBuffer = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n" +
        "2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n" +
        "3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 4 0 R\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 5 0 R\n>>\nendobj\n" +
        "4 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\nendobj\n" +
        "5 0 obj\n<<\n/Length 55\n>>\nstream\n" +
        "BT\n/F1 24 Tf\n100 700 Td\n(Ferritin: 50.5 ng/mL) Tj\nET\n" +
        "endstream\nendobj\n" +
        "xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000120 00000 n \n0000000280 00000 n \n0000000370 00000 n \n" +
        "trailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n480\n%%EOF\n"
    );
    
    const biomarkers = await pythonCore.parsePdf(pdfBuffer, "test.pdf");
    console.log("   ✅ Parse Result:", biomarkers);
  } catch (error) {
    console.error("   ❌ PDF Parsing Failed:", error);
  }
}

testIntegration();
