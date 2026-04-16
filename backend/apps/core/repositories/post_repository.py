"""Module note: post_repository backend module."""
from __future__ import annotations

from typing import List, Optional, Set

from django.db.models import Count, Prefetch, Q

from .base import BaseRepository
from .models import (
    CoursePost,
    CoursePostAttachment,
    CoursePostComment,
    CoursePostLike,
    CoursePostMention,
    CoursePostView,
)


class PostRepository(BaseRepository[CoursePost]):
    """Class note: PostRepository encapsulates related backend behavior."""
    model = CoursePost
    
    @classmethod
    def get_with_details(cls, post_id: int) -> Optional[CoursePost]:
        """Function note: get_with_details handles this backend operation."""
        try:
            return (
                cls.model.objects
                .select_related('author', 'author__userprofile')
                .prefetch_related(
                    Prefetch(
                        'attachments',
                        queryset=CoursePostAttachment.objects.select_related('asset').order_by('id')
                    ),
                    Prefetch(
                        'mentions_rel',
                        queryset=CoursePostMention.objects.select_related('user').order_by('id')
                    ),
                )
                .get(pk=post_id)
            )
        except cls.model.DoesNotExist:
            return None
    
    @classmethod
    def get_course_posts(
        cls,
        course_id: int,
        hashtag: Optional[str] = None,
        following_only: bool = False,
        following_ids: List[int] = None,
        limit: int = 50
    ) -> List[CoursePost]:
        """Function note: get_course_posts handles this backend operation."""
        queryset = (
            cls.model.objects
            .filter(course_id=course_id)
            .select_related('author', 'author__userprofile')
            .prefetch_related(
                Prefetch(
                    'attachments',
                    queryset=CoursePostAttachment.objects.select_related('asset').order_by('id')
                ),
                Prefetch(
                    'mentions_rel',
                    queryset=CoursePostMention.objects.select_related('user').order_by('id')
                ),
            )
            .order_by('-created_at')
        )
        
        # Section note: explains the purpose of this backend block.
        if hashtag:
            normalized = hashtag.lower()
            queryset = queryset.filter(
                Q(hashtags__contains=[normalized]) |
                Q(hashtags__contains=[hashtag])
            )
        
        # Section note: explains the purpose of this backend block.
        if following_only and following_ids:
            queryset = queryset.filter(author_id__in=following_ids)
        
        return list(queryset[:limit])
    
    @classmethod
    def get_user_posts(cls, user_id: int, course_ids: List[int], limit: int | None = None) -> List[CoursePost]:
        """Function note: get_user_posts handles this backend operation."""
        queryset = (
            cls.model.objects
            .filter(author_id=user_id, course_id__in=course_ids)
            .select_related('author', 'author__userprofile')
            .prefetch_related(
                Prefetch(
                    'attachments',
                    queryset=CoursePostAttachment.objects.select_related('asset').order_by('id')
                ),
                Prefetch(
                    'mentions_rel',
                    queryset=CoursePostMention.objects.select_related('user').order_by('id')
                ),
            )
            .order_by('-created_at')
        )
        if limit is not None:
            queryset = queryset[:limit]
        return list(queryset)
    
    @classmethod
    def get_liked_posts(cls, user_id: int, course_ids: List[int]) -> List[CoursePost]:
        """Function note: get_liked_posts handles this backend operation."""
        return list(
            cls.model.objects
            .filter(course_id__in=course_ids, likes__user_id=user_id)
            .select_related('author', 'author__userprofile')
            .prefetch_related(
                Prefetch(
                    'attachments',
                    queryset=CoursePostAttachment.objects.select_related('asset').order_by('id')
                ),
                Prefetch(
                    'mentions_rel',
                    queryset=CoursePostMention.objects.select_related('user').order_by('id')
                ),
            )
            .order_by('-created_at')
        )


