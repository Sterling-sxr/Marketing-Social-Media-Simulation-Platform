"""Background helpers that let AI personas react to new posts."""
from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.utils import timezone

from ..repositories import (
    CourseAIUserIdentityRepository,
    CourseAIUserRepository,
    CoursePost,
)

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - optional dependency
    OpenAI = None  # type: ignore

logger = logging.getLogger(__name__)

_client_cache: OpenAI | None = None  # type: ignore[assignment]


def _get_client() -> OpenAI | None:  # type: ignore[return-type]
    api_key = getattr(settings, "DEEPSEEK_API_KEY", None)
    if not api_key:
        return None
    if OpenAI is None:
        logger.warning("openai package is not installed; skip DeepSeek reactions.")
        return None
    global _client_cache
    if _client_cache is None:
        base_url = getattr(settings, "DEEPSEEK_API_BASE", "https://api.deepseek.com")
        _client_cache = OpenAI(api_key=api_key, base_url=base_url)
    return _client_cache


def schedule_ai_reactions(course_id: int, post_id: int, delay_seconds: float = 0.0) -> None:
    """
    Fire-and-forget helper that triggers AI reactions in a background thread.
    """
    if not getattr(settings, "DEEPSEEK_API_KEY", None):
        logger.debug("DEEPSEEK_API_KEY not configured; skip AI reactions for post=%s", post_id)
        return
    logger.info("Scheduling AI reactions for course=%s post=%s", course_id, post_id)

    def _runner() -> None:
        if delay_seconds:
            time.sleep(delay_seconds)
        try:
            handle_post_reactions(course_id, post_id)
        except Exception:  # noqa: BLE001
            logger.exception("AI reaction task failed for course=%s post=%s", course_id, post_id)

    threading.Thread(
        target=_runner,
        name=f"ai-reactions-{course_id}-{post_id}",
        daemon=True,
    ).start()


@dataclass
class ReactionDecision:
    interested: bool
    like_post: bool
    comment_text: str


def _build_persona_prompt(ai_user, post: CoursePost) -> str:
    persona_lines = [
        f"Display Name: {ai_user.display_name or ai_user.username}",
        f"Gender: {ai_user.gender or 'Unknown'}",
        f"City: {ai_user.city or 'Unknown'}",
        f"Age Group: {ai_user.age_group or 'Unknown'}",
        f"Education: {ai_user.education_level or 'Unknown'}",
        f"Income Level: {ai_user.income_level or 'Unknown'}",
        f"Interests: {', '.join(ai_user.interests) if ai_user.interests else 'None'}",
        f"Social Value (1-10): {ai_user.social_value or 5}",
        f"Sociability (1-10): {ai_user.sociability or 5}",
        f"Openness (1-10): {ai_user.openness or 5}",
        f"Preferred Content: {ai_user.content_preference or 'Unknown'}",
        f"Shopping Frequency: {ai_user.shopping_frequency or 'Unknown'}",
        f"Interaction Style: {ai_user.interaction_style or 'Unknown'}",
    ]
    course_info = f"{post.course.course_code} - {post.course.name}" if post.course else "the course"
    return (
        "You are simulating a student persona with the following attributes:\n"
        f"{chr(10).join(persona_lines)}\n\n"
        f"Evaluate the new post shared in {course_info}.\n"
        "Decide if the persona is interested. If yes, decide whether to like the post and optionally craft a short comment "
        "(max 200 characters, keep a friendly tone). Respond strictly in JSON with keys "
        '`interested` (bool), `like` (bool), `comment` (string). '
        "Use an empty string when no comment is needed.\n\n"
        f"Post content:\n\"\"\"{post.content}\"\"\"\n"
    )


def _parse_decision(raw: str | dict[str, Any]) -> ReactionDecision:
    if isinstance(raw, dict):
        payload = raw
    else:
        payload = json.loads(raw)
    interested = bool(payload.get("interested"))
    like_post = bool(payload.get("like"))
    comment_text = str(payload.get("comment") or "").strip()
    return ReactionDecision(
        interested=interested,
        like_post=like_post and interested,
        comment_text=comment_text if interested else "",
    )


