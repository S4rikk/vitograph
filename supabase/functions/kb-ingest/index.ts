// ═══════════════════════════════════════════════════════════════════
// VITOGRAPH — Edge Function: kb-ingest
// Runtime: Deno (Supabase Edge Functions)
// Trigger: pg_cron → pg_net POST (every 30 seconds)
// Purpose: Parse markdown document → sections → chunks → embeddings
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";

let _model: any = null;
function getModel() {
  // @ts-ignore: Supabase is globally injected in Edge Functions
  if (!_model) _model = new Supabase.ai.Session('gte-small');
  return _model;
}

/* ─── Constants ──────────────────────────────────────────────────── */

const TARGET_CHUNK_SIZE = 1500;
const MAX_CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 100;
const MIN_CHUNK_SIZE = 100;
const EMBEDDING_MODEL_NAME = "gte-small-v1";

/* ─── Types ──────────────────────────────────────────────────────── */

interface IngestPayload {
  document_id: number;
  version: number;
  queued_at: string;
  offset?: number;
  total_chunks?: number;
}

interface ParsedSection {
  heading: string;
  level: number;
  content: string;
  order: number;
}

interface ParsedChunk {
  content: string;
  sectionIndex: number;
  chunkOrder: number;
  charStart: number;
  charEnd: number;
  tokenCount: number;
}

/* ─── Markdown Parser ────────────────────────────────────────────── */

/**
 * Splits markdown into sections by H2/H3 headings.
 * Content before the first heading becomes section 0 with level 1.
 */
