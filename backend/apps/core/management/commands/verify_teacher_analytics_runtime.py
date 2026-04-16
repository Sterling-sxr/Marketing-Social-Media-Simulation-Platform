from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.core.repositories import CourseMemberRepository, CourseRepository
from apps.core.repositories.models import (
    CourseDashboardSnapshot,
    CourseHashtagDashboardSnapshot,
    CourseStudentDashboardSnapshot,
)
from apps.core.services import (
    add_comment_to_post,
    delete_comment_from_post,
    get_course_dashboard,
    get_course_hashtag_dashboard,
    get_course_student_dashboard,
    join_course_by_code,
    like_course_post,
    unlike_course_post,
    update_comment_on_post,
    update_course,
    update_course_post,
)
from apps.core.services.course_post_service import create_course_post_with_meta, delete_course_post
from apps.core.services.dashboard_service import refresh_course_snapshot


class Command(BaseCommand):
    help = "Run repeatable teacher analytics runtime verification against real snapshot refresh paths."

    def add_arguments(self, parser):
        parser.add_argument(
            "--scenario",
            choices=["all", "comment", "like", "post", "membership", "metadata"],
            default="all",
            help="Subset of runtime checks to execute.",
        )

    def handle(self, *args, **options):
        scenario = options["scenario"]
        suffix = uuid4().hex[:8]
        data = self._bootstrap_runtime_data(suffix)
        self.stdout.write(self.style.SUCCESS(f"Bootstrapped course={data['course'].id} suffix={suffix}"))

        self._seed_snapshots(data)
        self._assert_fresh_baseline(data)

        if scenario in {"all", "comment"}:
            self._verify_comment_flow(data)
        if scenario in {"all", "like"}:
            self._verify_like_flow(data)
        if scenario in {"all", "post"}:
            self._verify_post_flow(data)
        if scenario in {"all", "membership"}:
            self._verify_membership_flow(data)
        if scenario in {"all", "metadata"}:
            self._verify_course_metadata_flow(data)

        self.stdout.write(self.style.SUCCESS("Teacher analytics runtime verification passed."))

    def _bootstrap_runtime_data(self, suffix: str) -> dict:
        User = get_user_model()

        teacher, _ = User.objects.get_or_create(
            username=f"runtime_teacher_{suffix}",
            defaults={
                "email": f"runtime_teacher_{suffix}@example.com",
                "first_name": "Runtime",
                "last_name": "Teacher",
            },
        )
        teacher.set_password("runtime-pass")
        teacher.is_staff = True
        teacher.save(update_fields=["password", "is_staff"])

        student, _ = User.objects.get_or_create(
            username=f"runtime_student_{suffix}",
            defaults={
                "email": f"runtime_student_{suffix}@example.com",
                "first_name": "Runtime",
                "last_name": "Student",
            },
        )
        student.set_password("runtime-pass")
        student.save(update_fields=["password"])

        today = timezone.localdate()
        course = CourseRepository.create(
            name=f"Runtime Analytics {suffix}",
            course_code=f"RT{suffix[:4].upper()}",
            term=f"VERIFY-{suffix[:4].upper()}",
            join_code=suffix[:8].upper(),
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=30),
            created_by=teacher,
        )

        CourseMemberRepository.get_or_create_member(course.id, teacher.id, role="teacher")
        CourseMemberRepository.get_or_create_member(course.id, student.id, role="student")

        post = create_course_post_with_meta(
            user=student,
            course_id=course.id,
            content="Runtime verification post #runtimealpha",
            mentions=None,
            mention_entities=None,
            hashtags=["runtimealpha"],
            attachment_ids=None,
        )

        return {
            "teacher": teacher,
            "student": student,
            "course": course,
            "post_id": post["id"],
            "primary_hashtag": "runtimealpha",
        }

    def _seed_snapshots(self, data: dict) -> None:
        refresh_course_snapshot(data["course"])
        self._assert_snapshot_exists("course", CourseDashboardSnapshot.objects.filter(course=data["course"]).first())
        self._assert_snapshot_exists(
            "hashtag",
            CourseHashtagDashboardSnapshot.objects.filter(
                course=data["course"],
                hashtag=data["primary_hashtag"],
            ).first(),
        )
        self._assert_snapshot_exists(
            "student",
            CourseStudentDashboardSnapshot.objects.filter(
                course=data["course"],
                student_id=data["student"].id,
            ).first(),
        )

    def _assert_fresh_baseline(self, data: dict) -> None:
        course_payload = get_course_dashboard(user=data["teacher"], course_id=data["course"].id)
        hashtag_payload = get_course_hashtag_dashboard(
            user=data["teacher"],
            course_id=data["course"].id,
            hashtag=data["primary_hashtag"],
        )
        student_payload = get_course_student_dashboard(
            user=data["teacher"],
            course_id=data["course"].id,
            student_id=data["student"].id,
        )
        self._assert_status("baseline course", course_payload, "fresh")
        self._assert_status("baseline hashtag", hashtag_payload, "fresh")
        self._assert_status("baseline student", student_payload, "fresh")

    def _verify_comment_flow(self, data: dict) -> None:
        self.stdout.write("Verifying comment create/update/delete...")
        comment = add_comment_to_post(
            user=data["teacher"],
            course_id=data["course"].id,
            post_id=data["post_id"],
            content="Runtime comment create",
        )
        comment_id = comment["id"]
        self._assert_post_related_stale(data)
        self._assert_post_related_refreshed(data, "comment create")

        updated = update_comment_on_post(
            user=data["teacher"],
            course_id=data["course"].id,
            post_id=data["post_id"],
            comment_id=comment_id,
            content="Runtime comment updated",
        )
        if updated["content"] != "Runtime comment updated":
            raise CommandError("Comment update did not persist new content.")
        self._assert_post_related_stale(data)
        self._assert_post_related_refreshed(data, "comment update")

        delete_comment_from_post(
            user=data["teacher"],
            course_id=data["course"].id,
            post_id=data["post_id"],
            comment_id=comment_id,
        )
        self._assert_post_related_stale(data)
        self._assert_post_related_refreshed(data, "comment delete")

    def _verify_like_flow(self, data: dict) -> None:
        self.stdout.write("Verifying like create/remove...")
        like_course_post(user=data["teacher"], course_id=data["course"].id, post_id=data["post_id"])
        self._assert_post_related_stale(data)
        self._assert_post_related_refreshed(data, "like create")

        unlike_course_post(user=data["teacher"], course_id=data["course"].id, post_id=data["post_id"])
        self._assert_post_related_stale(data)
        self._assert_post_related_refreshed(data, "like remove")

    def _verify_post_flow(self, data: dict) -> None:
        self.stdout.write("Verifying post create/update/delete...")
        new_post = create_course_post_with_meta(
            user=data["student"],
            course_id=data["course"].id,
            content="Runtime beta post #runtimebeta",
            mentions=None,
            mention_entities=None,
            hashtags=["runtimebeta"],
            attachment_ids=None,
        )
        beta_post_id = new_post["id"]
        self._assert_snapshot_stale("course", CourseDashboardSnapshot.objects.filter(course=data["course"]).first())
        self._assert_status(
            "post create beta hashtag",
            get_course_hashtag_dashboard(
                user=data["teacher"],
                course_id=data["course"].id,
                hashtag="runtimebeta",
            ),
            "refreshed",
        )
        self._assert_status(
            "post create student",
            get_course_student_dashboard(
                user=data["teacher"],
                course_id=data["course"].id,
                student_id=data["student"].id,
            ),
            "refreshed",
        )
        self._assert_status(
            "post create course",
            get_course_dashboard(user=data["teacher"], course_id=data["course"].id),
            "refreshed",
        )

        update_course_post(
            user=data["student"],
            course_id=data["course"].id,
            post_id=beta_post_id,
            content="Runtime gamma post #runtimegamma",
            mentions=None,
            mention_entities=None,
            hashtags=["runtimegamma"],
            attachment_ids=[],
        )
        self._assert_snapshot_stale("course", CourseDashboardSnapshot.objects.filter(course=data["course"]).first())
        self._assert_snapshot_stale(
            "old hashtag beta",
            CourseHashtagDashboardSnapshot.objects.filter(course=data["course"], hashtag="runtimebeta").first(),
        )
        self._assert_status(
            "post update old hashtag beta",
            get_course_hashtag_dashboard(
                user=data["teacher"],
                course_id=data["course"].id,
                hashtag="runtimebeta",
            ),
            "refreshed",
        )
        self._assert_status(
            "post update new hashtag gamma",
            get_course_hashtag_dashboard(
                user=data["teacher"],
                course_id=data["course"].id,
                hashtag="runtimegamma",
            ),
            "refreshed",
        )
        self._assert_status(
            "post update student",
            get_course_student_dashboard(
                user=data["teacher"],
                course_id=data["course"].id,
                student_id=data["student"].id,
            ),
            "refreshed",
        )
        self._assert_status(
            "post update course",
            get_course_dashboard(user=data["teacher"], course_id=data["course"].id),
            "refreshed",
        )

        delete_course_post(user=data["student"], course_id=data["course"].id, post_id=beta_post_id)
        self._assert_snapshot_stale("course", CourseDashboardSnapshot.objects.filter(course=data["course"]).first())
        self._assert_status(
            "post delete gamma hashtag",
            get_course_hashtag_dashboard(
                user=data["teacher"],
                course_id=data["course"].id,
                hashtag="runtimegamma",
            ),
            "refreshed",
        )
        self._assert_status(
            "post delete student",
            get_course_student_dashboard(
                user=data["teacher"],
                course_id=data["course"].id,
                student_id=data["student"].id,
            ),
            "refreshed",
        )
        self._assert_status(
            "post delete course",
            get_course_dashboard(user=data["teacher"], course_id=data["course"].id),
            "refreshed",
        )

    def _verify_membership_flow(self, data: dict) -> None:
        self.stdout.write("Verifying membership change...")
        User = get_user_model()
        member_suffix = uuid4().hex[:8]
        extra_member, _ = User.objects.get_or_create(
            username=f"runtime_member_{member_suffix}",
            defaults={"email": f"runtime_member_{member_suffix}@example.com"},
        )
        extra_member.set_password("runtime-pass")
        extra_member.save(update_fields=["password"])

        join_course_by_code(user=extra_member, join_code=data["course"].join_code)
        self._assert_snapshot_stale("course", CourseDashboardSnapshot.objects.filter(course=data["course"]).first())
        self._assert_status(
            "membership course",
            get_course_dashboard(user=data["teacher"], course_id=data["course"].id),
            "refreshed",
        )

    def _verify_course_metadata_flow(self, data: dict) -> None:
        self.stdout.write("Verifying course metadata update...")
        course = data["course"]
        updated_code = f"{course.course_code}M"
        updated_name = f"{course.name} Metadata"
        updated_term = f"{course.term}-META"

        update_course(
            user=data["teacher"],
            course_id=course.id,
            course_code=updated_code,
            course_name=updated_name,
            term=updated_term,
            start_date=course.start_date.isoformat(),
            end_date=course.end_date.isoformat(),
        )

        course.refresh_from_db()
        self._assert_snapshot_stale(
            "metadata course",
            CourseDashboardSnapshot.objects.filter(course=course).first(),
        )
        self._assert_snapshot_stale(
            "metadata hashtag",
            CourseHashtagDashboardSnapshot.objects.filter(
                course=course,
                hashtag=data["primary_hashtag"],
            ).first(),
        )
        self._assert_snapshot_stale(
            "metadata student",
            CourseStudentDashboardSnapshot.objects.filter(
                course=course,
                student_id=data["student"].id,
            ).first(),
        )

        hashtag_payload = get_course_hashtag_dashboard(
            user=data["teacher"],
            course_id=course.id,
            hashtag=data["primary_hashtag"],
        )
        self._assert_status("metadata hashtag", hashtag_payload, "refreshed")
        self._assert_course_meta("metadata hashtag", hashtag_payload.get("course") or {}, course)

        student_payload = get_course_student_dashboard(
            user=data["teacher"],
            course_id=course.id,
            student_id=data["student"].id,
        )
        self._assert_status("metadata student", student_payload, "refreshed")
        self._assert_course_meta("metadata student", student_payload.get("course") or {}, course)

        course_payload = get_course_dashboard(user=data["teacher"], course_id=course.id)
        self._assert_status("metadata course", course_payload, "refreshed")
        self._assert_course_meta("metadata course", course_payload.get("course") or {}, course)

    def _assert_post_related_stale(self, data: dict) -> None:
        self._assert_snapshot_stale("course", CourseDashboardSnapshot.objects.filter(course=data["course"]).first())
        self._assert_snapshot_stale(
            "hashtag",
            CourseHashtagDashboardSnapshot.objects.filter(
                course=data["course"],
                hashtag=data["primary_hashtag"],
            ).first(),
        )
        self._assert_snapshot_stale(
            "student",
            CourseStudentDashboardSnapshot.objects.filter(
                course=data["course"],
                student_id=data["student"].id,
            ).first(),
        )

    def _assert_post_related_refreshed(self, data: dict, label: str) -> None:
        self._assert_status(
            f"{label} hashtag",
            get_course_hashtag_dashboard(
                user=data["teacher"],
                course_id=data["course"].id,
                hashtag=data["primary_hashtag"],
            ),
            "refreshed",
        )
        self._assert_status(
            f"{label} student",
            get_course_student_dashboard(
                user=data["teacher"],
                course_id=data["course"].id,
                student_id=data["student"].id,
            ),
            "refreshed",
        )
        self._assert_status(
            f"{label} course",
            get_course_dashboard(user=data["teacher"], course_id=data["course"].id),
            "refreshed",
        )

    def _assert_status(self, label: str, payload: dict, expected: str) -> None:
        actual = payload.get("source_status")
        if actual != expected:
            raise CommandError(f"{label}: expected source_status={expected}, got {actual}")
        self.stdout.write(f"  refreshed: {label} -> {actual}")

    def _assert_snapshot_exists(self, label: str, snapshot) -> None:
        if snapshot is None:
            raise CommandError(f"{label} snapshot was not created during seed refresh.")

    def _assert_snapshot_stale(self, label: str, snapshot) -> None:
        if snapshot is None:
            raise CommandError(f"{label} snapshot is missing; expected a stale snapshot row.")
        if not bool((snapshot.data or {}).get("stale")):
            raise CommandError(f"{label} snapshot did not become stale after write operation.")
        self.stdout.write(f"  stale: {label}")

    def _assert_course_meta(self, label: str, payload_course: dict, course) -> None:
        if payload_course.get("course_code") != course.course_code:
            raise CommandError(
                f"{label}: expected course_code={course.course_code}, got {payload_course.get('course_code')}"
            )
        if payload_course.get("name") != course.name:
            raise CommandError(
                f"{label}: expected name={course.name}, got {payload_course.get('name')}"
            )
        if payload_course.get("term") != course.term:
            raise CommandError(
                f"{label}: expected term={course.term}, got {payload_course.get('term')}"
            )
        self.stdout.write(
            f"  metadata applied: {label} -> {course.course_code} / {course.name} / {course.term}"
        )
