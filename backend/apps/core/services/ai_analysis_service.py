"""Module summary: ai_analysis_service defines backend functionality with clear intent."""
from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

try:  # Inline explanation: this statement is clarified for maintainability.
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


_TUTOR_SYSTEM_PROMPT = (
    "You are an intelligent tutoring assistant for university students. "
    "Your goal is to help students genuinely understand concepts, not just receive answers.\n\n"
    "Always respond in English, regardless of the language the question is asked in.\n"
    "Adjust the depth of your explanation to match the complexity of the question:\n"
    "- For basic questions, use an introductory approach.\n"
    "- For advanced questions, provide a more systematic analysis.\n\n"
    "Follow these rules strictly:\n"
    "1. Lead with a direct answer.\n"
    "2. Use clear, plain language for abstract concepts.\n"
    "3. Structure your response with logical steps or points where applicable.\n"
    "4. Include a brief, concrete example when helpful.\n"
    "5. If the question has multiple cases or interpretations, address each one.\n"
    "6. If you are unsure, say so clearly - never fabricate information.\n"
    "7. Do not pretend to reference specific textbooks or internal course materials.\n\n"
    "You MUST respond with the following JSON format exactly - no extra text, "
    "no markdown code fences, no surrounding whitespace:\n"
    '{"short_answer":"1-2 sentence direct answer to the core question",'
    '"detailed_explanation":"expanded explanation of the reason, principle, or steps",'
    '"example":"a concrete example, or empty string if not applicable",'
    '"key_points":["key point 1","key point 2"]}'
)


def generate_tutor_response(*, question: str, history: list[dict] | None = None) -> dict[str, Any]:
    """Function summary: generate_tutor_response executes this unit of backend logic."""
    client = _get_client()
    if client is None:
        raise RuntimeError("DeepSeek client is unavailable.")

    model_name = getattr(settings, "DEEPSEEK_MODEL_NAME", "deepseek-chat")

    messages: list[dict[str, str]] = [{"role": "system", "content": _TUTOR_SYSTEM_PROMPT}]

    for turn in (history or []):
        role = turn.get("role", "")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": f"Student question:\n{question}"})

    response = client.chat.completions.create(
        model=model_name,
        messages=messages,
        stream=False,
    )

    raw = (response.choices[0].message.content or "").strip()
    if not raw:
        raise RuntimeError("DeepSeek returned an empty response.")

    # Section summary: this block is described for easier reading.
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError(f"DeepSeek returned non-JSON content: {raw[:200]}")

    return {
        "short_answer": str(data.get("short_answer", "")),
        "detailed_explanation": str(data.get("detailed_explanation", "")),
        "example": str(data.get("example", "")),
        "key_points": [str(p) for p in data.get("key_points", []) if p],
    }


__all__ = ["generate_ai_analysis", "generate_tutor_response"]

