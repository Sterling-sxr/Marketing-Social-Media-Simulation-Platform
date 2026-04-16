from __future__ import annotations

import importlib
import sys
import types
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.core.repositories import CourseMemberRepository, CourseRepository
from apps.core.repositories.models import (
    CourseDashboardSnapshot,
    CourseHashtagDashboardSnapshot,
    CourseStudentDashboardSnapshot,
)


def _build_transformer_stubs() -> tuple[types.ModuleType, types.ModuleType]:
    torch_mod = types.ModuleType("torch")
    torch_mod.float32 = "float32"

    transformers_mod = types.ModuleType("transformers")

    class _AutoTokenizer:
        @classmethod
        def from_pretrained(cls, *args, **kwargs):
            return cls()

    class _AutoModelForSequenceClassification:
        @classmethod
        def from_pretrained(cls, *args, **kwargs):
            return cls()

    def _pipeline(*args, **kwargs):
        def _classify(texts):
            if isinstance(texts, str):
                items = [texts]
            else:
                items = list(texts or [])
            return [{"label": "neutral"} for _ in items]

        return _classify

    transformers_mod.AutoTokenizer = _AutoTokenizer
    transformers_mod.AutoModelForSequenceClassification = _AutoModelForSequenceClassification
    transformers_mod.pipeline = _pipeline
    return torch_mod, transformers_mod


@pytest.fixture
def analytics_modules(monkeypatch, settings):
    settings.DEEPSEEK_API_KEY = ""
    settings.POST_RECOMMENDATION_LIMIT = 5

    torch_mod, transformers_mod = _build_transformer_stubs()
    monkeypatch.setitem(sys.modules, "torch", torch_mod)
    monkeypatch.setitem(sys.modules, "transformers", transformers_mod)

    for module_name in (
        "apps.core.services.dashboard_service",
        "apps.core.services.course_post_service",
        "apps.core.services.course_service",
    ):
        sys.modules.pop(module_name, None)

    dashboard_service = importlib.import_module("apps.core.services.dashboard_service")
    course_post_service = importlib.import_module("apps.core.services.course_post_service")
    course_service = importlib.import_module("apps.core.services.course_service")

    monkeypatch.setattr(course_post_service, "create_notification", lambda *args, **kwargs: None)
    monkeypatch.setattr(course_post_service, "_schedule_interest_recommendations", lambda *args, **kwargs: None)
    monkeypatch.setattr(course_post_service, "evaluate_persona_prompt", lambda prompt: None)
    monkeypatch.setattr(dashboard_service, "_sentiment_pipeline", None)

    return SimpleNamespace(
        dashboard=dashboard_service,
        course_post=course_post_service,
        course=course_service,
    )


@pytest.fixture
def analytics_case(analytics_modules):
    User = get_user_model()
    suffix = uuid4().hex[:8]

    teacher = User.objects.create_user(
        username=f"teacher_{suffix}",
        email=f"teacher_{suffix}@example.com",
        password="test-pass",
        first_name="Teacher",
        last_name=suffix,
    )
    teacher.is_staff = True
    teacher.save(update_fields=["is_staff"])

    student_primary = User.objects.create_user(
        username=f"student_primary_{suffix}",
        email=f"student_primary_{suffix}@example.com",
        password="test-pass",
        first_name="Primary",
        last_name="Student",
    )
    student_secondary = User.objects.create_user(
        username=f"student_secondary_{suffix}",
        email=f"student_secondary_{suffix}@example.com",
        password="test-pass",
        first_name="Secondary",
        last_name="Student",
    )

    today = timezone.localdate()
    course = CourseRepository.create(
        name=f"Teacher Analytics {suffix}",
        course_code=f"TA{suffix[:4].upper()}",
        term=f"T{suffix[4:].upper()}",
        join_code=suffix.upper(),
        start_date=today - timedelta(days=1),
        end_date=today + timedelta(days=30),
        created_by=teacher,
    )

    CourseMemberRepository.get_or_create_member(course.id, teacher.id, role="teacher")
    CourseMemberRepository.get_or_create_member(course.id, student_primary.id, role="student")
    CourseMemberRepository.get_or_create_member(course.id, student_secondary.id, role="student")

    alpha_post = analytics_modules.course_post.create_course_post_with_meta(
        user=student_primary,
        course_id=course.id,
        content="Primary analytics post #alpha",
        mentions=None,
        mention_entities=None,
        hashtags=["alpha"],
        attachment_ids=None,
    )
    beta_post = analytics_modules.course_post.create_course_post_with_meta(
        user=student_secondary,
        course_id=course.id,
        content="Secondary analytics post #beta",
        mentions=None,
        mention_entities=None,
        hashtags=["beta"],
        attachment_ids=None,
    )

    return SimpleNamespace(
        teacher=teacher,
        student_primary=student_primary,
        student_secondary=student_secondary,
        course=course,
        alpha_post_id=alpha_post["id"],
        beta_post_id=beta_post["id"],
        alpha_hashtag="alpha",
        beta_hashtag="beta",
    )


