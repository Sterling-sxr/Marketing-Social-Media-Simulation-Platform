"""Module summary: Collect related domain logic and document the intended design boundaries."""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from dataclasses import dataclass
from typing import Any

from asgiref.sync import sync_to_async
from django.conf import settings
from django.utils import timezone

from ..repositories import (
    CourseAIUserIdentityRepository,
    CourseAIUserRepository,
    CoursePost,
)

try:
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover – optional dependency
    AsyncOpenAI = None  # type: ignore[assignment,misc]

logger = logging.getLogger(__name__)


# Context: Compute shared values once so all branches use the same normalized inputs.
# Context: Compute shared values once so all branches use the same normalized inputs.
# Purpose: Orchestrate `_get_client_kwargs` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def _get_client_kwargs() -> dict[str, str] | None:
    """Execute the `_get_client_kwargs` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    api_key = getattr(settings, "DEEPSEEK_API_KEY", None)
    if not api_key:
        return None
    if AsyncOpenAI is None:
        logger.warning("openai package is not installed; skip DeepSeek reactions.")
        return None
    return {
        "api_key": api_key,
        "base_url": getattr(settings, "DEEPSEEK_API_BASE", "https://api.deepseek.com"),
    }


# Context: Compute shared values once so all branches use the same normalized inputs.
# Context: Compute shared values once so all branches use the same normalized inputs.
# Purpose: Orchestrate `schedule_ai_reactions` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def schedule_ai_reactions(course_id: int, post_id: int, delay_seconds: float = 0.0) -> None:
    """Execute the `schedule_ai_reactions` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    if not getattr(settings, "DEEPSEEK_API_KEY", None):
        logger.debug("DEEPSEEK_API_KEY not configured; skip AI reactions for post=%s", post_id)
        return
    logger.info("Scheduling async AI reactions for course=%s post=%s", course_id, post_id)

    def _runner() -> None:
        if delay_seconds:
            time.sleep(delay_seconds)
        try:
            asyncio.run(async_handle_post_reactions(course_id, post_id))
        except Exception:  # noqa: BLE001
            logger.exception("AI reaction task failed for course=%s post=%s", course_id, post_id)

    threading.Thread(
        target=_runner,
        name=f"ai-reactions-{course_id}-{post_id}",
        daemon=True,
    ).start()


# Context: Compute shared values once so all branches use the same normalized inputs.
# Context: Compute shared values once so all branches use the same normalized inputs.
# Context: Compute shared values once so all branches use the same normalized inputs.

@dataclass
class ReactionDecision:
    interested: bool
    like_post: bool
    comment_text: str


# Context: Compute shared values once so all branches use the same normalized inputs.
# Context: Compute shared values once so all branches use the same normalized inputs.
# Purpose: Orchestrate `_build_persona_prompt` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
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
        "`interested` (bool), `like` (bool), `comment` (string). "
        "Use an empty string when no comment is needed.\n\n"
        f'Post content:\n"""{post.content}"""\n'
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


