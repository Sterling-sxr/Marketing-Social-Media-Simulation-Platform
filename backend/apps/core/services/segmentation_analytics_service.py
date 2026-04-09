from __future__ import annotations

from typing import Any

from ..repositories import (
    CourseAIUserIdentityRepository,
    CourseMemberRepository,
    CoursePost,
    CoursePostComment,
    CoursePostLike,
    CoursePostView,
    CourseProfile,
    CourseRepository,
    ProfileRepository,
)
from .profile_service import PROFILE_OPTIONS

UNKNOWN_BUCKET_KEY = "unknown"
UNKNOWN_BUCKET_LABEL = "Unknown"

LENS_CONFIG: dict[str, dict[str, Any]] = {
    "interests": {
        "label": "Interest Segment",
        "field": "interests",
        "overlapping": True,
        "options_key": "interests",
    },
    "age_group": {
        "label": "Age Group",
        "field": "age_group",
        "overlapping": False,
        "options_key": "age_groups",
    },
    "content_preference": {
        "label": "Content Preference",
        "field": "content_preference",
        "overlapping": False,
        "options_key": "content_preference",
    },
    "digital_time": {
        "label": "Activity Time",
        "field": "digital_time",
        "overlapping": False,
        "options_key": "digital_time",
    },
    "interaction_style": {
        "label": "Interaction Style",
        "field": "interaction_style",
        "overlapping": False,
        "options_key": "interaction_style",
    },
}


def _ensure_admin_for_course(*, user, course_id: int):
    if not (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)):
        raise PermissionError("Only administrators can access segmentation analytics.")
    course = CourseRepository.model.objects.filter(id=course_id, created_by_id=user.id).first()
    if not course:
        raise PermissionError("Course not found or not managed by current user.")
    return course


def _get_lens_config(lens: str | None) -> tuple[str, dict[str, Any]]:
    selected = (lens or "interests").strip()
    if selected not in LENS_CONFIG:
        raise ValueError(f"Unsupported segmentation lens: {selected}")
    return selected, LENS_CONFIG[selected]


def _course_posts(course_id: int) -> list[CoursePost]:
    return list(
        CoursePost.objects.filter(course_id=course_id)
        .select_related("author")
        .order_by("-created_at", "-id")
    )


def _student_ids(course_id: int) -> list[int]:
    return list(
        CourseMemberRepository.model.objects.filter(course_id=course_id, role="student")
        .values_list("user_id", flat=True)
    )


def _persona_sources_by_user(course_id: int, user_ids: list[int]) -> dict[int, Any]:
    if not user_ids:
        return {}

    sources: dict[int, Any] = {
        profile.user_id: profile
        for profile in CourseProfile.objects.filter(course_id=course_id, user_id__in=user_ids)
    }

    missing_user_ids = [user_id for user_id in user_ids if user_id not in sources]
    if not missing_user_ids:
        return sources

    ai_identity_map = {
        identity.user_id: identity.ai_user
        for identity in CourseAIUserIdentityRepository.model.objects.select_related("ai_user").filter(
            user_id__in=missing_user_ids,
            ai_user__course_id=course_id,
        )
    }
    sources.update(ai_identity_map)

    still_missing_user_ids = [user_id for user_id in missing_user_ids if user_id not in sources]
    if still_missing_user_ids:
        user_profiles = ProfileRepository.model.objects.filter(user_id__in=still_missing_user_ids)
        sources.update({profile.user_id: profile for profile in user_profiles})

    return sources


def _bucket_memberships(profile: Any | None, lens: str) -> list[tuple[str, str]]:
    config = LENS_CONFIG[lens]
    field = config["field"]
    if profile is None:
        return [(UNKNOWN_BUCKET_KEY, UNKNOWN_BUCKET_LABEL)]

    if lens == "interests":
        values = [str(item).strip() for item in (profile.interests or []) if str(item).strip()]
        if not values:
            return [(UNKNOWN_BUCKET_KEY, UNKNOWN_BUCKET_LABEL)]
        return [(value, value) for value in values]

    value = str(getattr(profile, field, "") or "").strip()
    if not value:
        return [(UNKNOWN_BUCKET_KEY, UNKNOWN_BUCKET_LABEL)]
    return [(value, value)]


