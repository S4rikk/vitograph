// ═══════════════════════════════════════════════════════════════════
// VITOGRAPH — Edge Function: memory-consolidator
// Runtime: Deno (Supabase Edge Functions)
// Trigger: pg_cron → dispatch_consolidation_jobs() → pg_net POST
// Purpose: Extract facts from conversations, generate embeddings,
//          dedup & upsert into user_memory_vectors
// ═══════════════════════════════════════════════════════════════════

import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/* ─── Constants ──────────────────────────────────────────────────── */

const VALID_MEMORY_TYPES = new Set([
  'fact',
  'preference',
  'experience',
  'goal',
  'fear',
])

/** Must match the embedding column dimension in user_memory_vectors. */
const EMBEDDING_DIMENSIONS = 384

/** Dedup threshold — above this, facts are considered duplicates. */
const SIMILARITY_THRESHOLD = 0.85

/** Prevent token overflow when sending conversation to LLM. */
const MAX_CONVERSATION_CHARS = 12_000

/** Time window for fetching recent messages. */
const MESSAGES_WINDOW_HOURS = 24

/** Pending log entries older than this (hours) are ignored. */
const LOG_STALE_HOURS = 2

/* ─── Types ──────────────────────────────────────────────────────── */

type DbClient = ReturnType<typeof createClient>

interface ExtractedFact {
  content: string
  memory_type: string
  importance: number
}

/* ─── Helpers ────────────────────────────────────────────────────── */

/** Strip markdown code fences that LLMs sometimes wrap around JSON. */
function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

/** Clamp a number within [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Build a JSON response with CORS headers. */
function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Update the memory_consolidation_log with final status.
 *
 * Targets only recent pending entries to avoid touching stale records.
 */