@pytest.fixture
def seeded_analytics_case(analytics_case, analytics_modules):
    analytics_modules.dashboard.refresh_course_snapshot(analytics_case.course)
    return analytics_case


def _get_course_snapshot(course):
    return CourseDashboardSnapshot.objects.get(course=course)


def _get_hashtag_snapshot(course, hashtag: str):
    return CourseHashtagDashboardSnapshot.objects.get(course=course, hashtag=hashtag)


def _get_student_snapshot(course, student):
    return CourseStudentDashboardSnapshot.objects.get(course=course, student=student)


def _mark_snapshot_stale(snapshot) -> None:
    data = dict(snapshot.data or {})
    data["stale"] = True
    snapshot.data = data
    snapshot.save(update_fields=["data"])


def _age_snapshot(snapshot_model, **filters) -> None:
    expired_at = timezone.now() - timedelta(hours=1)
    snapshot_model.objects.filter(**filters).update(calculated_at=expired_at)


def _assert_source_status(payload: dict, expected: str) -> None:
    assert payload["source_kind"] == "backend_snapshot"
    assert payload["source_status"] == expected


def _assert_stale(snapshot) -> None:
    snapshot.refresh_from_db()
    assert bool((snapshot.data or {}).get("stale")) is True


def _assert_not_stale(snapshot) -> None:
    snapshot.refresh_from_db()
    assert bool((snapshot.data or {}).get("stale")) is False


def _assert_post_related_stale(case, *, hashtags: list[str], unaffected_hashtags: list[str] | None = None):
    _assert_stale(_get_course_snapshot(case.course))
    for hashtag in hashtags:
        _assert_stale(_get_hashtag_snapshot(case.course, hashtag))
    _assert_stale(_get_student_snapshot(case.course, case.student_primary))
    for hashtag in unaffected_hashtags or []:
        _assert_not_stale(_get_hashtag_snapshot(case.course, hashtag))
    _assert_not_stale(_get_student_snapshot(case.course, case.student_secondary))


@pytest.mark.django_db(transaction=True)
def test_missing_snapshots_are_generated_on_read(analytics_case, analytics_modules):
    assert CourseDashboardSnapshot.objects.filter(course=analytics_case.course).count() == 0
    assert CourseHashtagDashboardSnapshot.objects.filter(course=analytics_case.course).count() == 0
    assert CourseStudentDashboardSnapshot.objects.filter(course=analytics_case.course).count() == 0

    hashtag_payload = analytics_modules.dashboard.get_course_hashtag_dashboard(
        user=analytics_case.teacher,
        course_id=analytics_case.course.id,
        hashtag=analytics_case.alpha_hashtag,
    )
    _assert_source_status(hashtag_payload, "refreshed")
    assert CourseHashtagDashboardSnapshot.objects.filter(
        course=analytics_case.course,
        hashtag=analytics_case.alpha_hashtag,
    ).exists()
    assert CourseDashboardSnapshot.objects.filter(course=analytics_case.course).count() == 0

    student_payload = analytics_modules.dashboard.get_course_student_dashboard(
        user=analytics_case.teacher,
        course_id=analytics_case.course.id,
        student_id=analytics_case.student_primary.id,
    )
    _assert_source_status(student_payload, "refreshed")
    assert CourseStudentDashboardSnapshot.objects.filter(
        course=analytics_case.course,
        student=analytics_case.student_primary,
    ).exists()

    course_payload = analytics_modules.dashboard.get_course_dashboard(
        user=analytics_case.teacher,
        course_id=analytics_case.course.id,
    )
    _assert_source_status(course_payload, "refreshed")
    assert CourseDashboardSnapshot.objects.filter(course=analytics_case.course).exists()


