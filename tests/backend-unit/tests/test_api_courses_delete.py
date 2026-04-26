import json
from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.core.repositories.models import Course, CourseMember, CoursePost, CourseProfile


def _create_user(username: str, *, is_staff: bool = False):
    return get_user_model().objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="password123",
        is_staff=is_staff,
    )


def _create_course(created_by):
    return Course.objects.create(
        name="Delete Me",
        course_code="COMP9999",
        term="26T1",
        join_code="DELETE01",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=90),
        created_by=created_by,
    )


@pytest.mark.django_db
def test_delete_course_allows_admin_and_cascades_related_records():
    admin = _create_user("delete-admin", is_staff=True)
    student = _create_user("delete-student")
    course = _create_course(admin)
    CourseMember.objects.create(course=course, user=student, role="student")
    CourseProfile.objects.create(course=course, user=student, gender="Prefer not to say")
    CoursePost.objects.create(course=course, author=student, content="Course cleanup test")

    client = Client()
    client.force_login(admin)

    response = client.delete(f"/api/courses/{course.id}/")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert not Course.objects.filter(id=course.id).exists()
    assert not CourseMember.objects.filter(course_id=course.id).exists()
    assert not CourseProfile.objects.filter(course_id=course.id).exists()
    assert not CoursePost.objects.filter(course_id=course.id).exists()


@pytest.mark.django_db
def test_delete_course_rejects_non_admin():
    creator = _create_user("delete-creator", is_staff=True)
    student = _create_user("delete-non-admin")
    course = _create_course(creator)

    client = Client()
    client.force_login(student)

    response = client.delete(f"/api/courses/{course.id}/")

    assert response.status_code == 403
    assert response.json() == {"error": "Only administrators can delete courses."}
    assert Course.objects.filter(id=course.id).exists()


@pytest.mark.django_db
def test_delete_course_returns_not_found_for_missing_course():
    admin = _create_user("delete-missing", is_staff=True)
    client = Client()
    client.force_login(admin)

    response = client.delete("/api/courses/999999/")

    assert response.status_code == 404
    assert response.json() == {"error": "Course not found."}


@pytest.mark.django_db
def test_update_course_still_accepts_patch_after_delete_support_added():
    admin = _create_user("patch-admin", is_staff=True)
    course = _create_course(admin)
    client = Client()
    client.force_login(admin)

    response = client.patch(
        f"/api/courses/{course.id}/",
        data=json.dumps(
            {
                "course_code": "COMP9998",
                "course_name": "Updated Name",
                "course_summary": "Updated summary",
                "term": "26T2",
                "start_date": date.today().isoformat(),
                "end_date": (date.today() + timedelta(days=120)).isoformat(),
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["course"]["course_code"] == "COMP9998"
    assert payload["course"]["name"] == "Updated Name"
