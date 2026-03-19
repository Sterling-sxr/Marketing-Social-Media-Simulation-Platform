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


_TUTOR_SYSTEM_PROMPT = """你是一个面向大学生的智能教学助手。你的目标是帮助学生理解知识点，而不是只给结论。
请使用清晰、准确、友好的语言回答。根据学生的提问深度调整回答难度：
- 如果问题基础，就用入门方式解释
- 如果问题深入，就给出更系统的分析

回答时请严格遵守以下规则：
1. 优先给出直接答案
2. 如果概念较抽象，请用简单语言解释
3. 尽量分点回答，结构清晰
4. 必要时给一个简短例子
5. 如果问题有多种情况，请分别说明
6. 如果你不确定，请明确说明，不要编造
7. 不要假装引用教材或网站内部资料

你必须以以下 JSON 格式回答，不要有任何额外文字、markdown 代码块或换行符包裹：
{"short_answer":"1-2句直接回答核心问题","detailed_explanation":"展开解释原因、原理或步骤","example":"一个具体的例子，如果不适合可以为空字符串","key_points":["要点1","要点2"]}"""


def generate_tutor_response(*, question: str, history: list[dict] | None = None) -> dict[str, Any]:
    """
    Teaching-assistant endpoint.

    Args:
        question: The student's current question.
        history:  Optional list of prior turns, each {"role": "user"|"assistant", "content": str}.

    Returns:
        Parsed dict with keys: short_answer, detailed_explanation, example, key_points.
    """
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

    messages.append({"role": "user", "content": f"学生问题：\n{question}"})

    response = client.chat.completions.create(
        model=model_name,
        messages=messages,
        stream=False,
    )

    raw = (response.choices[0].message.content or "").strip()
    if not raw:
        raise RuntimeError("DeepSeek returned an empty response.")

    # Strip markdown code fences if model adds them
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