@pytest.mark.django_db(transaction=True)
def test_stale_snapshots_are_refreshed_on_read(seeded_analytics_case, analytics_modules):
    _mark_snapshot_stale(_get_hashtag_snapshot(seeded_analytics_case.course, seeded_analytics_case.alpha_hashtag))
    _mark_snapshot_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_primary))
    _mark_snapshot_stale(_get_course_snapshot(seeded_analytics_case.course))

    hashtag_payload = analytics_modules.dashboard.get_course_hashtag_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        hashtag=seeded_analytics_case.alpha_hashtag,
    )
    _assert_source_status(hashtag_payload, "refreshed")
    _assert_not_stale(_get_hashtag_snapshot(seeded_analytics_case.course, seeded_analytics_case.alpha_hashtag))

    student_payload = analytics_modules.dashboard.get_course_student_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        student_id=seeded_analytics_case.student_primary.id,
    )
    _assert_source_status(student_payload, "refreshed")
    _assert_not_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_primary))

    course_payload = analytics_modules.dashboard.get_course_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
    )
    _assert_source_status(course_payload, "refreshed")
    _assert_not_stale(_get_course_snapshot(seeded_analytics_case.course))


@pytest.mark.django_db(transaction=True)
def test_ttl_expired_snapshots_are_refreshed_on_read(seeded_analytics_case, analytics_modules, monkeypatch):
    monkeypatch.setenv("DASHBOARD_SNAPSHOT_TTL_SECONDS", "60")
    _age_snapshot(
        CourseHashtagDashboardSnapshot,
        course=seeded_analytics_case.course,
        hashtag=seeded_analytics_case.alpha_hashtag,
    )
    _age_snapshot(
        CourseStudentDashboardSnapshot,
        course=seeded_analytics_case.course,
        student=seeded_analytics_case.student_primary,
    )
    _age_snapshot(CourseDashboardSnapshot, course=seeded_analytics_case.course)

    hashtag_payload = analytics_modules.dashboard.get_course_hashtag_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        hashtag=seeded_analytics_case.alpha_hashtag,
    )
    _assert_source_status(hashtag_payload, "refreshed")

    student_payload = analytics_modules.dashboard.get_course_student_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        student_id=seeded_analytics_case.student_primary.id,
    )
    _assert_source_status(student_payload, "refreshed")

    course_payload = analytics_modules.dashboard.get_course_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
    )
    _assert_source_status(course_payload, "refreshed")


@pytest.mark.django_db(transaction=True)
def test_fresh_snapshots_are_returned_directly(seeded_analytics_case, analytics_modules, monkeypatch):
    def _fail(*args, **kwargs):
        raise AssertionError("Fresh snapshot should not trigger refresh.")

    monkeypatch.setattr(analytics_modules.dashboard, "refresh_course_snapshot", _fail)
    monkeypatch.setattr(analytics_modules.dashboard, "refresh_course_hashtag_snapshot", _fail)
    monkeypatch.setattr(analytics_modules.dashboard, "refresh_course_student_snapshot", _fail)

    hashtag_payload = analytics_modules.dashboard.get_course_hashtag_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        hashtag=seeded_analytics_case.alpha_hashtag,
    )
    _assert_source_status(hashtag_payload, "fresh")

    student_payload = analytics_modules.dashboard.get_course_student_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        student_id=seeded_analytics_case.student_primary.id,
    )
    _assert_source_status(student_payload, "fresh")

    course_payload = analytics_modules.dashboard.get_course_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
    )
    _assert_source_status(course_payload, "fresh")


