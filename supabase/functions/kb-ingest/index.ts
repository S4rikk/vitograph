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

const TARGET_CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 80;
const MIN_CHUNK_SIZE = 100;
const EMBEDDING_MODEL_NAME = "gte-small-v1";

/* ─── Types ──────────────────────────────────────────────────────── */

interface IngestPayload {
  document_id: number;
  version: number;
  queued_at: string;
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
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
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
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const chunks: ParsedChunk[] = [];

  let currentChunk = "";
  let chunkOrder = 0;
  let chunkStartChar = globalCharOffset;

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();

    // Merge tiny paragraphs with current chunk
    if (trimmedPara.length < MIN_CHUNK_SIZE && currentChunk.length > 0) {
      currentChunk += "\n\n" + trimmedPara;
      continue;
    }

    // Check if adding this paragraph exceeds target size
    const wouldBe = currentChunk
      ? currentChunk.length + 2 + trimmedPara.length
      : trimmedPara.length;

    if (wouldBe > TARGET_CHUNK_SIZE && currentChunk.length > 0) {
      // Finalize current chunk
      chunks.push(buildChunk(currentChunk, sectionIndex, chunkOrder, chunkStartChar));
      chunkOrder++;

      // Start new chunk with overlap from previous
      const overlap = currentChunk.slice(-CHUNK_OVERLAP);
      currentChunk = overlap + "\n\n" + trimmedPara;
      chunkStartChar = globalCharOffset + content.indexOf(trimmedPara);
    } else {
      currentChunk = currentChunk
        ? currentChunk + "\n\n" + trimmedPara
        : trimmedPara;
    }
  }

  // Finalize last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(buildChunk(currentChunk, sectionIndex, chunkOrder, chunkStartChar));
  }

  return chunks;
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
      .select("id, source_markdown, version, status, updated_at")
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

    // ── 5. Mark as indexing ───────────────────────────────────────
    await supabase
      .from("kb_documents")
      .update({ status: "indexing", error_message: null })
      .eq("id", document_id);

    // ── 6. Parse markdown ─────────────────────────────────────────
    const markdown = doc.source_markdown;
    const sections = parseMarkdownSections(markdown);
    console.log(`[kb-ingest] Parsed ${sections.length} sections`);

    // Build chunks for each section
    const allChunks: ParsedChunk[] = [];
    let charOffset = 0;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionChunks = chunkSectionContent(section.content, i, charOffset);
      allChunks.push(...sectionChunks);
      charOffset += section.content.length;
    }

    console.log(`[kb-ingest] Split into ${allChunks.length} chunks`);

    // ── 7. Generate embeddings ────────────────────────────────────
    const chunkEmbeddings: number[][] = [];
    for (const chunk of allChunks) {
      const embedding = await generateEmbedding(chunk.content);
      chunkEmbeddings.push(embedding);
    }

    console.log(`[kb-ingest] Generated ${chunkEmbeddings.length} embeddings`);

    // ── 8. Delete old sections/chunks (CASCADE) ───────────────────
    const { error: deleteError } = await supabase
      .from("kb_sections")
      .delete()
      .eq("document_id", document_id);

    if (deleteError) {
      throw new Error(`Failed to delete old sections: ${deleteError.message}`);
    }

    // ── 9. Batch INSERT sections ──────────────────────────────────
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

    // Build section_order → section_id map
    const sectionIdMap = new Map<number, number>();
    for (const sec of insertedSections || []) {
      sectionIdMap.set(sec.section_order, sec.id);
    }

    // ── 10. Batch INSERT chunks ───────────────────────────────────
    const chunkRows = allChunks.map((chunk, idx) => ({
      document_id,
      section_id: sectionIdMap.get(sections[chunk.sectionIndex]?.order) || null,
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

    // ── 11. Mark as indexed ───────────────────────────────────────
    await supabase
      .from("kb_documents")
      .update({ status: "indexed" })
      .eq("id", document_id);

    console.log(`[kb-ingest] SUCCESS: document_id=${document_id}, sections=${sections.length}, chunks=${allChunks.length}`);

    return jsonResponse({
      success: true,
      document_id,
      sections_count: sections.length,
      chunks_count: allChunks.length,
    });
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
