# Legacy imports (kept for backward compatibility)
from .ai_user_identity_repository import CourseAIUserIdentityRepository
from .ai_user_repository import CourseAIUserRepository
from .auth_user import (
    UserCreationResult,
    create_user,
    get_by_email,
    get_by_username,
)

# New Repository Pattern Imports
from .base import BaseRepository
from .course_profile_repository import CourseProfileRepository
from .course_repository import CourseMemberRepository, CourseRepository
from .follow_repository import FollowRepository
from .media_repository import MediaRepository
from .models import (
    Course,
    CourseAIUser,
    CourseAIUserIdentity,
    CourseDashboardSnapshot,
    CourseHashtagDashboardSnapshot,
    CourseMember,
    CoursePost,
    CoursePostAttachment,
    CoursePostComment,
    CoursePostLike,
    CoursePostMention,
    CoursePostView,
    CourseProfile,
    CourseStudentDashboardSnapshot,
    DashboardSnapshot,
    MediaAsset,
    Message,
    Notification,
    PostAnalyticsSnapshot,
    UserFollow,
    UserProfile,
)
from .notification_repository import NotificationRepository
from .post_analytics_snapshot_repository import PostAnalyticsSnapshotRepository
from .post_repository import (
    PostAttachmentRepository,
    PostCommentRepository,
    PostLikeRepository,
    PostMentionRepository,
    PostRepository,
    PostViewRepository,
)
from .profile_repository import ProfileRepository
from .user_repository import UserRepository

__all__ = [
    # Legacy exports
    "MediaAsset",
    "Message",
    "Notification",
    "UserProfile",
    "Course",
    "CourseMember",
    "CoursePost",
    "CoursePostLike",
    "CoursePostAttachment",
    "CoursePostMention",
    "CoursePostComment",
    "CoursePostView",
    "CourseAIUser",
    "CourseAIUserIdentity",
    "CourseProfile",
    "PostAnalyticsSnapshot",
    "DashboardSnapshot",
    "CourseDashboardSnapshot",
    "CourseHashtagDashboardSnapshot",
    "CourseStudentDashboardSnapshot",
    "CourseHashtagDashboardSnapshot",
    "CourseStudentDashboardSnapshot",
    "UserFollow",
    "create_user",
    "get_by_email",
    "get_by_username",
    "UserCreationResult",
    # New Repository classes
    "BaseRepository",
    "UserRepository",
    "ProfileRepository",
    "CourseRepository",
    "CourseMemberRepository",
    "CourseProfileRepository",
    "CourseAIUserRepository",
    "CourseAIUserIdentityRepository",
    "PostAnalyticsSnapshotRepository",
    "PostRepository",
    "PostLikeRepository",
    "PostCommentRepository",
    "PostAttachmentRepository",
    "PostMentionRepository",
    "PostViewRepository",
    "NotificationRepository",
    "MediaRepository",
    "FollowRepository",
]
