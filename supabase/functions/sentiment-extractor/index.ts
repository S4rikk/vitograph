// ═══════════════════════════════════════════════════════════════════
// VITOGRAPH — Edge Function: sentiment-extractor
// Runtime: Deno (Supabase Edge Functions)
// Trigger: DB trigger on INSERT ai_chat_messages → pg_net POST
// Purpose: Classify user message sentiment, update emotional profile
// ═══════════════════════════════════════════════════════════════════

import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/* ─── Constants ──────────────────────────────────────────────────── */

const ALLOWED_MOODS = new Set([
  'anxious',
  'happy',
  'stressed',
  'neutral',
  'sad',
  'motivated',
  'frustrated',
])

/** Prevent oversized messages from inflating OpenAI token usage. */
const MAX_MESSAGE_LENGTH = 2000

/** How much trust grows per interaction. */
const TRUST_INCREMENT = 0.005

/** Number of recent valences kept for mood trend computation. */
const RECENT_VALENCES_WINDOW = 5

/* ─── Types ──────────────────────────────────────────────────────── */

interface SentimentRequest {
  user_id: string
  message: string
  thread_id?: string
}

interface SentimentResult {
  mood: string
  valence: number
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

/**
 * Determine mood trend from a sliding window of recent valences.
 *
 * Rules (from architecture spec):
 *  - Last 3 all positive → 'improving'
 *  - Last 3 all negative → 'declining'
 *  - Otherwise           → 'stable'
 */
function computeMoodTrend(
  recentValences: number[],
): 'improving' | 'stable' | 'declining' {
  if (recentValences.length < 3) return 'stable'

  const lastThree = recentValences.slice(-3)
  if (lastThree.every((v) => v > 0)) return 'improving'
  if (lastThree.every((v) => v < 0)) return 'declining'
  return 'stable'
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

/* ─── Main Handler ───────────────────────────────────────────────── */

Deno.serve(async (req) => {
  // ── CORS preflight ────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Auth guard ───────────────────────────────────────────
    // Uses custom secret SENTIMENT_AUTH_KEY (not SUPABASE_SERVICE_ROLE_KEY)
    // because Supabase migrated auto-injected keys to sb_secret_* format,
    // while _app_config / pg_net trigger still sends the legacy JWT key.
    const serviceKey = Deno.env.get('SENTIMENT_AUTH_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authHeader = req.headers.get('Authorization')

    if (!serviceKey || !authHeader || authHeader !== `Bearer ${serviceKey}`) {
      console.warn('[sentiment-extractor] Unauthorized request')
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // ── 2. Parse & validate body ────────────────────────────────
    const body: SentimentRequest = await req.json()
    const { user_id, message } = body

    if (!user_id || typeof user_id !== 'string') {
      return jsonResponse({ error: 'Missing or invalid user_id' }, 400)
    }
    if (
      !message ||
      typeof message !== 'string' ||
      message.trim().length === 0
    ) {
      return jsonResponse({ error: 'Missing or empty message' }, 400)
    }

    // ── 3. Verify OpenAI key ────────────────────────────────────
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('[sentiment-extractor] OPENAI_API_KEY is not set')
      return jsonResponse({ error: 'OpenAI API key not configured' }, 500)
    }

    // ── 4. Sentiment classification (gpt-4o-mini) ───────────────
    const truncatedMessage = message.slice(0, MAX_MESSAGE_LENGTH)
    const openai = new OpenAI({ apiKey: openaiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a sentiment classifier. Classify user message sentiment. ' +
            'Return ONLY valid JSON, no markdown.',
        },
        {
          role: 'user',
          content:
            `Classify this message: "${truncatedMessage}"\n` +
            'Return JSON: { "mood": "anxious|happy|stressed|neutral|sad|motivated|frustrated", ' +
            '"valence": <float from -1.0 to 1.0> }',
        },
      ],
      temperature: 0,
      max_tokens: 60,
    })

    // ── 5. Parse LLM response (fallback to neutral) ─────────────
    let sentiment: SentimentResult = { mood: 'neutral', valence: 0 }

    try {
      const rawContent = completion.choices[0]?.message?.content ?? ''
      const cleaned = stripMarkdownFences(rawContent)
      const parsed = JSON.parse(cleaned)

      const mood = ALLOWED_MOODS.has(parsed.mood) ? parsed.mood : 'neutral'
      const valence =
        typeof parsed.valence === 'number'
          ? clamp(parsed.valence, -1, 1)
          : 0

      sentiment = { mood, valence }
    } catch {
      console.warn(
        '[sentiment-extractor] Failed to parse LLM response, using defaults',
      )
    }

    // ── 6. Upsert emotional profile ─────────────────────────────
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

    // Fetch existing profile for incremental calculations
    const { data: existing } = await supabase
      .from('user_emotional_profile')
      .select('*')
      .eq('user_id', user_id)
      .single()

    const totalInteractions = (existing?.total_interactions ?? 0) + 1
    const positiveInteractions =
      (existing?.positive_interactions ?? 0) +
      (sentiment.valence > 0 ? 1 : 0)
    const negativeInteractions =
      (existing?.negative_interactions ?? 0) +
      (sentiment.valence < 0 ? 1 : 0)
    const engagementScore = clamp(
      positiveInteractions / totalInteractions,
      0,
      1,
    )
    const trustLevel = clamp(
      (existing?.trust_level ?? 0.5) + TRUST_INCREMENT,
      0,
      1,
    )

    // Track recent valences in learned_preferences for real mood trend
    const prevPreferences = existing?.learned_preferences ?? {}
    const recentValences: number[] = Array.isArray(
      prevPreferences.recent_valences,
    )
      ? [...prevPreferences.recent_valences]
      : []

    recentValences.push(sentiment.valence)
    while (recentValences.length > RECENT_VALENCES_WINDOW) {
      recentValences.shift()
    }

    const moodTrend = computeMoodTrend(recentValences)

    const { error: upsertError } = await supabase
      .from('user_emotional_profile')
      .upsert(
        {
          user_id,
          current_mood: sentiment.mood,
          mood_trend: moodTrend,
          total_interactions: totalInteractions,
          positive_interactions: positiveInteractions,
          negative_interactions: negativeInteractions,
          engagement_score: engagementScore,
          trust_level: trustLevel,
          learned_preferences: {
            ...prevPreferences,
            recent_valences: recentValences,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (upsertError) {
      console.error('[sentiment-extractor] Upsert error:', upsertError)
      return jsonResponse(
        { error: 'Database error', details: upsertError.message },
        500,
      )
    }

    console.log(
      `[sentiment-extractor] user=${user_id} mood=${sentiment.mood} ` +
        `valence=${sentiment.valence} trend=${moodTrend}`,
    )

    return jsonResponse({
      success: true,
      mood: sentiment.mood,
      valence: sentiment.valence,
    })
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err)
    console.error('[sentiment-extractor] Unexpected error:', errMessage)
    return jsonResponse({ error: 'Internal error', message: errMessage }, 500)
  }
})
