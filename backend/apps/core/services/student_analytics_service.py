from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any

from .course_post_service import list_posts_with_analytics_by_user


_EMPTY_ANALYTICS = {
    "summary": {
        "totalPosts": 0,
        "totalLikes": 0,
        "totalComments": 0,
        "totalShares": 0,
    },
    "topPosts": [],
    "engagementTrend": {
        "changePercent": 0,
        "direction": "up",
        "windowLabel": "Recent posts vs previous posts",
        "narrative": "Your recent posting performance is stable.",
        "extraInsight": "Publish a few more posts to unlock stronger trend comparisons.",
        "series": [],
    },
    "bestTimeToPost": {
        "bestHourLabel": "—",
        "summary": "There is not enough recent activity yet to identify a strong posting window.",
        "slots": [],
    },
    "audienceInsights": {
        "targetAudience": "Audience pattern still forming",
        "strongestEngagedAudience": "No strong engagement segment yet",
        "matchLevel": "Low",
        "breakdown": [],
    },
    "audiencePatterns": [],
    "aiInsight": {
        "title": "AI Insight",
        "headline": "More post activity is needed before a clear performance pattern emerges.",
        "detail": "Once you have a few posts with comments and views, this section can explain which content style and posting times work best.",
    },
    "contentPatterns": [],
    "suggestions": [
        {
            "id": "post-more",
            "title": "Publish a few more posts",
            "detail": "A larger post history will let analytics identify stronger timing and content-performance patterns.",
            "focus": "Baseline data",
            "priority": "Quick win",
        }
    ],
}


def _safe_int(value: Any) -> int:
    try:
        return max(int(value or 0), 0)
    except (TypeError, ValueError):
        return 0