function parseMarkdownSections(markdown: string): ParsedSection[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const sections: ParsedSection[] = [];
  let sectionOrder = 0;

  const matches = Array.from(markdown.matchAll(headingRegex));

  if (matches.length === 0) {
    return [{
      heading: "Документ",
      level: 1,
      content: markdown.trim(),
      order: 0,
    }];
  }

  if (matches[0].index !== undefined && matches[0].index > 0) {
    const introContent = markdown.slice(0, matches[0].index).trim();
    if (introContent) {
      sections.push({
        heading: "Введение",
        level: 1,
        content: introContent,
        order: sectionOrder++,
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const level = match[1].length;
    const heading = match[2].trim();

    const startIndex = (match.index || 0) + match[0].length;
    const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : markdown.length;

    sections.push({
      heading,
      level,
      content: markdown.slice(startIndex, endIndex).trim(),
      order: sectionOrder++,
    });
  }

  return sections;
}

/**
 * Splits section content into chunks with overlap.
 * Respects paragraph boundaries (double newline).
 */
function chunkSectionContent(
  content: string,
  sectionIndex: number,
  globalCharOffset: number,
): ParsedChunk[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const paragraphs = normalized.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const chunks: ParsedChunk[] = [];

  let currentChunk = "";
  let chunkOrder = 0;
  let chunkStartChar = globalCharOffset;
  let searchIdx = 0;

  for (const p of paragraphs) {
    const trimmedPara = p.trim();
    const paraStartIdx = normalized.indexOf(p, searchIdx);
    searchIdx = paraStartIdx + p.length;
    const globalParaStart = globalCharOffset + paraStartIdx;

    if (trimmedPara.length > TARGET_CHUNK_SIZE) {
      // Split paragraph by sentences
      const sentences = trimmedPara.split(/(?<=[.!?»])\s+/).filter(s => s.trim().length > 0);
      let sentenceSearchIdx = 0;

      for (const sent of sentences) {
        const trimmedSent = sent.trim();
        const sentStartIdx = trimmedPara.indexOf(sent, sentenceSearchIdx);
        sentenceSearchIdx = sentStartIdx + sent.length;
        const globalSentStart = globalParaStart + sentStartIdx;

        if (trimmedSent.length > MAX_CHUNK_SIZE) {
           // sentence is huge
           if (currentChunk.trim().length > 0) {
             chunks.push(buildChunk(currentChunk, sectionIndex, chunkOrder++, chunkStartChar));
           }
           let charOffset = 0;
           while (charOffset < trimmedSent.length) {
              const chunkText = trimmedSent.slice(charOffset, charOffset + TARGET_CHUNK_SIZE);
              chunks.push(buildChunk(chunkText, sectionIndex, chunkOrder++, globalSentStart + charOffset));
              charOffset += TARGET_CHUNK_SIZE - CHUNK_OVERLAP;
           }
           currentChunk = ""; // Next item will start fresh
        } else {
           const wouldBe = currentChunk 
               ? currentChunk.length + 1 + trimmedSent.length 
               : trimmedSent.length;
           if (wouldBe > TARGET_CHUNK_SIZE && currentChunk.length > 0) {
               chunks.push(buildChunk(currentChunk, sectionIndex, chunkOrder++, chunkStartChar));
               const overlap = currentChunk.slice(-CHUNK_OVERLAP);
               currentChunk = overlap + " " + trimmedSent;
               chunkStartChar = globalSentStart - overlap.length;
               if (chunkStartChar < 0) chunkStartChar = 0;
           } else {
               currentChunk = currentChunk ? currentChunk + " " + trimmedSent : trimmedSent;
               if (!currentChunk.includes(" ")) chunkStartChar = globalSentStart; // first addition
           }
        }
      }
    } else {
      // Normal paragraph handling
      const wouldBe = currentChunk
        ? currentChunk.length + 2 + trimmedPara.length
        : trimmedPara.length;

      if (wouldBe > TARGET_CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(buildChunk(currentChunk, sectionIndex, chunkOrder++, chunkStartChar));
        const overlap = currentChunk.slice(-CHUNK_OVERLAP);
        currentChunk = overlap + "\n\n" + trimmedPara;
        chunkStartChar = globalParaStart - overlap.length;
        if (chunkStartChar < 0) chunkStartChar = 0;
      } else {
        if (!currentChunk) chunkStartChar = globalParaStart;
        currentChunk = currentChunk ? currentChunk + "\n\n" + trimmedPara : trimmedPara;
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(buildChunk(currentChunk, sectionIndex, chunkOrder++, chunkStartChar));
  }

  // Filter out chunks < MIN_CHUNK_SIZE and re-order
  const finalChunks: ParsedChunk[] = [];
  let finalOrder = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.content.length < MIN_CHUNK_SIZE && finalChunks.length > 0 && i === chunks.length - 1) {
       const prev = finalChunks[finalChunks.length - 1];
       prev.content += "\n\n" + chunk.content;
       prev.charEnd = chunk.charEnd;
       prev.tokenCount = Math.ceil(prev.content.length / 4);
    } else {
       chunk.chunkOrder = finalOrder++;
       finalChunks.push(chunk);
    }
  }

  return finalChunks;
}

/** Constructs a ParsedChunk object with token estimate. */
function buildChunk(
  content: string,
  sectionIndex: number,
  chunkOrder: number,
  charStart: number,
): ParsedChunk {
  return {
    content: content.trim(),
    sectionIndex,
    chunkOrder,
    charStart,
    charEnd: charStart + content.length,
    tokenCount: Math.ceil(content.length / 4),
  };
}

/** Generates an embedding for the given text via Supabase.ai. */
async function generateEmbedding(text: string): Promise<number[]> {
  const result = await getModel().run(text, {
    mean_pool: true,
    normalize: true,
  });
  return Array.from(result as Float32Array);
}

async function enqueueNextBatch(supabase: any, payload: IngestPayload) {
  const { error } = await supabase.rpc('kb_ingest_enqueue_batch', { p_payload: payload });
  if (error) {
     throw new Error(`Failed to enqueue next batch: ${error.message}`);
  }
}

async function finalizeDocument(supabase: any, docId: number, metadata: any) {
  const newMetadata = { ...metadata };
  delete newMetadata.pending_chunks;
  
  await supabase
    .from("kb_documents")
    .update({ status: "indexed", updated_at: new Date().toISOString(), metadata: newMetadata })
    .eq("id", docId);
}

/** Creates a JSON response with status code. */
function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* ─── Main Handler ───────────────────────────────────────────────── */

Deno.serve(async (req) => {
  let document_id: number | undefined;
  try {
    // ── 1. Auth guard ─────────────────────────────────────────────
    // Uses SENTIMENT_AUTH_KEY (legacy) || SUPABASE_SERVICE_ROLE_KEY (auto-injected)
    // pg_cron sends 'Authorization: Bearer <service_role_key from _app_config>'
    // which may differ from auto-injected SUPABASE_SERVICE_ROLE_KEY
    const serviceKey = Deno.env.get("SENTIMENT_AUTH_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!serviceKey || !authHeader || authHeader !== `Bearer ${serviceKey}`) {
      console.warn("[kb-ingest] Unauthorized request");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // ── 2. Parse payload ──────────────────────────────────────────
    const payload: IngestPayload = await req.json();
    const { version, queued_at } = payload;
    document_id = payload.document_id;

    if (!document_id) {
      return jsonResponse({ error: "Missing document_id" }, 400);
    }

    console.log(`[kb-ingest] Processing document_id=${document_id} version=${version}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );

    // ── 3. Load document ──────────────────────────────────────────
    const { data: doc, error: docError } = await supabase
      .from("kb_documents")
      .select("id, source_markdown, version, status, updated_at, metadata")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      console.error(`[kb-ingest] Document ${document_id} not found:`, docError);
      return jsonResponse({ error: "Document not found" }, 404);
    }

    // ── 4. Idempotency guard ──────────────────────────────────────
    if (doc.version !== version) {
      console.log(`[kb-ingest] Skipping: version mismatch (doc=${doc.version}, msg=${version})`);
      return jsonResponse({ skipped: true, reason: "version_mismatch" });
    }

    if (doc.status === "indexed" && doc.updated_at > queued_at) {
      console.log(`[kb-ingest] Skipping: already indexed after queue time`);
      return jsonResponse({ skipped: true, reason: "already_indexed" });
    }

    // ── 5. Core logic with Batching ───────────────────────────────
    const BATCH_SIZE = 50;
    const isInit = payload.offset === undefined || payload.offset === null;
    const offset = payload.offset ?? 0;

    if (isInit) {
      await supabase
        .from("kb_documents")
        .update({ status: "indexing", error_message: null })
        .eq("id", document_id);

      const markdown = doc.source_markdown;
      const sections = parseMarkdownSections(markdown);
      console.log(`[kb-ingest] Parsed ${sections.length} sections`);

      const allChunks: ParsedChunk[] = [];
      let charOffset = 0;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const sectionChunks = chunkSectionContent(section.content, i, charOffset);
        allChunks.push(...sectionChunks);
        charOffset += section.content.length;
      }

      console.log(`[kb-ingest] Split into ${allChunks.length} chunks`);

      const { error: deleteError } = await supabase
        .from("kb_sections")
        .delete()
        .eq("document_id", document_id);

      if (deleteError) {
        throw new Error(`Failed to delete old sections: ${deleteError.message}`);
      }

      const sectionRows = sections.map((s) => ({
        document_id,
        heading: s.heading,
        level: s.level,
        section_order: s.order,
        content: s.content,
      }));

      const { data: insertedSections, error: secError } = await supabase
        .from("kb_sections")
        .insert(sectionRows)
        .select("id, section_order");

      if (secError) {
        throw new Error(`Failed to insert sections: ${secError.message}`);
      }

      const sectionIdMap = new Map<number, number>();
      for (const sec of insertedSections || []) {
        sectionIdMap.set(sec.section_order, sec.id);
      }

      const pendingChunks = allChunks.map(chunk => ({
         ...chunk,
         section_id: sectionIdMap.get(sections[chunk.sectionIndex]?.order) || null,
      }));

      const { metadata = {} } = doc;
      await supabase
        .from("kb_documents")
        .update({ metadata: { ...metadata, pending_chunks: pendingChunks } })
        .eq("id", document_id);

      if (pendingChunks.length > 0) {
         console.log(`[kb-ingest] First pass success: document_id=${document_id}, enqueueing next batch...`);
         await enqueueNextBatch(supabase, {
            document_id,
            version,
            queued_at,
            offset: 0, // start chunks on next run!
            total_chunks: pendingChunks.length
         });
         return jsonResponse({ success: true, progress: `0/${pendingChunks.length}` });
      } else {
         console.log(`[kb-ingest] SUCCESS: document_id=${document_id}, sections=${sections.length}, chunks=${allChunks.length}`);
         await finalizeDocument(supabase, document_id, doc.metadata);
         return jsonResponse({ success: true, complete: true });
      }
    } else {
      // offset > 0
      if (doc.status !== "indexing") {
         console.log(`[kb-ingest] Skipping: stale task, status is ${doc.status}`);
         return jsonResponse({ skipped: true, reason: "stale_task" });
      }

      const pendingChunks = doc.metadata?.pending_chunks || [];
      if (pendingChunks.length === 0) {
         return jsonResponse({ error: "No pending chunks found in metadata" }, 500);
      }

      const batch = pendingChunks.slice(offset, offset + BATCH_SIZE);
      if (batch.length === 0) {
         await finalizeDocument(supabase, document_id, doc.metadata);
         return jsonResponse({ success: true, complete: true });
      }

      const chunkEmbeddings: number[][] = [];
      for (const chunk of batch) {
        chunkEmbeddings.push(await generateEmbedding(chunk.content));
      }

      const chunkRows = batch.map((chunk: any, idx: number) => ({
        document_id,
        section_id: chunk.section_id,
        content: chunk.content,
        chunk_order: chunk.chunkOrder,
        char_start: chunk.charStart,
        char_end: chunk.charEnd,
        token_count: chunk.tokenCount,
        embedding: JSON.stringify(chunkEmbeddings[idx]),
        embedding_model: EMBEDDING_MODEL_NAME,
        metadata: {},
      }));

      const { error: chunkError } = await supabase
        .from("kb_chunks")
        .insert(chunkRows);

      if (chunkError) {
        throw new Error(`Failed to insert chunks: ${chunkError.message}`);
      }

      if (offset + BATCH_SIZE < pendingChunks.length) {
         console.log(`[kb-ingest] Batch success, progress: ${offset + BATCH_SIZE}/${pendingChunks.length}`);
         await enqueueNextBatch(supabase, {
            document_id,
            version,
            queued_at,
            offset: offset + BATCH_SIZE,
            total_chunks: pendingChunks.length
         });
         return jsonResponse({ success: true, progress: `${offset + BATCH_SIZE}/${pendingChunks.length}` });
      } else {
         console.log(`[kb-ingest] SUCCESS: document_id=${document_id}, total chunks=${pendingChunks.length}`);
         await finalizeDocument(supabase, document_id, doc.metadata);
         return jsonResponse({ success: true, complete: true });
      }
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error(`[kb-ingest] ERROR:`, errMessage);

    // Attempt to mark document as error
    try {
      if (typeof document_id !== "undefined") {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase
          .from("kb_documents")
          .update({ status: "error", error_message: errMessage })
          .eq("id", document_id);
      }
    } catch (_) {
      /* best effort */
    }

    return jsonResponse({ error: errMessage }, 500);
  }
});
