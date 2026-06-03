const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:\\Users\\user\\.gemini\\antigravity\\brain\\570a13ed-c6f3-46c0-87a2-a3edef655903\\.system_generated\\logs\\transcript.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let latestCode = null;

  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.tool_calls) {
        for (const call of parsed.tool_calls) {
          if ((call.name === 'write_to_file' || call.name === 'replace_file_content') && 
              call.args && call.args.TargetFile && call.args.TargetFile.includes('UserProfileSheet.tsx')) {
            if (call.args.CodeContent) {
                latestCode = call.args.CodeContent;
            } else if (call.args.ReplacementContent && call.name === 'replace_file_content') {
                // If it's a replace, we might not get the full file, but let's see.
                console.log('Found a replace call for UserProfileSheet');
            }
          }
        }
      }
    } catch (e) {}
  }

  if (latestCode) {
    fs.writeFileSync('C:\\project\\VITOGRAPH\\apps\\web\\src\\components\\profile\\UserProfileSheet.tsx', latestCode);
    console.log('Successfully recovered UserProfileSheet.tsx from coder transcript!');
  } else {
    console.log('Could not find full CodeContent for UserProfileSheet.tsx in the transcript.');
  }
}

processLineByLine();
