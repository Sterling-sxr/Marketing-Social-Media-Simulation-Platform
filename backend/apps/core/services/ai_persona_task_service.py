from __future__ import annotations

import asyncio
import threading
import time
import uuid
from typing import Any

from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.utils.text import slugify

from .ai_persona_creation_service import (
    build_csv_preview_from_items,
    preview_generated_personas,
)
from .ai_user_service import ensure_can_manage_course_ai_users

_TASKS_LOCK = threading.Lock()
_TASKS: dict[str, dict[str, Any]] = {}
_TASK_TTL_SECONDS = 30 * 60
_TASK_MAX_COUNT = 200
_BATCH_THRESHOLD = 1000
_BATCH_SIZE = 1000
_BATCH_CONCURRENCY = 2


def _now() -> float:
    return time.time()


def _cleanup_tasks() -> None:
    cutoff = _now() - _TASK_TTL_SECONDS
    expired_ids = [task_id for task_id, task in _TASKS.items() if task.get("updated_at", 0) < cutoff]
    for task_id in expired_ids:
        _TASKS.pop(task_id, None)
    if len(_TASKS) <= _TASK_MAX_COUNT:
        return
    # Keep newest tasks when there are too many.
    ordered = sorted(_TASKS.items(), key=lambda item: item[1].get("updated_at", 0), reverse=True)
    keep_ids = {task_id for task_id, _ in ordered[:_TASK_MAX_COUNT]}
    for task_id in list(_TASKS.keys()):
        if task_id not in keep_ids:
            _TASKS.pop(task_id, None)


def _build_batch_payloads(payload: dict[str, Any]) -> list[dict[str, Any]]:
    requested_count = int(payload.get("count") or 0)
    if requested_count <= _BATCH_THRESHOLD:
        return [{**payload, "count": requested_count}]
    chunks: list[int] = []
    remaining = requested_count
    while remaining > 0:
        size = _BATCH_SIZE if remaining > _BATCH_SIZE else remaining
        chunks.append(size)
        remaining -= size
    return [{**payload, "count": size} for size in chunks]


def _dedupe_and_trim_items(*, items: list[dict[str, Any]], requested_count: int) -> list[dict[str, Any]]:
    seen_usernames: set[str] = set()
    unique_items: list[dict[str, Any]] = []
    for item in items:
        username = (item.get("username") or "").strip()
        if not username:
            continue
        base = slugify(username) or "generated-persona"
        unique_username = base
        suffix = 1
        while unique_username.lower() in seen_usernames:
            suffix += 1
            unique_username = f"{base}-{suffix}"
        seen_usernames.add(unique_username.lower())
        if unique_username != username:
            item_warnings = list(item.get("warnings") or [])
            item_warnings.append(
                f"Renamed username from `{username}` to `{unique_username}` while merging async batches."
            )
            item["warnings"] = item_warnings
            item["username"] = unique_username
        unique_items.append(item)
        if len(unique_items) >= requested_count:
            break
    return unique_items


