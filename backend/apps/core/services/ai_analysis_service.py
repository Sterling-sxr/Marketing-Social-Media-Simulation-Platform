"""Generic helpers for DeepSeek-driven analysis outputs."""
from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

try:  # optional dependency (same as ai_user_reaction_service)
    from openai import OpenAI
except ImportError:  # pragma: no cover - optional
    OpenAI = None  # type: ignore

logger = logging.getLogger(__name__)

_client_cache: OpenAI | None = None  # type: ignore[assignment]


def _get_client() -> OpenAI | None:  # type: ignore[return-type]
    api_key = getattr(settings, "DEEPSEEK_API_KEY", None)
    if not api_key:
        logger.warning("DEEPSEEK_API_KEY is not configured; skipping analysis calls.")
        return None
    if OpenAI is None:
        logger.warning("openai package not installed; cannot call DeepSeek.")
        return None

    global _client_cache
    if _client_cache is None:
        base_url = getattr(settings, "DEEPSEEK_API_BASE", "https://api.deepseek.com")
        _client_cache = OpenAI(api_key=api_key, base_url=base_url)
    return _client_cache


def _build_prompt(context: str, payload: dict[str, Any]) -> str:
    if context == "dashboard_spark_summary":
        summary = payload or {}
        totals = {
            "courses": summary.get("total_courses"),
            "students": summary.get("registered_students"),
            "posts": summary.get("total_posts"),
            "interactions": summary.get("total_interactions"),
        }
        totals_text = ", ".join(
            f"{label}={value if value is not None else 0}"
            for label, value in totals.items()
        )
        dataset = json.dumps(summary, indent=2, ensure_ascii=False)
        return (
            "You are an insightful but concise data storyteller for a university learning platform. "
            "Given dashboard metrics in JSON, first produce one sentence summarising OVERALL totals "
            f"({totals_text}). Then add 2-4 short sentences highlighting trends, standout courses/students, and sentiment. "
            "Respond with plain text only (no markdown, no emoji), under 120 words.\n\n"
            "DATA:\n" + dataset
        )
    raise ValueError(f"Unsupported analysis context: {context}")


def generate_ai_analysis(*, context: str, payload: dict[str, Any]) -> str:
    client = _get_client()
    if client is None:
        raise RuntimeError("DeepSeek client is unavailable.")

    prompt = _build_prompt(context, payload)
    model_name = getattr(settings, "DEEPSEEK_MODEL_NAME", "deepseek-chat")

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {
                "role": "system",
                "content": (
                    "You craft short analytical summaries for dashboards. Respond with plain text; "
                    "no JSON, no markdown, no emoji."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        stream=False,
    )

    message = response.choices[0].message
    text = (message.content or "").strip()
    if not text:
        raise RuntimeError("DeepSeek returned an empty response.")
    return text


__all__ = ["generate_ai_analysis"]