@pytest.mark.django_db(transaction=True)
def test_post_create_update_delete_invalidation_is_targeted(seeded_analytics_case, analytics_modules):
    analytics_modules.course_post.update_course_post(
        user=seeded_analytics_case.student_primary,
        course_id=seeded_analytics_case.course.id,
        post_id=seeded_analytics_case.alpha_post_id,
        content="Primary analytics post updated #alpha",
        mentions=None,
        mention_entities=None,
        hashtags=["alpha"],
        attachment_ids=[],
    )
    _assert_post_related_stale(
        seeded_analytics_case,
        hashtags=[seeded_analytics_case.alpha_hashtag],
        unaffected_hashtags=[seeded_analytics_case.beta_hashtag],
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_hashtag_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            hashtag=seeded_analytics_case.alpha_hashtag,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_student_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            student_id=seeded_analytics_case.student_primary.id,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
        ),
        "refreshed",
    )

    gamma_post = analytics_modules.course_post.create_course_post_with_meta(
        user=seeded_analytics_case.student_primary,
        course_id=seeded_analytics_case.course.id,
        content="Gamma analytics post #gamma",
        mentions=None,
        mention_entities=None,
        hashtags=["gamma"],
        attachment_ids=None,
    )
    _assert_stale(_get_course_snapshot(seeded_analytics_case.course))
    assert not CourseHashtagDashboardSnapshot.objects.filter(
        course=seeded_analytics_case.course,
        hashtag="gamma",
    ).exists()
    _assert_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_primary))
    _assert_not_stale(_get_hashtag_snapshot(seeded_analytics_case.course, seeded_analytics_case.beta_hashtag))
    _assert_not_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_secondary))

    gamma_payload = analytics_modules.dashboard.get_course_hashtag_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        hashtag="gamma",
    )
    _assert_source_status(gamma_payload, "refreshed")

    analytics_modules.course_post.update_course_post(
        user=seeded_analytics_case.student_primary,
        course_id=seeded_analytics_case.course.id,
        post_id=gamma_post["id"],
        content="Delta analytics post #delta",
        mentions=None,
        mention_entities=None,
        hashtags=["delta"],
        attachment_ids=[],
    )
    _assert_stale(_get_course_snapshot(seeded_analytics_case.course))
    _assert_stale(_get_hashtag_snapshot(seeded_analytics_case.course, "gamma"))
    assert not CourseHashtagDashboardSnapshot.objects.filter(
        course=seeded_analytics_case.course,
        hashtag="delta",
    ).exists()
    _assert_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_primary))
    _assert_not_stale(_get_hashtag_snapshot(seeded_analytics_case.course, seeded_analytics_case.beta_hashtag))
    _assert_not_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_secondary))

    delta_payload = analytics_modules.dashboard.get_course_hashtag_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        hashtag="delta",
    )
    _assert_source_status(delta_payload, "refreshed")
    gamma_payload = analytics_modules.dashboard.get_course_hashtag_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        hashtag="gamma",
    )
    _assert_source_status(gamma_payload, "refreshed")
    assert gamma_payload["summary"]["total_posts"] == 0

    analytics_modules.course_post.delete_course_post(
        user=seeded_analytics_case.student_primary,
        course_id=seeded_analytics_case.course.id,
        post_id=gamma_post["id"],
    )
    _assert_post_related_stale(
        seeded_analytics_case,
        hashtags=["delta"],
        unaffected_hashtags=[seeded_analytics_case.beta_hashtag],
    )
    delta_payload = analytics_modules.dashboard.get_course_hashtag_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        hashtag="delta",
    )
    _assert_source_status(delta_payload, "refreshed")
    assert delta_payload["summary"]["total_posts"] == 0


@pytest.mark.django_db(transaction=True)
def test_like_create_remove_invalidation_is_targeted(seeded_analytics_case, analytics_modules):
    analytics_modules.course_post.like_course_post(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        post_id=seeded_analytics_case.alpha_post_id,
    )
    _assert_post_related_stale(
        seeded_analytics_case,
        hashtags=[seeded_analytics_case.alpha_hashtag],
        unaffected_hashtags=[seeded_analytics_case.beta_hashtag],
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_hashtag_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            hashtag=seeded_analytics_case.alpha_hashtag,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_student_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            student_id=seeded_analytics_case.student_primary.id,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
        ),
        "refreshed",
    )

    analytics_modules.course_post.unlike_course_post(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        post_id=seeded_analytics_case.alpha_post_id,
    )
    _assert_post_related_stale(
        seeded_analytics_case,
        hashtags=[seeded_analytics_case.alpha_hashtag],
        unaffected_hashtags=[seeded_analytics_case.beta_hashtag],
    )

    _assert_source_status(
        analytics_modules.dashboard.get_course_hashtag_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            hashtag=seeded_analytics_case.alpha_hashtag,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_student_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            student_id=seeded_analytics_case.student_primary.id,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
        ),
        "refreshed",
    )

    analytics_modules.course_post.unlike_course_post(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        post_id=seeded_analytics_case.alpha_post_id,
    )
    _assert_not_stale(_get_course_snapshot(seeded_analytics_case.course))
    _assert_not_stale(_get_hashtag_snapshot(seeded_analytics_case.course, seeded_analytics_case.alpha_hashtag))
    _assert_not_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_primary))