class PostLikeRepository(BaseRepository[CoursePostLike]):
    """Class note: PostLikeRepository encapsulates related backend behavior."""
    model = CoursePostLike
    
    @classmethod
    def get_or_create_like(cls, post_id: int, user_id: int) -> tuple[CoursePostLike, bool]:
        """Function note: get_or_create_like handles this backend operation."""
        return cls.model.objects.get_or_create(post_id=post_id, user_id=user_id)
    
    @classmethod
    def unlike(cls, post_id: int, user_id: int) -> int:
        """Function note: unlike handles this backend operation."""
        return cls.delete_by_filter(post_id=post_id, user_id=user_id)
    
    @classmethod
    def get_like_count(cls, post_id: int) -> int:
        """Function note: get_like_count handles this backend operation."""
        return cls.count(post_id=post_id)
    
    @classmethod
    def get_like_counts(cls, post_ids: List[int]) -> dict[int, int]:
        """Function note: get_like_counts handles this backend operation."""
        counts = (
            cls.model.objects
            .filter(post_id__in=post_ids)
            .values('post_id')
            .annotate(total=Count('id'))
        )
        return {item['post_id']: item['total'] for item in counts}
    
    @classmethod
    def get_user_liked_posts(cls, user_id: int, post_ids: List[int]) -> Set[int]:
        """Function note: get_user_liked_posts handles this backend operation."""
        return set(
            cls.model.objects
            .filter(post_id__in=post_ids, user_id=user_id)
            .values_list('post_id', flat=True)
        )


class PostCommentRepository(BaseRepository[CoursePostComment]):
    """Class note: PostCommentRepository encapsulates related backend behavior."""
    model = CoursePostComment
    
    @classmethod
    def get_post_comments(cls, post_id: int) -> List[CoursePostComment]:
        """Function note: get_post_comments handles this backend operation."""
        return list(
            cls.model.objects
            .filter(post_id=post_id)
            .select_related('user', 'user__userprofile')
            .order_by('id')
        )
    
    @classmethod
    def get_comment_count(cls, post_id: int) -> int:
        """Function note: get_comment_count handles this backend operation."""
        return cls.count(post_id=post_id)
    
    @classmethod
    def get_comment_counts(cls, post_ids: List[int]) -> dict[int, int]:
        """Function note: get_comment_counts handles this backend operation."""
        counts = (
            cls.model.objects
            .filter(post_id__in=post_ids)
            .values('post_id')
            .annotate(total=Count('id'))
        )
        return {item['post_id']: item['total'] for item in counts}


class PostAttachmentRepository(BaseRepository[CoursePostAttachment]):
    """Class note: PostAttachmentRepository encapsulates related backend behavior."""
    model = CoursePostAttachment
    
    @classmethod
    def attach_to_post(cls, post_id: int, asset_ids: List[int]) -> int:
        """Function note: attach_to_post handles this backend operation."""
        attachments = [
            cls.model(post_id=post_id, asset_id=asset_id)
            for asset_id in asset_ids
        ]
        created = cls.bulk_create(attachments)
        return len(created)


class PostMentionRepository(BaseRepository[CoursePostMention]):
    """Class note: PostMentionRepository encapsulates related backend behavior."""
    model = CoursePostMention
    
    @classmethod
    def create_mentions(cls, post_id: int, mention_entities: List[dict]) -> int:
        """Function note: create_mentions handles this backend operation."""
        mentions = [
            cls.model(
                post_id=post_id,
                user_id=m['user_id'],
                identifier=m.get('identifier', '')
            )
            for m in mention_entities
        ]
        created = cls.bulk_create(mentions, ignore_conflicts=True)
        return len(created)


class PostViewRepository(BaseRepository[CoursePostView]):
    """Class note: PostViewRepository encapsulates related backend behavior."""
    model = CoursePostView

    @classmethod
    def create_view(cls, post_id: int, user_id: int | None) -> CoursePostView:
        """Function note: create_view handles this backend operation."""
        return cls.create(post_id=post_id, user_id=user_id)

    @classmethod
    def count_views(cls, post_id: int) -> int:
        """Function note: count_views handles this backend operation."""
        return cls.count(post_id=post_id)


__all__ = [
    "PostRepository",
    "PostLikeRepository",
    "PostCommentRepository",
    "PostAttachmentRepository",
    "PostMentionRepository",
]