def _empty_bucket(label: str, key: str) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "audience_users": set(),
        "engaged_users": set(),
        "metrics": {
            "views": 0,
            "likes": 0,
            "comments": 0,
        },
    }


def _option_order(lens: str) -> dict[str, int]:
    config = LENS_CONFIG[lens]
    options = PROFILE_OPTIONS.get(config["options_key"], []) or []
    return {value: idx for idx, value in enumerate(options)}


def _sort_segments(segments: list[dict[str, Any]], lens: str) -> list[dict[str, Any]]:
    order = _option_order(lens)

    def _key(item: dict[str, Any]):
        label = item["label"]
        is_unknown = label == UNKNOWN_BUCKET_LABEL
        return (
            is_unknown,
            order.get(label, len(order) + 1),
            -item["audience_count"],
            label.lower(),
        )

    return sorted(segments, key=_key)


def _engagement_rate(metrics: dict[str, int]) -> float:
    views = int(metrics.get("views", 0) or 0)
    if views <= 0:
        return 0.0
    return round((int(metrics.get("likes", 0) or 0) + int(metrics.get("comments", 0) or 0)) / views, 4)


def _segment_payload(bucket: dict[str, Any]) -> dict[str, Any]:
    metrics = bucket["metrics"]
    return {
        "key": bucket["key"],
        "label": bucket["label"],
        "audience_count": len(bucket["audience_users"]),
        "engaged_user_count": len(bucket["engaged_users"]),
        "metrics": {
            "views": metrics["views"],
            "likes": metrics["likes"],
            "comments": metrics["comments"],
            "engagement_rate": _engagement_rate(metrics),
        },
    }


def _pick_top_segment(segments: list[dict[str, Any]], *, reverse: bool) -> dict[str, Any] | None:
    eligible = [segment for segment in segments if segment["audience_count"] > 0]
    if not eligible:
        return None
    return sorted(
        eligible,
        key=lambda item: (
            item["metrics"]["engagement_rate"],
            item["engaged_user_count"],
            item["audience_count"],
            item["label"].lower(),
        ),
        reverse=reverse,
    )[0]


def _insight_summary(*, subject: str, lens: str, top_segment: dict[str, Any] | None, under_segment: dict[str, Any] | None) -> str:
    if not top_segment:
        return f"No attributable audience activity is available for this {subject} under the {lens} lens yet."
    if under_segment and under_segment["label"] != top_segment["label"]:
        return (
            f'{top_segment["label"]} showed the strongest engagement for this {subject}, '
            f'while {under_segment["label"]} responded least under the {lens} lens.'
        )
    return f'{top_segment["label"]} showed the strongest engagement for this {subject} under the {lens} lens.'


def _preview_text(content: str, limit: int = 72) -> str:
    text = (content or "").strip()
    if len(text) <= limit:
        return text or "Untitled post"
    return f"{text[: limit - 3].rstrip()}..."


def _compare_options(posts: list[CoursePost], *, exclude_post_id: int | None = None) -> list[dict[str, Any]]:
    items = []
    for post in posts:
        if exclude_post_id is not None and post.id == exclude_post_id:
            continue
        items.append(
            {
                "post_id": post.id,
                "label": _preview_text(post.content),
                "created_at": post.created_at.isoformat(),
            }
        )
    return items