def _parse_created_at(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _format_hour_label(hour: int) -> str:
    normalized = ((hour % 24) + 24) % 24
    suffix = "PM" if normalized >= 12 else "AM"
    display = 12 if normalized % 12 == 0 else normalized % 12
    return f"{display} {suffix}"


def _post_interactions(item: dict[str, Any]) -> int:
    return _safe_int(item.get("likes")) + _safe_int(item.get("comments"))


def _post_engagement_score(item: dict[str, Any]) -> int:
    return _post_interactions(item) + _safe_int(item.get("views"))


def _sort_key_for_top_post(item: dict[str, Any]) -> tuple[int, int, int, int, str]:
    return (
        _post_engagement_score(item),
        _post_interactions(item),
        _safe_int(item.get("likes")),
        _safe_int(item.get("comments")),
        str(item.get("created_at") or ""),
    )


def _recent_window_cutoff(items: list[dict[str, Any]]) -> datetime | None:
    parsed = [_parse_created_at(item.get("created_at")) for item in items]
    valid = [value for value in parsed if value is not None]
    if not valid:
        return None
    return max(valid) - timedelta(days=7)


def _recent_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cutoff = _recent_window_cutoff(items)
    if cutoff is None:
        return list(items)
    recent = [
        item
        for item in items
        if (_parse_created_at(item.get("created_at")) or datetime.min) >= cutoff
    ]
    return recent or list(items)


def _build_summary(items: list[dict[str, Any]]) -> dict[str, int]:
    total_likes = sum(_safe_int(item.get("likes")) for item in items)
    total_comments = sum(_safe_int(item.get("comments")) for item in items)
    total_views = sum(_safe_int(item.get("views")) for item in items)
    total_interactions = total_likes + total_comments
    return {
        "totalPosts": len(items),
        "totalLikes": total_likes,
        "totalComments": total_comments,
        "totalViews": total_views,
        "totalInteractions": total_interactions,
        "totalEngagement": total_interactions + total_views,
        "totalShares": 0,
    }


def _build_top_posts(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return []

    scored = sorted(items, key=_sort_key_for_top_post, reverse=True)[:3]

    return [
        {
            "id": item.get("id"),
            "content": item.get("title") or item.get("content") or "",
            "createdAt": item.get("created_at"),
            "likes": _safe_int(item.get("likes")),
            "comments": _safe_int(item.get("comments")),
            "views": _safe_int(item.get("views")),
            "interactions": _post_interactions(item),
            "shares": 0,
            "engagementScore": _post_engagement_score(item),
        }
        for item in scored
    ]


def _build_engagement_trend(items: list[dict[str, Any]]) -> dict[str, Any]:
    if not items:
        return dict(_EMPTY_ANALYTICS["engagementTrend"])

    sorted_items = sorted(
        items,
        key=lambda item: _parse_created_at(item.get("created_at")) or datetime.min,
    )
    latest = max((_parse_created_at(item.get("created_at")) for item in sorted_items), default=None)
    if latest is None:
        return dict(_EMPTY_ANALYTICS["engagementTrend"])

    current_start = latest - timedelta(days=7)
    previous_start = latest - timedelta(days=14)
    current = []
    previous = []
    for item in sorted_items:
        created_at = _parse_created_at(item.get("created_at"))
        if created_at is None:
            continue
        if created_at >= current_start:
            current.append(item)
        elif previous_start <= created_at < current_start:
            previous.append(item)

    if not current:
        current = _recent_items(sorted_items)

    previous_score = sum(_post_engagement_score(item) for item in previous)
    current_score = sum(_post_engagement_score(item) for item in current)

    if previous_score > 0:
        delta = round(((current_score - previous_score) * 100) / previous_score)
    elif current_score > 0:
        delta = 100
    else:
        delta = 0

    direction = "up" if delta >= 0 else "down"
    abs_delta = abs(delta)
    narrative = "Engagement is stable compared with the previous 7 days."
    if abs_delta > 0:
        narrative = (
            "Your recent posts are generating more total engagement than the previous 7 days."
            if direction == "up"
            else "Your recent posts are generating less total engagement than the previous 7 days."
        )

    recent_views = sum(_safe_int(item.get("views")) for item in current)
    recent_interactions = sum(_post_interactions(item) for item in current)
    extra_insight = (
        "Views are contributing most of your recent engagement volume."
        if recent_views > recent_interactions
        else "Likes and comments are contributing most of your recent engagement volume."
    )

    return {
        "changePercent": abs_delta,
        "direction": direction,
        "windowLabel": "Last 7 days vs previous 7 days",
        "narrative": narrative,
        "extraInsight": extra_insight,
        "series": [_post_engagement_score(item) for item in sorted_items[-7:]],
        "currentWindowEngagement": current_score,
        "previousWindowEngagement": previous_score,
    }


def _build_best_time_to_post(items: list[dict[str, Any]]) -> dict[str, Any]:
    if not items:
        return dict(_EMPTY_ANALYTICS["bestTimeToPost"])

    recent_items = _recent_items(items)
    buckets = [defaultdict(int) for _ in range(24)]
    for item in recent_items:
        created_at = _parse_created_at(item.get("created_at"))
        if not created_at:
            continue
        hour_bucket = buckets[created_at.hour]
        hour_bucket["engagement"] += _post_engagement_score(item)
        hour_bucket["posts"] += 1

    average_scores = [
        (bucket["engagement"] / bucket["posts"]) if bucket["posts"] else 0
        for bucket in buckets
    ]

    best_hour = max(range(24), key=lambda hour: average_scores[hour])
    if average_scores[best_hour] <= 0:
        return dict(_EMPTY_ANALYTICS["bestTimeToPost"])

    if best_hour >= 18 or best_hour < 5:
        summary = "Most engagement comes from posts published in the evening."
    elif best_hour >= 12:
        summary = "Most engagement comes from posts published in the afternoon."
    else:
        summary = "Most engagement comes from posts published in the morning."

    primary_start = (best_hour + 23) % 24
    primary_end = (best_hour + 1) % 24
    secondary_end = (best_hour + 3) % 24
    return {
        "bestHourLabel": _format_hour_label(best_hour),
        "summary": summary,
        "slots": [
            f"{_format_hour_label(primary_start)}–{_format_hour_label(primary_end)}",
            f"{_format_hour_label(best_hour)}–{_format_hour_label(secondary_end)}",
        ],
        "windowLabel": "Recent 7-day posting hours",
        "averageEngagement": round(average_scores[best_hour], 1),
        "sampleSize": buckets[best_hour]["posts"],
    }


def _persona_rules() -> list[tuple[str, str, tuple[str, ...]]]:
    return [
        (
            "AI Explorer",
            "Responds best to experiments, tools, and practical AI examples.",
            ("ai", "llm", "model", "prompt", "agent", "tool", "automation"),
        ),
        (
            "Time-poor Student",
            "Prefers short summaries, quick takeaways, and easy-to-scan posts.",
            ("summary", "quick", "tips", "checklist", "shortcut", "recap", "bullet"),
        ),
        (
            "Theory Lover",
            "Engages more with concept explanations and reflective discussion.",
            ("theory", "concept", "principle", "explain", "reflection", "framework"),
        ),
        (
            "Career Planner",
            "Responds to internship, industry, and portfolio-related content.",
            ("career", "industry", "internship", "portfolio", "job", "resume"),
        ),
    ]


def _build_audience_data(items: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, str]]]:
    if not items:
        return dict(_EMPTY_ANALYTICS["audienceInsights"]), list(_EMPTY_ANALYTICS["audiencePatterns"])

    persona_scores = Counter()
    hashtag_counter = Counter()

    for item in items:
        score = max(_post_engagement_score(item), 1)
        text = " ".join(
            [
                str(item.get("content") or ""),
                " ".join(str(tag).lower() for tag in (item.get("hashtags") or [])),
            ]
        ).lower()

        hashtags = [str(tag).strip().lower() for tag in (item.get("hashtags") or []) if str(tag).strip()]
        hashtag_counter.update(hashtags)

        matched = False
        for persona, _summary, keywords in _persona_rules():
            if any(keyword in text for keyword in keywords):
                persona_scores[persona] += score
                matched = True
        if not matched:
            persona_scores["Time-poor Student"] += score

    ranked = persona_scores.most_common(4)
    total = sum(score for _, score in ranked)
    breakdown = [
        {
            "persona": persona,
            "percentage": round((score * 100) / total) if total else 0,
        }
        for persona, score in ranked
    ]

    top_persona = ranked[0][0] if ranked else "Time-poor Student"
    top_share = breakdown[0]["percentage"] if breakdown else 0
    match_level = "High" if top_share >= 45 else "Medium" if top_share >= 25 else "Low"

    top_hashtags = [tag for tag, _count in hashtag_counter.most_common(2)]
    if top_hashtags:
        target_audience = f"People who engage with #{' and #'.join(top_hashtags)} style posts"
    else:
        target_audience = "Your current visible course audience"

    persona_summaries = {persona: summary for persona, summary, _keywords in _persona_rules()}
    audience_patterns = [
        {
            "persona": persona,
            "summary": persona_summaries.get(persona, "Engagement pattern still emerging."),
        }
        for persona, _score in ranked[:3]
    ]

    insights = {
        "targetAudience": target_audience,
        "strongestEngagedAudience": top_persona,
        "matchLevel": match_level,
        "breakdown": breakdown,
    }
    return insights, audience_patterns