@pytest.mark.django_db(transaction=True)
def test_comment_create_update_delete_invalidation_is_targeted(seeded_analytics_case, analytics_modules):
    comment = analytics_modules.course_post.add_comment_to_post(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        post_id=seeded_analytics_case.alpha_post_id,
        content="Teacher comment",
    )
    _assert_post_related_stale(
        seeded_analytics_case,
        hashtags=[seeded_analytics_case.alpha_hashtag],
        unaffected_hashtags=[seeded_analytics_case.beta_hashtag],
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_hashtag_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            hashtag=seeded_analytics_case.alpha_hashtag,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_student_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            student_id=seeded_analytics_case.student_primary.id,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
        ),
        "refreshed",
    )

    analytics_modules.course_post.update_comment_on_post(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        post_id=seeded_analytics_case.alpha_post_id,
        comment_id=comment["id"],
        content="Teacher comment updated",
    )
    _assert_post_related_stale(
        seeded_analytics_case,
        hashtags=[seeded_analytics_case.alpha_hashtag],
        unaffected_hashtags=[seeded_analytics_case.beta_hashtag],
    )

    _assert_source_status(
        analytics_modules.dashboard.get_course_hashtag_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            hashtag=seeded_analytics_case.alpha_hashtag,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_student_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            student_id=seeded_analytics_case.student_primary.id,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
        ),
        "refreshed",
    )

    analytics_modules.course_post.delete_comment_from_post(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        post_id=seeded_analytics_case.alpha_post_id,
        comment_id=comment["id"],
    )
    _assert_post_related_stale(
        seeded_analytics_case,
        hashtags=[seeded_analytics_case.alpha_hashtag],
        unaffected_hashtags=[seeded_analytics_case.beta_hashtag],
    )

    _assert_source_status(
        analytics_modules.dashboard.get_course_hashtag_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            hashtag=seeded_analytics_case.alpha_hashtag,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_student_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
            student_id=seeded_analytics_case.student_primary.id,
        ),
        "refreshed",
    )
    _assert_source_status(
        analytics_modules.dashboard.get_course_dashboard(
            user=seeded_analytics_case.teacher,
            course_id=seeded_analytics_case.course.id,
        ),
        "refreshed",
    )


@pytest.mark.django_db(transaction=True)
def test_membership_change_only_stales_course_snapshot(seeded_analytics_case, analytics_modules):
    User = get_user_model()
    late_student = User.objects.create_user(
        username=f"late_student_{uuid4().hex[:8]}",
        email=f"late_student_{uuid4().hex[:8]}@example.com",
        password="test-pass",
    )

    analytics_modules.course.join_course_by_code(
        user=late_student,
        join_code=seeded_analytics_case.course.join_code,
    )

    _assert_stale(_get_course_snapshot(seeded_analytics_case.course))
    _assert_not_stale(_get_hashtag_snapshot(seeded_analytics_case.course, seeded_analytics_case.alpha_hashtag))
    _assert_not_stale(_get_hashtag_snapshot(seeded_analytics_case.course, seeded_analytics_case.beta_hashtag))
    _assert_not_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_primary))
    _assert_not_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_secondary))

    payload = analytics_modules.dashboard.get_course_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
    )
    _assert_source_status(payload, "refreshed")
    assert payload["summary"]["registered_students"] == 3


@pytest.mark.django_db(transaction=True)
def test_course_metadata_update_stales_all_existing_snapshots_and_refreshes_updated_fields(
    seeded_analytics_case,
    analytics_modules,
):
    new_code = f"{seeded_analytics_case.course.course_code}X"
    new_name = f"{seeded_analytics_case.course.name} Updated"
    new_term = f"{seeded_analytics_case.course.term}X"

    analytics_modules.course.update_course(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        course_code=new_code,
        course_name=new_name,
        term=new_term,
        start_date=seeded_analytics_case.course.start_date.isoformat(),
        end_date=seeded_analytics_case.course.end_date.isoformat(),
    )

    _assert_stale(_get_course_snapshot(seeded_analytics_case.course))
    _assert_stale(_get_hashtag_snapshot(seeded_analytics_case.course, seeded_analytics_case.alpha_hashtag))
    _assert_stale(_get_hashtag_snapshot(seeded_analytics_case.course, seeded_analytics_case.beta_hashtag))
    _assert_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_primary))
    _assert_stale(_get_student_snapshot(seeded_analytics_case.course, seeded_analytics_case.student_secondary))

    course_payload = analytics_modules.dashboard.get_course_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
    )
    hashtag_payload = analytics_modules.dashboard.get_course_hashtag_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        hashtag=seeded_analytics_case.alpha_hashtag,
    )
    student_payload = analytics_modules.dashboard.get_course_student_dashboard(
        user=seeded_analytics_case.teacher,
        course_id=seeded_analytics_case.course.id,
        student_id=seeded_analytics_case.student_primary.id,
    )

    _assert_source_status(course_payload, "refreshed")
    _assert_source_status(hashtag_payload, "fresh")
    _assert_source_status(student_payload, "fresh")

    assert course_payload["course"]["course_code"] == new_code
    assert course_payload["course"]["name"] == new_name
    assert course_payload["course"]["term"] == new_term
    assert hashtag_payload["course"]["course_code"] == new_code
    assert hashtag_payload["course"]["name"] == new_name
    assert hashtag_payload["course"]["term"] == new_term
    assert student_payload["course"]["course_code"] == new_code
    assert student_payload["course"]["name"] == new_name
    assert student_payload["course"]["term"] == new_term