def handle_post_reactions(course_id: int, post_id: int) -> None:
    """
    Core routine executed in background to evaluate AI reactions.
    """
    client = _get_client()
    if client is None:
        return

    try:
        post = CoursePost.objects.select_related("course", "author").get(id=post_id, course_id=course_id)
    except CoursePost.DoesNotExist:
        logger.debug("Post %s not found for course %s; skip AI reactions.", post_id, course_id)
        return

    if post.course and post.course.end_date and timezone.localdate() > post.course.end_date:
        logger.debug("Course %s already ended; skip AI reactions.", course_id)
        return

    ai_users = CourseAIUserRepository.list_for_course(course_id)
    if not ai_users:
        logger.debug("No AI users found for course %s; nothing to do.", course_id)
        return
    logger.info(
        "Starting AI reactions for post=%s course=%s with %s personas",
        post_id,
        course_id,
        len(ai_users),
    )
    per_user_delay = float(getattr(settings, "DEEPSEEK_AI_USER_DELAY_SECONDS", "0.0"))

    for index, ai_user in enumerate(ai_users):
        identity = getattr(ai_user, "identity", None)
        system_user = identity.user if identity else None
        if not system_user:
            # Ensure identity exists; this can happen for legacy records.
            logger.debug("AI user %s missing identity, attempting repair.", ai_user.id)
            # Re-fetch to leverage service helper.
            from .ai_user_service import ensure_ai_user_identity  # local import to avoid circular dependency

            try:
                course = post.course
                if course:
                    ensure_ai_user_identity(ai_user)
                    identity = CourseAIUserIdentityRepository.get_by_ai_user(ai_user.id)
                    system_user = identity.user if identity else None
            except Exception:  # noqa: BLE001
                logger.exception("Failed to repair identity for AI user %s", ai_user.id)
                system_user = None

        if not system_user:
            continue

        # Skip self reactions (AI authored post)
        if post.author_id == system_user.id:
            continue

        prompt = _build_persona_prompt(ai_user, post)
        logger.debug(
            "Evaluating AI user %s (%s) for post=%s with prompt length=%s",
            ai_user.id,
            system_user.username,
            post_id,
            len(prompt),
        )

        decision = _request_decision(prompt, client)
        if decision is None:
            logger.debug("DeepSeek did not return a decision for ai_user=%s post=%s", ai_user.id, post_id)
            continue
        logger.info(
            "DeepSeek decision for ai_user=%s post=%s: %s",
            ai_user.id,
            post_id,
            json.dumps(
                {
                    "interested": decision.interested,
                    "like": decision.like_post,
                    "comment": decision.comment_text,
                },
                ensure_ascii=False,
            ),
        )

        if not decision.interested:
            logger.debug("AI user %s not interested in post %s", ai_user.id, post_id)
            continue

        # Perform reactions inside try/except to isolate failures.
        if decision.like_post:
            try:
                from .course_post_service import like_course_post

                like_course_post(user=system_user, course_id=course_id, post_id=post_id)
                logger.info("AI user %s liked post %s", ai_user.id, post_id)
            except Exception:  # noqa: BLE001
                logger.exception("Failed to like post %s for AI user %s", post_id, ai_user.id)

        if decision.comment_text:
            try:
                from .course_post_service import add_comment_to_post

                add_comment_to_post(
                    user=system_user,
                    course_id=course_id,
                    post_id=post_id,
                    content=decision.comment_text,
                )
                logger.info(
                    "AI user %s commented on post %s: %s",
                    ai_user.id,
                    post_id,
                    decision.comment_text,
                )
            except Exception:  # noqa: BLE001
                logger.exception("Failed to comment on post %s for AI user %s", post_id, ai_user.id)

        if per_user_delay and index + 1 < len(ai_users):
            time.sleep(per_user_delay)


def _request_decision(prompt: str, client: OpenAI | None = None) -> ReactionDecision | None:
    client = client or _get_client()
    if client is None:
        return None
    model_name = getattr(settings, "DEEPSEEK_MODEL_NAME", "deepseek-chat")
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a JSON-only decision helper."},
                {"role": "user", "content": prompt},
            ],
            stream=False,
            response_format={"type": "json_object"},
        )
    except Exception:  # noqa: BLE001
        logger.exception("DeepSeek request failed.")
        return None

    message = response.choices[0].message
    content = getattr(message, "parsed", None) or message.content
    try:
        return _parse_decision(content)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to parse DeepSeek response: %s", content)
        return None


def evaluate_persona_prompt(prompt: str) -> ReactionDecision | None:
    """Public helper to evaluate arbitrary persona prompts (used for recommendations)."""
    return _request_decision(prompt)


__all__ = ["schedule_ai_reactions", "handle_post_reactions", "evaluate_persona_prompt"]
