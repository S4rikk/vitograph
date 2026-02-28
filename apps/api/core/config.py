"""Application configuration loaded from environment variables.

Uses ``pydantic-settings`` so every value can be overridden via
``.env`` file or real environment variables without touching code.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the VITOGRAPH API.

    Attributes:
        supabase_url: Full URL of the Supabase project
            (e.g. ``https://xyz.supabase.co``).
        supabase_key: Supabase ``anon`` or ``service_role`` key.
        supabase_service_role_key: Optional service-role key for
            admin-level operations that bypass RLS.
        openai_api_key: API key for the OpenAI API.
        openai_model: OpenAI model identifier for LLM calls.
        debug: Enable verbose logging and debug mode.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Supabase ─────────────────────────────────────────────────
    supabase_url: str
    supabase_key: str
    supabase_service_role_key: str = ""

    # ── OpenAI ─────────────────────────────────────────────────────
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # ── App ──────────────────────────────────────────────────────
    debug: bool = False


# Module-level singleton — import ``settings`` directly.
settings = Settings()  # type: ignore[call-arg]