# Context: Compute shared values once so all branches use the same normalized inputs.
# Context: Compute shared values once so all branches use the same normalized inputs.
# Purpose: Orchestrate `async_handle_post_reactions` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
async def async_handle_post_reactions(course_id: int, post_id: int) -> None:
    """Execute the `async_handle_post_reactions` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    kwargs = _get_client_kwargs()
    if kwargs is None:
        return

    _db = lambda fn, *a, **kw: sync_to_async(fn, thread_sensitive=False)(*a, **kw)  # noqa: E731

    try:
        post = await _db(
            CoursePost.objects.select_related("course", "author").get,
            id=post_id,
            course_id=course_id,
        )
    except CoursePost.DoesNotExist:
        logger.debug("Post %s not found for course %s; skip AI reactions.", post_id, course_id)
        return

    if post.course and post.course.end_date and timezone.localdate() > post.course.end_date:
        logger.debug("Course %s already ended; skip AI reactions.", course_id)
        return

    ai_users: list = await _db(CourseAIUserRepository.list_for_course, course_id)
    if not ai_users:
        logger.debug("No AI users found for course %s; nothing to do.", course_id)
        return

    logger.info(
        "Starting async AI reactions for post=%s course=%s — %s personas running concurrently",
        post_id,
        course_id,
        len(ai_users),
    )

    async with AsyncOpenAI(**kwargs) as client:
        tasks = [
            _handle_single_ai_user(client, ai_user, post, course_id, post_id)
            for ai_user in ai_users
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    for ai_user, result in zip(ai_users, results):
        if isinstance(result, Exception):
            logger.error(
                "AI reaction failed for ai_user=%s post=%s: %s",
                ai_user.id,
                post_id,
                result,
                exc_info=result,
            )


async def _handle_single_ai_user(
    client: Any,  # Inline explanation: Keep normalization explicit.
    ai_user: Any,
    post: CoursePost,
    course_id: int,
    post_id: int,
) -> None:
    """Execute the `_handle_single_ai_user` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    _db = lambda fn, *a, **kw: sync_to_async(fn, thread_sensitive=False)(*a, **kw)  # noqa: E731

    identity = getattr(ai_user, "identity", None)
    system_user = identity.user if identity else None

    if not system_user:
        logger.debug("AI user %s missing identity, attempting repair.", ai_user.id)
        try:
            # Inline explanation: Keep normalization explicit.
            from .ai_user_service import ensure_ai_user_identity

            if post.course:
                await _db(ensure_ai_user_identity, ai_user)
                identity = await _db(CourseAIUserIdentityRepository.get_by_ai_user, ai_user.id)
                system_user = identity.user if identity else None
        except Exception:  # noqa: BLE001
            logger.exception("Failed to repair identity for AI user %s", ai_user.id)
            system_user = None

    if not system_user:
        return

    # Context: Compute shared values once so all branches use the same normalized inputs.
    if post.author_id == system_user.id:
        return

    prompt = _build_persona_prompt(ai_user, post)
    logger.debug(
        "Evaluating AI user %s (%s) for post=%s",
        ai_user.id,
        system_user.username,
        post_id,
    )

    decision = await _async_request_decision(prompt, client)
    if decision is None:
        logger.debug("No decision returned for ai_user=%s post=%s", ai_user.id, post_id)
        return

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
        return

    if decision.like_post:
        try:
            from .course_post_service import like_course_post

            await _db(like_course_post, user=system_user, course_id=course_id, post_id=post_id)
            logger.info("AI user %s liked post %s", ai_user.id, post_id)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to like post %s for AI user %s", post_id, ai_user.id)

    if decision.comment_text:
        try:
            from .course_post_service import add_comment_to_post

            await _db(
                add_comment_to_post,
                user=system_user,
                course_id=course_id,
                post_id=post_id,
                content=decision.comment_text,
            )
            logger.info("AI user %s commented on post %s: %s", ai_user.id, post_id, decision.comment_text)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to comment on post %s for AI user %s", post_id, ai_user.id)


async def _async_request_decision(prompt: str, client: Any) -> ReactionDecision | None:
    """Execute the `_async_request_decision` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    model_name = getattr(settings, "DEEPSEEK_MODEL_NAME", "deepseek-chat")
    try:
        response = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a JSON-only decision helper."},
                {"role": "user", "content": prompt},
            ],
            stream=False,
            response_format={"type": "json_object"},
        )
    except Exception:  # noqa: BLE001
        logger.exception("DeepSeek async request failed.")
        return None

    message = response.choices[0].message
    content = getattr(message, "parsed", None) or message.content
    try:
        return _parse_decision(content)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to parse DeepSeek response: %s", content)
        return None


# Context: Compute shared values once so all branches use the same normalized inputs.
# Context: Compute shared values once so all branches use the same normalized inputs.
# Purpose: Orchestrate `handle_post_reactions` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def handle_post_reactions(course_id: int, post_id: int) -> None:
    """Execute the `handle_post_reactions` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    asyncio.run(async_handle_post_reactions(course_id, post_id))


def _request_decision(prompt: str, client: Any = None) -> ReactionDecision | None:
    """Execute the `_request_decision` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """

    async def _run() -> ReactionDecision | None:
        kwargs = _get_client_kwargs()
        if kwargs is None:
            return None
        async with AsyncOpenAI(**kwargs) as c:
            return await _async_request_decision(prompt, c)

    return asyncio.run(_run())


def evaluate_persona_prompt(prompt: str) -> ReactionDecision | None:
    """Execute the `evaluate_persona_prompt` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    return _request_decision(prompt)


__all__ = [
    "schedule_ai_reactions",
    "handle_post_reactions",
    "async_handle_post_reactions",
    "evaluate_persona_prompt",
    "ReactionDecision",
]
