/**
 * Shared CORS headers for Supabase Edge Functions.
 *
 * Re-used across all functions to ensure consistent
 * preflight handling and cross-origin access.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}
