"""Module summary: Collect related domain logic and document the intended design boundaries."""
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
    """Class summary: PostRepository keeps related behavior together behind one clear interface."""
    model = CoursePost
    
    @classmethod
    def get_with_details(cls, post_id: int) -> Optional[CoursePost]:
        """Execute the `get_with_details` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
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
        """Execute the `get_course_posts` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
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
        
        # Context: Compute shared values once so all branches use the same normalized inputs.
        if hashtag:
            normalized = hashtag.lower()
            queryset = queryset.filter(
                Q(hashtags__contains=[normalized]) |
                Q(hashtags__contains=[hashtag])
            )
        
        # Context: Compute shared values once so all branches use the same normalized inputs.
        if following_only and following_ids:
            queryset = queryset.filter(author_id__in=following_ids)
        
        return list(queryset[:limit])
    
    @classmethod
    def get_user_posts(cls, user_id: int, course_ids: List[int], limit: int | None = None) -> List[CoursePost]:
        """Execute the `get_user_posts` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
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
        """Execute the `get_liked_posts` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
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
    """Class summary: PostLikeRepository keeps related behavior together behind one clear interface."""
    model = CoursePostLike
    
    @classmethod
    def get_or_create_like(cls, post_id: int, user_id: int) -> tuple[CoursePostLike, bool]:
        """Execute the `get_or_create_like` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.model.objects.get_or_create(post_id=post_id, user_id=user_id)
    
    @classmethod
    def unlike(cls, post_id: int, user_id: int) -> int:
        """Execute the `unlike` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.delete_by_filter(post_id=post_id, user_id=user_id)
    
    @classmethod
    def get_like_count(cls, post_id: int) -> int:
        """Execute the `get_like_count` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.count(post_id=post_id)
    
    @classmethod
    def get_like_counts(cls, post_ids: List[int]) -> dict[int, int]:
        """Execute the `get_like_counts` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        counts = (
            cls.model.objects
            .filter(post_id__in=post_ids)
            .values('post_id')
            .annotate(total=Count('id'))
        )
        return {item['post_id']: item['total'] for item in counts}
    
    @classmethod
    def get_user_liked_posts(cls, user_id: int, post_ids: List[int]) -> Set[int]:
        """Execute the `get_user_liked_posts` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return set(
            cls.model.objects
            .filter(post_id__in=post_ids, user_id=user_id)
            .values_list('post_id', flat=True)
        )


class PostCommentRepository(BaseRepository[CoursePostComment]):
    """Class summary: PostCommentRepository keeps related behavior together behind one clear interface."""
    model = CoursePostComment
    
    @classmethod
    def get_post_comments(cls, post_id: int) -> List[CoursePostComment]:
        """Execute the `get_post_comments` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return list(
            cls.model.objects
            .filter(post_id=post_id)
            .select_related('user', 'user__userprofile')
            .order_by('id')
        )
    
    @classmethod
    def get_comment_count(cls, post_id: int) -> int:
        """Execute the `get_comment_count` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.count(post_id=post_id)
    
    @classmethod
    def get_comment_counts(cls, post_ids: List[int]) -> dict[int, int]:
        """Execute the `get_comment_counts` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        counts = (
            cls.model.objects
            .filter(post_id__in=post_ids)
            .values('post_id')
            .annotate(total=Count('id'))
        )
        return {item['post_id']: item['total'] for item in counts}


class PostAttachmentRepository(BaseRepository[CoursePostAttachment]):
    """Class summary: PostAttachmentRepository keeps related behavior together behind one clear interface."""
    model = CoursePostAttachment
    
    @classmethod
    def attach_to_post(cls, post_id: int, asset_ids: List[int]) -> int:
        """Execute the `attach_to_post` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        attachments = [
            cls.model(post_id=post_id, asset_id=asset_id)
            for asset_id in asset_ids
        ]
        created = cls.bulk_create(attachments)
        return len(created)


class PostMentionRepository(BaseRepository[CoursePostMention]):
    """Class summary: PostMentionRepository keeps related behavior together behind one clear interface."""
    model = CoursePostMention
    
    @classmethod
    def create_mentions(cls, post_id: int, mention_entities: List[dict]) -> int:
        """Execute the `create_mentions` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
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
    """Class summary: PostViewRepository keeps related behavior together behind one clear interface."""
    model = CoursePostView

    @classmethod
    def create_view(cls, post_id: int, user_id: int | None) -> CoursePostView:
        """Execute the `create_view` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.create(post_id=post_id, user_id=user_id)

    @classmethod
    def count_views(cls, post_id: int) -> int:
        """Execute the `count_views` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.count(post_id=post_id)


__all__ = [
    "PostRepository",
    "PostLikeRepository",
    "PostCommentRepository",
    "PostAttachmentRepository",
    "PostMentionRepository",
]