def _aggregate_for_posts(*, course_id: int, lens: str, audience_user_ids: list[int], post_ids: list[int]) -> dict[str, Any]:
    profile_map = _persona_sources_by_user(course_id, audience_user_ids)
    memberships_by_user: dict[int, list[tuple[str, str]]] = {}
    bucket_map: dict[str, dict[str, Any]] = {}
    missing_profile_count = 0
    audience_set = set(audience_user_ids)

    for user_id in audience_user_ids:
        memberships = _bucket_memberships(profile_map.get(user_id), lens)
        memberships_by_user[user_id] = memberships
        if memberships == [(UNKNOWN_BUCKET_KEY, UNKNOWN_BUCKET_LABEL)]:
            missing_profile_count += 1
        for key, label in memberships:
            bucket = bucket_map.setdefault(key, _empty_bucket(label, key))
            bucket["audience_users"].add(user_id)

    missing_actor_identity_count = 0
    post_ids_set = set(post_ids)

    for model, metric_name in (
        (CoursePostView, "views"),
        (CoursePostLike, "likes"),
        (CoursePostComment, "comments"),
    ):
        for event in model.objects.filter(post_id__in=post_ids).values("post_id", "user_id"):
            if event["post_id"] not in post_ids_set:
                continue
            user_id = event["user_id"]
            if not user_id or user_id not in audience_set:
                missing_actor_identity_count += 1
                continue
            for key, label in memberships_by_user.get(user_id, [(UNKNOWN_BUCKET_KEY, UNKNOWN_BUCKET_LABEL)]):
                bucket = bucket_map.setdefault(key, _empty_bucket(label, key))
                bucket["engaged_users"].add(user_id)
                bucket["metrics"][metric_name] += 1

    segment_payloads = [_segment_payload(bucket) for bucket in bucket_map.values()]
    visible_segments = [
        segment
        for segment in segment_payloads
        if segment["audience_count"] > 0
        or segment["engaged_user_count"] > 0
        or sum(segment["metrics"][name] for name in ("views", "likes", "comments")) > 0
    ]
    sorted_segments = _sort_segments(visible_segments, lens)
    top_segment = _pick_top_segment(sorted_segments, reverse=True)
    under_segment = _pick_top_segment(sorted_segments, reverse=False)

    return {
        "segments": sorted_segments,
        "coverage": {
            "total_audience": len(audience_user_ids),
            "missing_profile_count": missing_profile_count,
            "missing_actor_identity_count": missing_actor_identity_count,
            "partial_data": bool(missing_actor_identity_count),
        },
        "insights": {
            "top_segment": top_segment,
            "under_engaged_segment": under_segment,
        },
    }


def _post_segmentation_summary(post: CoursePost, aggregated: dict[str, Any], lens: str) -> dict[str, Any]:
    top_segment = aggregated["insights"]["top_segment"]
    under_segment = aggregated["insights"]["under_engaged_segment"]
    return {
        "post_id": post.id,
        "label": _preview_text(post.content),
        "created_at": post.created_at.isoformat(),
        "top_segment": top_segment,
        "under_engaged_segment": under_segment,
        "summary_text": _insight_summary(
            subject="post",
            lens=lens,
            top_segment=top_segment,
            under_segment=under_segment,
        ),
    }


def _comparison_payload(*, post_id: int, compare_post_id: int, base_segments: list[dict[str, Any]], compare_segments: list[dict[str, Any]], compare_post_label: str) -> dict[str, Any]:
    base_map = {segment["key"]: segment for segment in base_segments}
    compare_map = {segment["key"]: segment for segment in compare_segments}
    merged_keys = sorted(set(base_map) | set(compare_map))

    items = []
    strongest = None
    for key in merged_keys:
        left = base_map.get(key)
        right = compare_map.get(key)
        label = (left or right)["label"]
        left_metrics = (left or {"metrics": {"views": 0, "likes": 0, "comments": 0, "engagement_rate": 0.0}})["metrics"]
        right_metrics = (right or {"metrics": {"views": 0, "likes": 0, "comments": 0, "engagement_rate": 0.0}})["metrics"]
        delta = round(left_metrics["engagement_rate"] - right_metrics["engagement_rate"], 4)
        item = {
            "key": key,
            "label": label,
            "post_metrics": left_metrics,
            "compare_metrics": right_metrics,
            "delta_engagement_rate": delta,
        }
        items.append(item)
        candidate = (abs(delta), delta, label.lower())
        if strongest is None or candidate > strongest[0]:
            strongest = (candidate, item)

    summary_text = ""
    if strongest:
        item = strongest[1]
        if item["delta_engagement_rate"] > 0:
            summary_text = f'{item["label"]} interacted more strongly with the selected post than with {compare_post_label}.'
        elif item["delta_engagement_rate"] < 0:
            summary_text = f'{item["label"]} interacted more strongly with {compare_post_label} than with the selected post.'
        else:
            summary_text = f'{item["label"]} responded similarly across both compared posts.'

    return {
        "post": {"post_id": post_id},
        "compare_post": {"post_id": compare_post_id, "label": compare_post_label},
        "segments": sorted(items, key=lambda item: item["label"].lower()),
        "summary_text": summary_text,
    }


