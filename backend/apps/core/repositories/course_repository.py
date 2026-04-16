"""Module note: course_repository backend module."""
from __future__ import annotations

from typing import List, Optional

from django.db.models import Count

from .base import BaseRepository
from .models import Course, CourseMember


class CourseRepository(BaseRepository[Course]):
    """Class note: CourseRepository encapsulates related backend behavior."""
    model = Course
    
    @classmethod
    def get_by_join_code(cls, join_code: str) -> Optional[Course]:
        """Function note: get_by_join_code handles this backend operation."""
        return cls.model.objects.filter(join_code=join_code).first()
    
    @classmethod
    def get_user_courses(cls, user_id: int) -> List[Course]:
        """Function note: get_user_courses handles this backend operation."""
        return list(
            cls.model.objects
            .filter(members__user_id=user_id)
            .prefetch_related('members')
            .order_by('course_code')
        )
    
    @classmethod
    def get_available_courses(cls, user_id: int) -> List[Course]:
        """Function note: get_available_courses handles this backend operation."""
        return list(
            cls.model.objects
            .exclude(members__user_id=user_id)
            .order_by('course_code')
        )
    
    @classmethod
    def get_created_by_user(cls, user_id: int) -> List[Course]:
        """Function note: get_created_by_user handles this backend operation."""
        return list(
            cls.model.objects
            .filter(created_by_id=user_id)
            .order_by('-created_at')
        )
    
    @classmethod
    def is_user_member(cls, course_id: int, user_id: int) -> bool:
        """Function note: is_user_member handles this backend operation."""
        return CourseMember.objects.filter(
            course_id=course_id,
            user_id=user_id
        ).exists()
    
    @classmethod
    def get_user_role(cls, course_id: int, user_id: int) -> Optional[str]:
        """Function note: get_user_role handles this backend operation."""
        member = CourseMember.objects.filter(
            course_id=course_id,
            user_id=user_id
        ).first()
        return member.role if member else None
    
    @classmethod
    def get_with_stats(cls, course_id: int) -> Optional[dict]:
        """Function note: get_with_stats handles this backend operation."""
        try:
            course = (
                cls.model.objects
                .annotate(
                    member_count=Count('members', distinct=True),
                    post_count=Count('posts', distinct=True)
                )
                .get(pk=course_id)
            )
            return {
                'id': course.id,
                'name': course.name,
                'course_code': course.course_code,
                'term': course.term,
                'member_count': course.member_count,
                'post_count': course.post_count,
            }
        except cls.model.DoesNotExist:
            return None


class CourseMemberRepository(BaseRepository[CourseMember]):
    """Class note: CourseMemberRepository encapsulates related backend behavior."""
    model = CourseMember
    
    @classmethod
    def add_member(cls, course_id: int, user_id: int, role: str = 'student') -> CourseMember:
        """Function note: add_member handles this backend operation."""
        return cls.create(course_id=course_id, user_id=user_id, role=role)
    
    @classmethod
    def get_or_create_member(cls, course_id: int, user_id: int, role: str = 'student') -> tuple[CourseMember, bool]:
        """Function note: get_or_create_member handles this backend operation."""
        return cls.model.objects.get_or_create(
            course_id=course_id,
            user_id=user_id,
            defaults={'role': role}
        )
    
    @classmethod
    def get_course_members(cls, course_id: int) -> List[CourseMember]:
        """Function note: get_course_members handles this backend operation."""
        return list(
            cls.model.objects
            .filter(course_id=course_id)
            .select_related('user')
            .order_by('-joined_at')
        )


__all__ = ["CourseRepository", "CourseMemberRepository"]
