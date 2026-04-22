require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const functionUrl = SUPABASE_URL + '/functions/v1/kb-ingest';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('Fetching pending document metadata directly...');
    
    // We already know document_id 17 is pending/indexing. 
    // In Edge Function, the chunks are saved in kb_documents.metadata.pending_chunks
    // Let's just bypass the queue and manually hit the Edge Function endpoints directly 
    // with offset until it completes!

    let doc_id = 17;
    let offset = 0;
    
    while(true) {
        console.log(`Hitting Edge Function for doc ${doc_id} at offset ${offset}...`);
        const res = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY },
            body: JSON.stringify({ document_id: doc_id, version: 1, queued_at: new Date().toISOString(), offset: offset })
        });
        
        if (!res.ok) {
            console.log('EF Error:', await res.text());
            break;
        }
        
        const data = await res.json();
        console.log('EF Response:', data);
        
        if (data.complete) {
            console.log('✅ Document is fully indexed!');
            break;
        }
        if (data.skipped) {
            console.log('Document skipped:', data.reason);
            // Maybe it was already indexed? Let's check status.
            const {data: check} = await supabase.from('kb_documents').select('status').eq('id', doc_id).single();
            console.log('Current status:', check.status);
            break;
        }
        
        if (data.progress) {
            // "0/601" or "1/601"
            // Our batch size is 1 currently in the edge function! Wait, BATCH_SIZE=1?
            // In the edge function index.ts, BATCH_SIZE is 1! So we have to hit it 601 times!
            // Wait, hitting it 601 times takes 601 seconds!
            // I should just loop.
            const parts = data.progress.split('/');
            const newOffset = parseInt(parts[0], 10);
            if (newOffset <= offset && offset !== 0) {
                console.log('Offset did not advance, breaking loop to prevent infinite cycle.');
                break;
            }
            offset = newOffset;
            
            // Artificial delay to prevent spamming too fast
            await new Promise(r => setTimeout(r, 500));
        }
    }
}
run();
