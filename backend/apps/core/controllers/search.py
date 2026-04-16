# Section summary: this block is described for easier reading.
import json

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from apps.core.repositories.models import CoursePost, SearchLog, UserProfile

User = get_user_model()

_RANK_LABELS = {
    "high": "Trending post",
    "medium": "Active discussion",
    "low": "",
}


# Function summary: _save_search_history implements this backend behavior.
def _save_search_history(request, query: str) -> None:
    if request.user.is_authenticated:
        # Section summary: this block is described for easier reading.
        # Section summary: this block is described for easier reading.
        # Section summary: this block is described for easier reading.
        profile = UserProfile.objects.filter(user=request.user).first()
        if profile is not None:
            history = profile.search_history or []
            normalized = [h for h in history if h.lower() != query.lower()]
            profile.search_history = [query, *normalized][:10]
            profile.save(update_fields=["search_history"])
        try:
            SearchLog.objects.create(user=request.user, keyword=query)
        except Exception:
            pass
    else:
        history = request.session.get("search_history", [])
        normalized = [h for h in history if h.lower() != query.lower()]
        request.session["search_history"] = [query, *normalized][:10]


@require_GET
# Function summary: search_posts implements this backend behavior.
def search_posts(request):
    """Function summary: search_posts executes this unit of backend logic."""
    query = request.GET.get("q", "").strip()
    if not query:
        return JsonResponse({"results": []})

    # Section summary: this block is described for easier reading.
    # Section summary: this block is described for easier reading.
    # Section summary: this block is described for easier reading.
    tokens = [t for t in query.split() if t]

    token_filter = Q()
    for token in tokens:
        clean = token.lstrip("#").lower()
        token_filter &= (
            Q(content__icontains=token)
            | Q(hashtags__contains=[clean])
            | Q(author__username__icontains=token)
        )

    posts_qs = (
        CoursePost.objects.select_related("author", "course")
        .annotate(like_count=Count("likes"))
        .filter(token_filter)
        .order_by("-like_count", "-created_at")[:50]
    )

    results = []
    for p in posts_qs:
        content = p.content
        title = content[:60].rstrip()
        if len(content) > 60:
            title += "…"
        snippet = content[:200].rstrip()
        if len(content) > 200:
            snippet += "…"

        if p.like_count >= 5:
            rank_label = _RANK_LABELS["high"]
        elif p.like_count >= 2:
            rank_label = _RANK_LABELS["medium"]
        else:
            rank_label = _RANK_LABELS["low"]

        results.append({
            "id": f"post-{p.id}",
            "type": "post",
            "title": title,
            "snippet": snippet,
            "href": f"/courses/{p.course_id}/posts/{p.id}",
            "courseName": p.course.name,
            "authorName": p.author.username,
            "createdAt": p.created_at.isoformat(),
            "rankLabel": rank_label,
        })

    _save_search_history(request, query)

    return JsonResponse({"results": results})


@require_GET
# Function summary: suggested_search implements this backend behavior.
def suggested_search(request):
    """Function summary: suggested_search executes this unit of backend logic."""
    top_keywords = (
        SearchLog.objects.values("keyword")
        .annotate(hit_count=Count("keyword"))
        .order_by("-hit_count")[:10]
    )
    suggestions = [
        {
            "id": f"hot-{i + 1}",
            "keyword": k["keyword"],
            "hitCount": k["hit_count"],
            "blurb": "",
        }
        for i, k in enumerate(top_keywords)
    ]
    return JsonResponse(suggestions, safe=False)


@require_GET
# Function summary: get_search_history implements this backend behavior.
def get_search_history(request):
    """Function summary: get_search_history executes this unit of backend logic."""
    if request.user.is_authenticated:
        profile = UserProfile.objects.filter(user=request.user).first()
        history = profile.search_history if profile else []
    else:
        history = request.session.get("search_history", [])
    return JsonResponse(history, safe=False)


@require_POST
# Function summary: add_search_history implements this backend behavior.
def add_search_history(request):
    """Function summary: add_search_history executes this unit of backend logic."""
    try:
        body = json.loads(request.body)
        keyword = body.get("keyword", "").strip()
    except (json.JSONDecodeError, AttributeError):
        keyword = request.POST.get("keyword", "").strip()

    if not keyword:
        return JsonResponse({"error": "Missing keyword"}, status=400)

    _save_search_history(request, keyword)
    return JsonResponse({"success": True, "keyword": keyword})