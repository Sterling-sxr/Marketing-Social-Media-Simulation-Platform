"""Module summary: post_repository defines backend functionality with clear intent."""
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
    """Class summary: PostRepository groups related behavior in one place."""
    model = CoursePost
    
    @classmethod
    def get_with_details(cls, post_id: int) -> Optional[CoursePost]:
        """Function summary: get_with_details executes this unit of backend logic."""
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
        """Function summary: get_course_posts executes this unit of backend logic."""
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
        
        # Section summary: this block is described for easier reading.
        if hashtag:
            normalized = hashtag.lower()
            queryset = queryset.filter(
                Q(hashtags__contains=[normalized]) |
                Q(hashtags__contains=[hashtag])
            )
        
        # Section summary: this block is described for easier reading.
        if following_only and following_ids:
            queryset = queryset.filter(author_id__in=following_ids)
        
        return list(queryset[:limit])
    
    @classmethod
    def get_user_posts(cls, user_id: int, course_ids: List[int], limit: int | None = None) -> List[CoursePost]:
        """Function summary: get_user_posts executes this unit of backend logic."""
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
        """Function summary: get_liked_posts executes this unit of backend logic."""
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
    """Class summary: PostLikeRepository groups related behavior in one place."""
    model = CoursePostLike
    
    @classmethod
    def get_or_create_like(cls, post_id: int, user_id: int) -> tuple[CoursePostLike, bool]:
        """Function summary: get_or_create_like executes this unit of backend logic."""
        return cls.model.objects.get_or_create(post_id=post_id, user_id=user_id)
    
    @classmethod
    def unlike(cls, post_id: int, user_id: int) -> int:
        """Function summary: unlike executes this unit of backend logic."""
        return cls.delete_by_filter(post_id=post_id, user_id=user_id)
    
    @classmethod
    def get_like_count(cls, post_id: int) -> int:
        """Function summary: get_like_count executes this unit of backend logic."""
        return cls.count(post_id=post_id)
    
    @classmethod
    def get_like_counts(cls, post_ids: List[int]) -> dict[int, int]:
        """Function summary: get_like_counts executes this unit of backend logic."""
        counts = (
            cls.model.objects
            .filter(post_id__in=post_ids)
            .values('post_id')
            .annotate(total=Count('id'))
        )
        return {item['post_id']: item['total'] for item in counts}
    
    @classmethod
    def get_user_liked_posts(cls, user_id: int, post_ids: List[int]) -> Set[int]:
        """Function summary: get_user_liked_posts executes this unit of backend logic."""
        return set(
            cls.model.objects
            .filter(post_id__in=post_ids, user_id=user_id)
            .values_list('post_id', flat=True)
        )


class PostCommentRepository(BaseRepository[CoursePostComment]):
    """Class summary: PostCommentRepository groups related behavior in one place."""
    model = CoursePostComment
    
    @classmethod
    def get_post_comments(cls, post_id: int) -> List[CoursePostComment]:
        """Function summary: get_post_comments executes this unit of backend logic."""
        return list(
            cls.model.objects
            .filter(post_id=post_id)
            .select_related('user', 'user__userprofile')
            .order_by('id')
        )
    
    @classmethod
    def get_comment_count(cls, post_id: int) -> int:
        """Function summary: get_comment_count executes this unit of backend logic."""
        return cls.count(post_id=post_id)
    
    @classmethod
    def get_comment_counts(cls, post_ids: List[int]) -> dict[int, int]:
        """Function summary: get_comment_counts executes this unit of backend logic."""
        counts = (
            cls.model.objects
            .filter(post_id__in=post_ids)
            .values('post_id')
            .annotate(total=Count('id'))
        )
        return {item['post_id']: item['total'] for item in counts}


class PostAttachmentRepository(BaseRepository[CoursePostAttachment]):
    """Class summary: PostAttachmentRepository groups related behavior in one place."""
    model = CoursePostAttachment
    
    @classmethod
    def attach_to_post(cls, post_id: int, asset_ids: List[int]) -> int:
        """Function summary: attach_to_post executes this unit of backend logic."""
        attachments = [
            cls.model(post_id=post_id, asset_id=asset_id)
            for asset_id in asset_ids
        ]
        created = cls.bulk_create(attachments)
        return len(created)


class PostMentionRepository(BaseRepository[CoursePostMention]):
    """Class summary: PostMentionRepository groups related behavior in one place."""
    model = CoursePostMention
    
    @classmethod
    def create_mentions(cls, post_id: int, mention_entities: List[dict]) -> int:
        """Function summary: create_mentions executes this unit of backend logic."""
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
    """Class summary: PostViewRepository groups related behavior in one place."""
    model = CoursePostView

    @classmethod
    def create_view(cls, post_id: int, user_id: int | None) -> CoursePostView:
        """Function summary: create_view executes this unit of backend logic."""
        return cls.create(post_id=post_id, user_id=user_id)

    @classmethod
    def count_views(cls, post_id: int) -> int:
        """Function summary: count_views executes this unit of backend logic."""
        return cls.count(post_id=post_id)


__all__ = [
    "PostRepository",
    "PostLikeRepository",
    "PostCommentRepository",
    "PostAttachmentRepository",
    "PostMentionRepository",
]
