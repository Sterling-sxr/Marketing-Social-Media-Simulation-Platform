from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.core.repositories import CourseMemberRepository, CourseRepository
from apps.core.repositories.models import CoursePost, CoursePostComment, CoursePostLike, CoursePostView
from apps.core.services import add_comment_to_post, build_student_analytics_payload, like_course_post
from apps.core.services.course_post_service import create_course_post_with_meta
from apps.core.services import course_post_service


class Command(BaseCommand):
    help = "Run repeatable runtime verification for student analytics backend payloads."

    def add_arguments(self, parser):
        parser.add_argument(
            "--scenario",
            choices=["all", "empty", "payload", "interaction"],
            default="all",
            help="Subset of runtime checks to execute.",
        )

    def handle(self, *args, **options):
        scenario = options["scenario"]
        suffix = uuid4().hex[:8]
        course_post_service._schedule_interest_recommendations = lambda *args, **kwargs: None
        data = self._bootstrap_runtime_data(suffix)
        self.stdout.write(self.style.SUCCESS(f"Bootstrapped student analytics runtime data suffix={suffix}"))

        if scenario in {"all", "empty"}:
            self._verify_empty_payload(data)
        if scenario in {"all", "payload"}:
            self._verify_baseline_payload(data)
        if scenario in {"all", "interaction"}:
            self._verify_interaction_refresh(data)

        self.stdout.write(self.style.SUCCESS("Student analytics runtime verification passed."))

    def _bootstrap_runtime_data(self, suffix: str) -> dict:
        User = get_user_model()

        teacher, _ = User.objects.get_or_create(
            username=f"student_runtime_teacher_{suffix}",
            defaults={"email": f"student_runtime_teacher_{suffix}@example.com"},
        )
        teacher.set_password("runtime-pass")
        teacher.is_staff = True
        teacher.save(update_fields=["password", "is_staff"])

        student, _ = User.objects.get_or_create(
            username=f"student_runtime_student_{suffix}",
            defaults={"email": f"student_runtime_student_{suffix}@example.com"},
        )
        student.set_password("runtime-pass")
        student.save(update_fields=["password"])

        quiet_student, _ = User.objects.get_or_create(
            username=f"student_runtime_quiet_{suffix}",
            defaults={"email": f"student_runtime_quiet_{suffix}@example.com"},
        )
        quiet_student.set_password("runtime-pass")
        quiet_student.save(update_fields=["password"])

        today = timezone.localdate()
        course = CourseRepository.create(
            name=f"Student Analytics Runtime {suffix}",
            course_code=f"SR{suffix[:4].upper()}",
            term=f"VERIFY-{suffix[:4].upper()}",
            join_code=suffix[:8].upper(),
            start_date=today - timedelta(days=7),
            end_date=today + timedelta(days=30),
            created_by=teacher,
        )

        CourseMemberRepository.get_or_create_member(course.id, teacher.id, role="teacher")
        CourseMemberRepository.get_or_create_member(course.id, student.id, role="student")
        CourseMemberRepository.get_or_create_member(course.id, quiet_student.id, role="student")

        first_post = create_course_post_with_meta(
            user=student,
            course_id=course.id,
            content="Runtime prompt workflow notes #ai #prompt",
            mentions=None,
            mention_entities=None,
            hashtags=["ai", "prompt"],
            attachment_ids=None,
        )
        second_post = create_course_post_with_meta(
            user=student,
            course_id=course.id,
            content="Runtime career reflection on portfolio building #career",
            mentions=None,
            mention_entities=None,
            hashtags=["career"],
            attachment_ids=None,
        )

        older = timezone.now() - timedelta(days=3)
        newer = timezone.now() - timedelta(hours=2)
        CoursePost.objects.filter(id=first_post["id"]).update(created_at=older, updated_at=older)
        CoursePost.objects.filter(id=second_post["id"]).update(created_at=newer, updated_at=newer)

        CoursePostView.objects.create(post_id=first_post["id"], user=teacher)
        CoursePostView.objects.create(post_id=first_post["id"], user=student)
        CoursePostView.objects.create(post_id=second_post["id"], user=teacher)
        CoursePostLike.objects.create(post_id=first_post["id"], user=teacher)
        CoursePostComment.objects.create(
            post_id=first_post["id"],
            user=teacher,
            content="Baseline runtime comment",
        )

        return {
            "teacher": teacher,
            "student": student,
            "quiet_student": quiet_student,
            "course": course,
            "first_post_id": first_post["id"],
            "second_post_id": second_post["id"],
        }

    def _verify_empty_payload(self, data: dict) -> None:
        self.stdout.write("Verifying empty student analytics payload...")
        payload = build_student_analytics_payload(
            user=data["quiet_student"],
            target_user_id=data["quiet_student"].id,
        )
        self._assert_complete_payload_shape("empty payload", payload)
        if payload["items"] != []:
            raise CommandError("Empty student analytics payload unexpectedly contained items.")
        if payload["summary"]["totalPosts"] != 0:
            raise CommandError("Empty student analytics payload returned a non-zero post count.")
        if payload["bestTimeToPost"]["bestHourLabel"] != "—":
            raise CommandError("Empty student analytics payload should use the safe best-time placeholder.")
        self.stdout.write("Verified empty payload shape and fallbacks.")

    def _verify_baseline_payload(self, data: dict) -> None:
        self.stdout.write("Verifying baseline student analytics payload...")
        payload = build_student_analytics_payload(
            user=data["student"],
            target_user_id=data["student"].id,
        )
        self._assert_complete_payload_shape("baseline payload", payload)
        if payload["summary"]["totalPosts"] != 2:
            raise CommandError("Baseline student analytics payload did not count both posts.")
        if len(payload["topPosts"]) == 0:
            raise CommandError("Baseline student analytics payload did not include top posts.")
        if payload["bestTimeToPost"]["bestHourLabel"] == "—":
            raise CommandError("Baseline student analytics payload did not derive a best posting time.")
        if not payload["audienceInsights"]["breakdown"]:
            raise CommandError("Baseline student analytics payload did not include audience breakdown data.")
        self.stdout.write(
            f"Verified baseline payload: posts={payload['summary']['totalPosts']} "
            f"topPosts={len(payload['topPosts'])} bestHour={payload['bestTimeToPost']['bestHourLabel']}"
        )

    def _verify_interaction_refresh(self, data: dict) -> None:
        self.stdout.write("Verifying student analytics payload changes after likes/comments...")
        before = build_student_analytics_payload(
            user=data["student"],
            target_user_id=data["student"].id,
        )
        before_comments = before["summary"]["totalComments"]
        before_likes = before["summary"]["totalLikes"]
        before_top_score = before["topPosts"][0]["engagementScore"] if before["topPosts"] else 0

        like_course_post(user=data["teacher"], course_id=data["course"].id, post_id=data["second_post_id"])
        add_comment_to_post(
            user=data["teacher"],
            course_id=data["course"].id,
            post_id=data["second_post_id"],
            content="Runtime verification comment",
        )

        after = build_student_analytics_payload(
            user=data["student"],
            target_user_id=data["student"].id,
        )
        self._assert_complete_payload_shape("interaction payload", after)

        if after["summary"]["totalLikes"] <= before_likes:
            raise CommandError("Student analytics payload did not reflect the new like count.")
        if after["summary"]["totalComments"] <= before_comments:
            raise CommandError("Student analytics payload did not reflect the new comment count.")
        if not after["topPosts"]:
            raise CommandError("Student analytics payload lost topPosts after interaction changes.")
        if after["topPosts"][0]["engagementScore"] < before_top_score:
            raise CommandError("Student analytics top post score moved in the wrong direction after added interactions.")

        self.stdout.write(
            f"Verified interaction update: likes {before_likes}->{after['summary']['totalLikes']}, "
            f"comments {before_comments}->{after['summary']['totalComments']}"
        )

    def _assert_complete_payload_shape(self, label: str, payload: dict) -> None:
        expected_keys = {
            "items",
            "summary",
            "topPosts",
            "engagementTrend",
            "bestTimeToPost",
            "audienceInsights",
            "audiencePatterns",
            "aiInsight",
            "contentPatterns",
            "suggestions",
        }
        missing = expected_keys - set(payload.keys())
        if missing:
            raise CommandError(f"{label} missing keys: {sorted(missing)}")

        if not isinstance(payload["items"], list):
            raise CommandError(f"{label} returned a non-list items payload.")
        if not isinstance(payload["topPosts"], list):
            raise CommandError(f"{label} returned a non-list topPosts payload.")
        if not isinstance(payload["contentPatterns"], list):
            raise CommandError(f"{label} returned a non-list contentPatterns payload.")
        if not isinstance(payload["suggestions"], list):
            raise CommandError(f"{label} returned a non-list suggestions payload.")
        if not isinstance(payload["audiencePatterns"], list):
            raise CommandError(f"{label} returned a non-list audiencePatterns payload.")
        if not isinstance(payload["summary"], dict):
            raise CommandError(f"{label} returned a non-object summary payload.")
        if not isinstance(payload["engagementTrend"], dict):
            raise CommandError(f"{label} returned a non-object engagementTrend payload.")
        if not isinstance(payload["bestTimeToPost"], dict):
            raise CommandError(f"{label} returned a non-object bestTimeToPost payload.")
        if not isinstance(payload["audienceInsights"], dict):
            raise CommandError(f"{label} returned a non-object audienceInsights payload.")
        if not isinstance(payload["aiInsight"], dict):
            raise CommandError(f"{label} returned a non-object aiInsight payload.")


__all__ = ["Command"]
