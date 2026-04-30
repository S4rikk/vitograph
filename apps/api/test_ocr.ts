import fs from 'fs';
import { runWearableVisionAnalyzer } from './src/ai/src/graph/wearable-vision-analyzer.js';

async function test() {
    try {
        const imagePath = 'C:/Users/user/.gemini/antigravity/brain/10a62b20-1502-4328-82ce-3bb0a276e869/sleep_app_ui_1777524169685.png';
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        
        console.log("Starting analyzer...");
        const result = await runWearableVisionAnalyzer(base64Image);
        console.log("Success:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error occurred:", e);
    }
}

test();
