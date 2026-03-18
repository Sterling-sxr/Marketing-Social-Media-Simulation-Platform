# apps/core/controllers/search.py
from django.http import JsonResponse
from django.db.models import Q, Count
from apps.core.repositories.models import CoursePost, UserProfile
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from apps.core.repositories.models import SearchLog

User = get_user_model()


@require_GET
def search_posts(request):
    """
    搜索帖子内容，返回最新50条匹配结果
    """
    query = request.GET.get("q", "").strip()
    if not query:
        return JsonResponse({"results": []})

    # 搜索 CoursePost 内容
    posts_qs = CoursePost.objects.filter(
        Q(content__icontains=query)
    ).order_by("-created_at")[:50]

    results = [
        {
            "id": p.id,
            "excerpt": p.content[:100],
            "author_name": p.author.username,
            "created_at": p.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }
        for p in posts_qs
    ]

    # 记录搜索历史
    if request.user.is_authenticated:
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        history = profile.search_history or []
        if query not in history:
            history.insert(0, query)
        profile.search_history = history[:10]  # 保留最新10条
        profile.save()

        # 同时记录全站搜索日志
        SearchLog.objects.create(user=request.user, keyword=query)
    else:
        # 未登录用户用 session 保存
        history = request.session.get("search_history", [])
        if query not in history:
            history.insert(0, query)
        request.session["search_history"] = history[:10]

    return JsonResponse({"results": results})


@require_GET
def suggested_search(request):
    """
    获取全站热搜关键词
    """
    top_keywords = (
        SearchLog.objects.values("keyword")
        .annotate(count=Count("keyword"))
        .order_by("-count")[:10]
    )
    suggestions = [k["keyword"] for k in top_keywords]
    return JsonResponse(suggestions, safe=False)


@require_GET
def get_search_history(request):
    """
    获取用户搜索历史，优先使用 UserProfile，其次 session
    """
    if request.user.is_authenticated:
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        history = profile.search_history or []
    else:
        history = request.session.get("search_history", [])
    return JsonResponse(history, safe=False)


@require_POST
def add_search_history(request):
    """
    添加单条搜索历史，适用于前端直接传 keyword
    """
    keyword = request.POST.get("keyword", "").strip()
    if not keyword:
        return JsonResponse({"error": "Missing keyword"}, status=400)

    if request.user.is_authenticated:
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        history = profile.search_history or []
        if keyword not in history:
            history.insert(0, keyword)
        profile.search_history = history[:10]
        profile.save()
        # 同时记录全站日志
        SearchLog.objects.create(user=request.user, keyword=keyword)
    else:
        history = request.session.get("search_history", [])
        if keyword not in history:
            history.insert(0, keyword)
        request.session["search_history"] = history[:10]

    return JsonResponse({"success": True, "keyword": keyword})