async function updateConsolidationLog(
  supabase: DbClient,
  userId: string,
  status: 'success' | 'failed',
  factsExtracted: number,
  errorMessage?: string,
): Promise<void> {
  const staleThreshold = new Date(
    Date.now() - LOG_STALE_HOURS * 60 * 60 * 1000,
  ).toISOString()

  const { error } = await supabase
    .from('memory_consolidation_log')
    .update({
      status,
      facts_extracted: factsExtracted,
      error_message: errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('started_at', staleThreshold)

  if (error) {
    console.warn('[consolidator] Failed to update log:', error.message)
  }
}

/**
 * Validate and sanitize extracted facts.
 *
 * Drops entries with empty content, corrects invalid memory_type
 * to 'fact', and clamps importance to [0, 1].
 */
function sanitizeFacts(raw: ExtractedFact[]): ExtractedFact[] {
  return raw.filter((f) => {
    if (
      !f.content ||
      typeof f.content !== 'string' ||
      f.content.trim().length === 0
    ) {
      return false
    }

    if (!VALID_MEMORY_TYPES.has(f.memory_type)) {
      f.memory_type = 'fact'
    }

    f.importance =
      typeof f.importance === 'number' ? clamp(f.importance, 0, 1) : 0.5

    return true
  })
}

/* ─── Main Handler ───────────────────────────────────────────────── */

Deno.serve(async (req) => {
  // ── CORS preflight ────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Uses custom secret (legacy JWT format) for auth from pg_net trigger,
  // because Supabase auto-injected SUPABASE_SERVICE_ROLE_KEY migrated to sb_secret_* format.
  const serviceKey = Deno.env.get('SENTIMENT_AUTH_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  let userId: string | null = null

  try {
    // ── 1. Auth guard ───────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!serviceKey || !authHeader || authHeader !== `Bearer ${serviceKey}`) {
      console.warn('[consolidator] Unauthorized request')
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // ── 2. Parse & validate body ────────────────────────────────
    const body = await req.json()
    userId = body.user_id ?? null

    if (!userId || typeof userId !== 'string') {
      return jsonResponse({ error: 'Missing or invalid user_id' }, 400)
    }

    // ── 3. Verify OpenAI key ────────────────────────────────────
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('[consolidator] OPENAI_API_KEY is not set')
      return jsonResponse({ error: 'OpenAI API key not configured' }, 500)
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)
    const openai = new OpenAI({ apiKey: openaiKey })

    // ── 4. Fetch recent messages (last 24 hours) ────────────────
    const windowStart = new Date(
      Date.now() - MESSAGES_WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString()

    const { data: messages, error: fetchErr } = await supabase
      .from('ai_chat_messages')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: true })

    if (fetchErr) {
      console.error('[consolidator] Fetch messages error:', fetchErr)
      await updateConsolidationLog(
        supabase, userId, 'failed', 0, fetchErr.message,
      )
      return jsonResponse({ error: 'Failed to fetch messages' }, 500)
    }

    if (!messages || messages.length === 0) {
      console.log(`[consolidator] No messages for user=${userId}, skipping`)
      await updateConsolidationLog(supabase, userId, 'success', 0)
      return jsonResponse({ success: true, facts_extracted: 0 })
    }

    // ── 5. Build conversation text ──────────────────────────────
    let conversationText = messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join('\n')

    if (conversationText.length > MAX_CONVERSATION_CHARS) {
      // Keep the tail (most recent messages carry newer context)
      conversationText = conversationText.slice(-MAX_CONVERSATION_CHARS)
      console.log('[consolidator] Conversation truncated to fit context window')
    }

    // ── 6. Extract facts via LLM (gpt-4o-mini) ─────────────────
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a knowledge extractor for a health & nutrition assistant. ' +
            'Extract personal facts, dietary preferences, health goals, ' +
            'experiences, and fears from the conversation. ' +
            'Return a JSON array only. Be concise — each fact should be ' +
            'one clear sentence. Skip generic or obvious information.',
        },
        {
          role: 'user',
          content:
            `<conversation>\n${conversationText}\n</conversation>\n\n` +
            'Return JSON array:\n' +
            '[{ "content": "...", "memory_type": "fact|preference|experience|goal|fear", ' +
            '"importance": 0.0-1.0 }]\n\n' +
            'Return ONLY valid JSON, no markdown.',
        },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    })

    let facts: ExtractedFact[] = []
    try {
      const rawContent = extraction.choices[0]?.message?.content ?? '[]'
      const cleaned = stripMarkdownFences(rawContent)
      const parsed = JSON.parse(cleaned)
      facts = Array.isArray(parsed) ? parsed : []
    } catch {
      console.warn('[consolidator] Failed to parse facts JSON, skipping')
      await updateConsolidationLog(supabase, userId, 'success', 0)
      return jsonResponse({ success: true, facts_extracted: 0 })
    }

    facts = sanitizeFacts(facts)

    if (facts.length === 0) {
      console.log(`[consolidator] No valid facts for user=${userId}`)
      await updateConsolidationLog(supabase, userId, 'success', 0)
      return jsonResponse({ success: true, facts_extracted: 0 })
    }

    // ── 7. Generate embeddings (batch request) ──────────────────
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: facts.map((f) => f.content),
      dimensions: EMBEDDING_DIMENSIONS,
    })

    // ── 8. Dedup & upsert each fact ─────────────────────────────
    let upsertedCount = 0

    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i]
      const embedding = embeddingResponse.data[i].embedding

      try {
        // Check for semantic duplicates via RPC
        const { data: matches } = await supabase.rpc('match_user_memories', {
          p_user_id: userId,
          query_embedding: embedding,
          match_count: 1,
          similarity_threshold: SIMILARITY_THRESHOLD,
          filter_type: fact.memory_type,
        })

        if (matches && matches.length > 0) {
          // Duplicate found → update with fresher wording
          const matchId = matches[0].id

          // access_count is not returned by the RPC — fetch separately
          const { data: existingRow } = await supabase
            .from('user_memory_vectors')
            .select('access_count')
            .eq('id', matchId)
            .single()

          await supabase
            .from('user_memory_vectors')
            .update({
              content: fact.content,
              importance: Math.max(fact.importance, matches[0].importance),
              access_count: (existingRow?.access_count ?? 0) + 1,
              last_accessed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', matchId)
        } else {
          // New fact → insert
          await supabase.from('user_memory_vectors').insert({
            user_id: userId,
            content: fact.content,
            memory_type: fact.memory_type,
            importance: fact.importance,
            embedding,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }

        upsertedCount++
      } catch (factErr: unknown) {
        // Per-fact error handling: log and continue with remaining facts
        const msg =
          factErr instanceof Error ? factErr.message : String(factErr)
        console.warn(`[consolidator] Failed to process fact #${i}: ${msg}`)
      }
    }

    // ── 9. Update consolidation log ─────────────────────────────
    await updateConsolidationLog(supabase, userId, 'success', upsertedCount)

    console.log(
      `[consolidator] user=${userId} facts_extracted=${upsertedCount}/${facts.length}`,
    )

    return jsonResponse({ success: true, facts_extracted: upsertedCount })
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err)
    console.error('[consolidator] Unexpected error:', errMessage)

    // Best-effort: update log even on unexpected failures
    if (userId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          serviceKey,
        )
        await updateConsolidationLog(
          supabase, userId, 'failed', 0, errMessage,
        )
      } catch {
        /* ignore secondary failure */
      }
    }

    return jsonResponse({ error: 'Internal error', message: errMessage }, 500)
  }
})