def _base_response(*, selected_lens: str) -> dict[str, Any]:
    config = LENS_CONFIG[selected_lens]
    return {
        "selected_lens": selected_lens,
        "available_lenses": [
            {
                "key": key,
                "label": value["label"],
                "overlapping": value["overlapping"],
            }
            for key, value in LENS_CONFIG.items()
        ],
        "lens_meta": {
            "key": selected_lens,
            "label": config["label"],
            "overlapping": config["overlapping"],
            "supports_compare": True,
        },
    }


def get_admin_course_segmentation(*, user, course_id: int, lens: str | None = None) -> dict[str, Any]:
    course = _ensure_admin_for_course(user=user, course_id=course_id)
    selected_lens, _config = _get_lens_config(lens)
    posts = _course_posts(course.id)
    audience_user_ids = _student_ids(course.id)
    aggregated = _aggregate_for_posts(
        course_id=course.id,
        lens=selected_lens,
        audience_user_ids=audience_user_ids,
        post_ids=[post.id for post in posts],
    )

    post_summaries = []
    for post in posts:
        post_aggregated = _aggregate_for_posts(
            course_id=course.id,
            lens=selected_lens,
            audience_user_ids=audience_user_ids,
            post_ids=[post.id],
        )
        post_summaries.append(_post_segmentation_summary(post, post_aggregated, selected_lens))

    top_segment = aggregated["insights"]["top_segment"]
    under_segment = aggregated["insights"]["under_engaged_segment"]
    response = _base_response(selected_lens=selected_lens)
    response.update(
        {
            "course": {
                "id": course.id,
                "name": course.name,
                "course_code": course.course_code,
                "term": course.term,
            },
            "segments": aggregated["segments"],
            "coverage": aggregated["coverage"],
            "posts": post_summaries,
            "compare_options": _compare_options(posts),
            "insights": {
                **aggregated["insights"],
                "summary_text": _insight_summary(
                    subject="course audience",
                    lens=selected_lens,
                    top_segment=top_segment,
                    under_segment=under_segment,
                ),
            },
        }
    )
    return response


def get_admin_post_segmentation(
    *,
    user,
    course_id: int,
    post_id: int,
    lens: str | None = None,
    compare_post_id: int | None = None,
) -> dict[str, Any]:
    course = _ensure_admin_for_course(user=user, course_id=course_id)
    selected_lens, _config = _get_lens_config(lens)
    posts = _course_posts(course.id)
    post_map = {post.id: post for post in posts}
    post = post_map.get(post_id)
    if post is None:
        raise ValueError("Post not found in this course.")

    audience_user_ids = _student_ids(course.id)
    aggregated = _aggregate_for_posts(
        course_id=course.id,
        lens=selected_lens,
        audience_user_ids=audience_user_ids,
        post_ids=[post.id],
    )
    top_segment = aggregated["insights"]["top_segment"]
    under_segment = aggregated["insights"]["under_engaged_segment"]

    response = _base_response(selected_lens=selected_lens)
    response.update(
        {
            "post": {
                "post_id": post.id,
                "label": _preview_text(post.content),
                "created_at": post.created_at.isoformat(),
            },
            "segments": aggregated["segments"],
            "coverage": aggregated["coverage"],
            "compare_options": _compare_options(posts, exclude_post_id=post.id),
            "insights": {
                **aggregated["insights"],
                "summary_text": _insight_summary(
                    subject="post",
                    lens=selected_lens,
                    top_segment=top_segment,
                    under_segment=under_segment,
                ),
                "comparison_summary_text": "",
            },
            "comparison": None,
        }
    )

    if compare_post_id is not None:
        compare_post = post_map.get(compare_post_id)
        if compare_post is None:
            raise ValueError("Comparison post not found in this course.")
        compare_aggregated = _aggregate_for_posts(
            course_id=course.id,
            lens=selected_lens,
            audience_user_ids=audience_user_ids,
            post_ids=[compare_post.id],
        )
        comparison = _comparison_payload(
            post_id=post.id,
            compare_post_id=compare_post.id,
            base_segments=aggregated["segments"],
            compare_segments=compare_aggregated["segments"],
            compare_post_label=_preview_text(compare_post.content),
        )
        response["comparison"] = comparison
        response["insights"]["comparison_summary_text"] = comparison["summary_text"]

    return response


__all__ = [
    "LENS_CONFIG",
    "get_admin_course_segmentation",
    "get_admin_post_segmentation",
]