async def _run_single_batch(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    def _call():
        close_old_connections()
        try:
            return preview_generated_personas(user=user, course_id=course_id, payload=payload)
        finally:
            close_old_connections()

    return await asyncio.to_thread(_call)


def _update_task_progress(*, task_id: str, completed: int, total: int) -> None:
    with _TASKS_LOCK:
        task = _TASKS.get(task_id)
        if not task:
            return
        task["progress"] = {"completed_batches": completed, "total_batches": total}
        task["updated_at"] = _now()


async def _preview_generated_personas_batched_async(
    *, user, course_id: int, payload: dict[str, Any], task_id: str
) -> dict[str, Any]:
    requested_count = int(payload.get("count") or 0)
    batch_payloads = _build_batch_payloads(payload)
    if len(batch_payloads) == 1:
        result = await _run_single_batch(user=user, course_id=course_id, payload=batch_payloads[0])
        result.setdefault("generation_meta", {})
        result["generation_meta"]["batch_count"] = 1
        result["csv_preview"] = build_csv_preview_from_items(result.get("items") or [])
        _update_task_progress(task_id=task_id, completed=1, total=1)
        return result

    semaphore = asyncio.Semaphore(_BATCH_CONCURRENCY)

    async def _run(index: int, batch_payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        async with semaphore:
            result = await _run_single_batch(user=user, course_id=course_id, payload=batch_payload)
            return index, result

    pending = [
        asyncio.create_task(_run(index, batch_payload))
        for index, batch_payload in enumerate(batch_payloads, start=1)
    ]
    results_by_index: dict[int, dict[str, Any]] = {}
    completed = 0
    total = len(batch_payloads)
    for finished in asyncio.as_completed(pending):
        index, batch_result = await finished
        results_by_index[index] = batch_result
        completed += 1
        _update_task_progress(task_id=task_id, completed=completed, total=total)
    results = [results_by_index[index] for index in sorted(results_by_index)]
    merged_items: list[dict[str, Any]] = []
    merged_warnings: list[str] = []
    repaired_count = 0
    rejected_count = 0
    for index, batch_result in enumerate(results, start=1):
        merged_items.extend(batch_result.get("items") or [])
        batch_warnings = list(batch_result.get("warnings") or [])
        if batch_warnings:
            merged_warnings.extend([f"[batch {index}] {warning}" for warning in batch_warnings])
        meta = batch_result.get("generation_meta") or {}
        repaired_count += int(meta.get("repaired_count") or 0)
        rejected_count += int(meta.get("rejected_count") or 0)

    final_items = _dedupe_and_trim_items(
        items=merged_items,
        requested_count=requested_count,
    )
    if not final_items:
        raise RuntimeError("AI persona generation did not produce any valid preview personas.")
    first_result = results[0]
    return {
        "items": final_items,
        "count": len(final_items),
        "warnings": merged_warnings,
        "cohort_blueprint": first_result.get("cohort_blueprint") or {},
        "generation_meta": {
            "model_strategy": "batched_async_parallel",
            "repaired_count": repaired_count,
            "rejected_count": rejected_count,
            "batch_count": len(batch_payloads),
        },
        "limits": first_result.get("limits") or {"mode": "generated"},
        "csv_preview": build_csv_preview_from_items(final_items),
    }


def _run_generated_preview_task(*, task_id: str, user_id: int, course_id: int, payload: dict[str, Any]) -> None:
    close_old_connections()
    with _TASKS_LOCK:
        task = _TASKS.get(task_id)
        if not task:
            return
        task["status"] = "running"
        task["updated_at"] = _now()

    try:
        user = get_user_model().objects.filter(id=user_id).first()
        if not user:
            raise ValueError("User not found.")
        result = asyncio.run(
            _preview_generated_personas_batched_async(
                user=user,
                course_id=course_id,
                payload=payload,
                task_id=task_id,
            )
        )
        with _TASKS_LOCK:
            task = _TASKS.get(task_id)
            if task:
                task["status"] = "succeeded"
                task["result"] = result
                task["updated_at"] = _now()
    except Exception as exc:  # noqa: BLE001
        with _TASKS_LOCK:
            task = _TASKS.get(task_id)
            if task:
                task["status"] = "failed"
                task["error"] = str(exc)
                task["updated_at"] = _now()
    finally:
        close_old_connections()


def start_generated_preview_task(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    # Validate permission and course existence before launching background work.
    ensure_can_manage_course_ai_users(user=user, course_id=course_id)
    total_batches = len(_build_batch_payloads(payload))
    task_id = uuid.uuid4().hex
    task = {
        "task_id": task_id,
        "status": "pending",
        "course_id": course_id,
        "user_id": int(user.id),
        "result": None,
        "error": "",
        "progress": {"completed_batches": 0, "total_batches": total_batches},
        "created_at": _now(),
        "updated_at": _now(),
    }
    with _TASKS_LOCK:
        _cleanup_tasks()
        _TASKS[task_id] = task

    thread = threading.Thread(
        target=_run_generated_preview_task,
        kwargs={
            "task_id": task_id,
            "user_id": int(user.id),
            "course_id": int(course_id),
            "payload": payload,
        },
        daemon=True,
        name=f"ai-persona-preview-{task_id[:8]}",
    )
    thread.start()
    return {"task_id": task_id, "status": "pending"}


def get_generated_preview_task(*, user, course_id: int, task_id: str) -> dict[str, Any]:
    with _TASKS_LOCK:
        _cleanup_tasks()
        task = _TASKS.get(task_id)
        if not task:
            raise ValueError("Preview task not found or expired.")
        if task.get("course_id") != int(course_id):
            raise PermissionError("You do not have access to this preview task.")
        if task.get("user_id") != int(user.id):
            raise PermissionError("You do not have access to this preview task.")
        status = task.get("status", "pending")
        payload = {"task_id": task_id, "status": status}
        payload["progress"] = task.get("progress") or {
            "completed_batches": 0,
            "total_batches": 0,
        }
        if status == "succeeded":
            payload["result"] = task.get("result") or {}
        elif status == "failed":
            payload["error"] = task.get("error") or "Preview task failed."
        return payload


__all__ = ["start_generated_preview_task", "get_generated_preview_task"]