def _pattern_rule_id(label: str) -> str:
    return label.lower().replace(" ", "-")


def _build_content_patterns(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return []

    baseline = sum(_post_engagement_score(item) for item in items) / max(len(items), 1)
    categories = {
        "Short, example-driven posts": [],
        "Question-led posts": [],
        "Hashtag-focused posts": [],
    }

    for item in items:
        content = str(item.get("content") or "")
        hashtags = item.get("hashtags") or []
        score = _post_engagement_score(item)
        if len(content.split()) <= 40:
            categories["Short, example-driven posts"].append(score)
        if "?" in content:
            categories["Question-led posts"].append(score)
        if hashtags:
            categories["Hashtag-focused posts"].append(score)

    patterns = []
    best_for = {
        "Short, example-driven posts": ["Time-poor Student", "AI Explorer"],
        "Question-led posts": ["AI Explorer", "Theory Lover"],
        "Hashtag-focused posts": ["Career Planner", "AI Explorer"],
    }
    notes = {
        "Short, example-driven posts": "Shorter posts are easier to scan and tend to convert views into comments more efficiently.",
        "Question-led posts": "Posts that end with a question tend to invite replies rather than passive views only.",
        "Hashtag-focused posts": "Consistent hashtags make it easier for similar-topic readers to find and react to your posts.",
    }

    for label, scores in categories.items():
        if not scores:
            continue
        average = sum(scores) / len(scores)
        if baseline > 0:
            delta = round(((average - baseline) * 100) / baseline)
        else:
            delta = 0
        sign = "+" if delta >= 0 else ""
        patterns.append(
            {
                "id": _pattern_rule_id(label),
                "label": label,
                "engagementDelta": f"{sign}{delta}%",
                "bestFor": best_for[label],
                "note": notes[label],
            }
        )

    patterns.sort(key=lambda item: int(item["engagementDelta"].replace("%", "")), reverse=True)
    return patterns[:3]


def _build_ai_insight(
    *,
    summary: dict[str, Any],
    engagement_trend: dict[str, Any],
    best_time: dict[str, Any],
    audience_insights: dict[str, Any],
    content_patterns: list[dict[str, Any]],
) -> dict[str, str]:
    top_pattern = content_patterns[0]["label"].lower() if content_patterns else "clear, focused posts"
    best_time_label = best_time.get("bestHourLabel") or "your strongest time window"
    top_audience = audience_insights.get("strongestEngagedAudience") or "your active audience"
    total_posts = summary.get("totalPosts", 0)

    headline = (
        f"Your strongest engagement currently comes from {top_pattern} posted around {best_time_label}."
        if total_posts
        else _EMPTY_ANALYTICS["aiInsight"]["headline"]
    )
    detail = (
        f"{top_audience} is reacting most consistently, and the current trend is {engagement_trend.get('direction', 'stable')} compared with your earlier posts."
        if total_posts
        else _EMPTY_ANALYTICS["aiInsight"]["detail"]
    )
    return {
        "title": "AI Insight",
        "headline": headline,
        "detail": detail,
    }


def _build_suggestions(
    *,
    engagement_trend: dict[str, Any],
    best_time: dict[str, Any],
    content_patterns: list[dict[str, Any]],
    audience_insights: dict[str, Any],
) -> list[dict[str, str]]:
    suggestions = []

    if best_time.get("bestHourLabel") and best_time["bestHourLabel"] != "—":
        suggestions.append(
            {
                "id": "timing-window",
                "title": f"Post around {best_time['bestHourLabel']}",
                "detail": "Your recent interaction totals are strongest around this hour. Try publishing within the surrounding high-response slots.",
                "focus": "Timing",
                "priority": "Quick win",
            }
        )

    top_pattern = content_patterns[0] if content_patterns else None
    if top_pattern:
        suggestions.append(
            {
                "id": "top-pattern",
                "title": f"Lean further into {top_pattern['label'].lower()}",
                "detail": top_pattern["note"],
                "focus": "Content structure",
                "priority": "High impact",
            }
        )

    strongest_audience = audience_insights.get("strongestEngagedAudience")
    if strongest_audience:
        suggestions.append(
            {
                "id": "audience-fit",
                "title": f"Write more directly for {strongest_audience}",
                "detail": "Your current engagement mix suggests this audience segment is the easiest one to convert into repeat interaction.",
                "focus": "Audience",
                "priority": "Growth focus",
            }
        )

    if engagement_trend.get("direction") == "down":
        suggestions.append(
            {
                "id": "re-engage",
                "title": "End each post with a clearer prompt",
                "detail": "Recent posts are trending down, so a more specific question or call to action can help pull comments back up.",
                "focus": "Engagement",
                "priority": "Next step",
            }
        )
    else:
        suggestions.append(
            {
                "id": "maintain-momentum",
                "title": "Keep the current format consistent",
                "detail": "Your recent posts are not underperforming, so consistency is more valuable than a full reset of style.",
                "focus": "Consistency",
                "priority": "Next step",
            }
        )

    return suggestions[:4]


def build_student_analytics_payload(*, user, target_user_id: int, limit: int | None = None) -> dict[str, Any]:
    items = list_posts_with_analytics_by_user(
        user=user,
        target_user_id=target_user_id,
        limit=limit,
    )

    if not items:
        return {
            "items": [],
            **_EMPTY_ANALYTICS,
        }

    summary = _build_summary(items)
    top_posts = _build_top_posts(items)
    engagement_trend = _build_engagement_trend(items)
    best_time = _build_best_time_to_post(items)
    audience_insights, audience_patterns = _build_audience_data(items)
    content_patterns = _build_content_patterns(items)
    ai_insight = _build_ai_insight(
        summary=summary,
        engagement_trend=engagement_trend,
        best_time=best_time,
        audience_insights=audience_insights,
        content_patterns=content_patterns,
    )
    suggestions = _build_suggestions(
        engagement_trend=engagement_trend,
        best_time=best_time,
        content_patterns=content_patterns,
        audience_insights=audience_insights,
    )

    return {
        "items": items,
        "summary": summary,
        "topPosts": top_posts,
        "engagementTrend": engagement_trend,
        "bestTimeToPost": best_time,
        "audienceInsights": audience_insights,
        "audiencePatterns": audience_patterns,
        "aiInsight": ai_insight,
        "contentPatterns": content_patterns,
        "suggestions": suggestions,
    }


__all__ = ["build_student_analytics_payload"]
