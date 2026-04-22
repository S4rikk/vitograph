import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const functionUrl = SUPABASE_URL + '/functions/v1/kb-ingest';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('Fetching pending document metadata directly...');
    
    let doc_id = 18;
    let offset = 243;
    
    let isFirst = false;
    while(true) {
        console.log(`Hitting Edge Function for doc ${doc_id} at offset ${offset}...`);
        
        let reqBody = { document_id: doc_id, version: 1, queued_at: new Date().toISOString() };
        if (!isFirst) reqBody.offset = offset;
        
        const res = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY },
            body: JSON.stringify(reqBody)
        });
        
        isFirst = false;
        
        if (!res.ok) {
            console.log('EF Error:', await res.text());
            break;
        }
        
        const data = await res.json();
        
        if (data.complete) {
            console.log('✅ Document is fully indexed!');
            break;
        }
        if (data.skipped) {
            console.log('Document skipped:', data.reason);
            const {data: check} = await supabase.from('kb_documents').select('status').eq('id', doc_id).single();
            console.log('Current status:', check.status);
            break;
        }
        
        if (data.progress) {
            const parts = data.progress.split('/');
            const newOffset = parseInt(parts[0], 10);
            if (newOffset <= offset && offset !== 0) {
                console.log('Offset did not advance, breaking loop to prevent infinite cycle.');
                break;
            }
            offset = newOffset;
            console.log('Progress', data.progress);
            
            // Artificial delay to prevent spamming too fast
            await new Promise(r => setTimeout(r, 100));
        }
    }
}
run();
