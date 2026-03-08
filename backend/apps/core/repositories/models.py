from django.conf import settings
from django.db import models


class Message(models.Model):
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M:%S} - {self.content[:30]}"


class MediaAsset(models.Model):
    file = models.FileField(upload_to="uploads/")
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=128, blank=True)
    size = models.BigIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self) -> str:
        return self.original_name


class Notification(models.Model):
    recipient = models.CharField(max_length=64, db_index=True)
    actor = models.CharField(max_length=64)
    action = models.CharField(max_length=32)
    subject = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    link = models.URLField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.recipient} <- {self.actor} {self.action}"


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    avatar_url = models.TextField(blank=True)
    gender = models.CharField(max_length=32)
    city = models.CharField(max_length=64)
    age_group = models.CharField(max_length=32)
    education_level = models.CharField(max_length=64)
    income_level = models.CharField(max_length=64)
    social_value = models.PositiveSmallIntegerField()
    interests = models.JSONField(default=list, blank=True)
    sociability = models.PositiveSmallIntegerField()
    openness = models.PositiveSmallIntegerField()
    shopping_frequency = models.CharField(max_length=64)
    buying_behavior = models.CharField(max_length=64)
    decision_factor = models.CharField(max_length=64)
    shopping_preference = models.CharField(max_length=64)
    digital_time = models.CharField(max_length=64)
    content_preference = models.CharField(max_length=64)
    interaction_style = models.CharField(max_length=64)
    influencer_type = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Profile<{self.user_id}>"


class Course(models.Model):
    name = models.CharField(max_length=120)
    course_code = models.CharField(max_length=32)
    term = models.CharField(max_length=32)
    join_code = models.CharField(max_length=16, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("course_code", "term")]
        ordering = ["course_code"]

    def __str__(self) -> str:
        return f"{self.course_code} ({self.term})"


class CourseAIUser(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="ai_users")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_ai_users",
    )
    username = models.CharField(max_length=64)
    display_name = models.CharField(max_length=120, blank=True)
    gender = models.CharField(max_length=32, blank=True)
    city = models.CharField(max_length=64, blank=True)
    age_group = models.CharField(max_length=32, blank=True)
    education_level = models.CharField(max_length=64, blank=True)
    income_level = models.CharField(max_length=64, blank=True)
    social_value = models.PositiveSmallIntegerField(null=True, blank=True)
    sociability = models.PositiveSmallIntegerField(null=True, blank=True)
    openness = models.PositiveSmallIntegerField(null=True, blank=True)
    content_preference = models.CharField(max_length=64, blank=True)
    interests = models.JSONField(default=list, blank=True)
    shopping_frequency = models.CharField(max_length=64, blank=True)
    buying_behavior = models.CharField(max_length=64, blank=True)
    decision_factor = models.CharField(max_length=64, blank=True)
    shopping_preference = models.CharField(max_length=64, blank=True)
    digital_time = models.CharField(max_length=64, blank=True)
    interaction_style = models.CharField(max_length=64, blank=True)
    influencer_type = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("course", "username")]
        ordering = ["username"]

    def __str__(self) -> str:
        return f"AIUser<{self.course_id}:{self.username}>"


class CourseAIUserIdentity(models.Model):
    ai_user = models.OneToOneField(
        CourseAIUser,
        on_delete=models.CASCADE,
        related_name="identity",
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ai_user_identity",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["ai_user_id"]

    def __str__(self) -> str:
        return f"AIIdentity<{self.ai_user_id}->{self.user_id}>"


class CourseMember(models.Model):
    ROLE_CHOICES = [
        ("teacher", "Teacher"),
        ("student", "Student"),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="course_memberships")
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default="student")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("course", "user")]
        ordering = ["-joined_at"]

    def __str__(self) -> str:
        return f"{self.user_id}->{self.course_id}"


class CourseProfile(models.Model):
    """Per-course persona info."""

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="profiles",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="course_profiles",
    )
    avatar_url = models.TextField(blank=True)
    gender = models.CharField(max_length=32, blank=True)
    city = models.CharField(max_length=64, blank=True)
    age_group = models.CharField(max_length=32, blank=True)
    education_level = models.CharField(max_length=64, blank=True)
    income_level = models.CharField(max_length=64, blank=True)
    social_value = models.PositiveSmallIntegerField(default=5)
    interests = models.JSONField(default=list, blank=True)
    sociability = models.PositiveSmallIntegerField(default=5)
    openness = models.PositiveSmallIntegerField(default=5)
    shopping_frequency = models.CharField(max_length=64, blank=True)
    buying_behavior = models.CharField(max_length=64, blank=True)
    decision_factor = models.CharField(max_length=64, blank=True)
    shopping_preference = models.CharField(max_length=64, blank=True)
    digital_time = models.CharField(max_length=64, blank=True)
    content_preference = models.CharField(max_length=64, blank=True)
    interaction_style = models.CharField(max_length=64, blank=True)
    influencer_type = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("course", "user")]
        ordering = ["course_id", "user_id"]

    def __str__(self) -> str:
        return f"CourseProfile<{self.course_id}:{self.user_id}>"
class CoursePost(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="posts")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="course_posts",
    )
    content = models.TextField()
    mentions = models.JSONField(default=list, blank=True)
    hashtags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"CoursePost<{self.course_id}:{self.author_id}>"


class CoursePostLike(models.Model):
    post = models.ForeignKey(
        CoursePost,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="liked_course_posts",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("post", "user")]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"CoursePostLike<{self.post_id}:{self.user_id}>"


class CoursePostView(models.Model):
    post = models.ForeignKey(
        CoursePost,
        on_delete=models.CASCADE,
        related_name="views",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="course_post_views",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"CoursePostView<{self.post_id}:{self.user_id}>"


class CoursePostAttachment(models.Model):
    post = models.ForeignKey(
        CoursePost,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    asset = models.ForeignKey(
        MediaAsset,
        on_delete=models.CASCADE,
        related_name="post_attachments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"CoursePostAttachment<{self.post_id}:{self.asset_id}>"


class CoursePostMention(models.Model):
    post = models.ForeignKey(
        CoursePost,
        on_delete=models.CASCADE,
        related_name="mentions_rel",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mentioned_in_posts",
    )
    identifier = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("post", "user")]
        ordering = ["id"]

    def __str__(self) -> str:
        return f"CoursePostMention<{self.post_id}:{self.user_id}>"


class UserFollow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="following",
    )
    target = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="followers",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("follower", "target")]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Follow<{self.follower_id}->{self.target_id}>"


class CoursePostComment(models.Model):
    post = models.ForeignKey(
        CoursePost,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="course_post_comments",
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"CoursePostComment<{self.post_id}:{self.user_id}>"


class DashboardSnapshot(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="dashboard_snapshot",
    )
    data = models.JSONField(default=dict, blank=True)
    calculated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-calculated_at"]

    def __str__(self) -> str:
        return f"DashboardSnapshot<{self.user_id}>"


class CourseDashboardSnapshot(models.Model):
    course = models.OneToOneField(
        Course,
        on_delete=models.CASCADE,
        related_name="dashboard_snapshot",
    )
    data = models.JSONField(default=dict, blank=True)
    calculated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["course_id"]

    def __str__(self) -> str:
        return f"CourseDashboardSnapshot<{self.course_id}>"


class CourseHashtagDashboardSnapshot(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="hashtag_dashboard_snapshots",
    )
    hashtag = models.CharField(max_length=120)
    data = models.JSONField(default=dict, blank=True)
    calculated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("course", "hashtag")]
        ordering = ["course_id", "hashtag"]

    def __str__(self) -> str:
        return f"CourseHashtagDashboardSnapshot<{self.course_id}:{self.hashtag}>"


class CourseStudentDashboardSnapshot(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="student_dashboard_snapshots",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="course_dashboard_snapshots",
    )
    data = models.JSONField(default=dict, blank=True)
    calculated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("course", "student")]
        ordering = ["course_id", "student_id"]

    def __str__(self) -> str:
        return f"CourseStudentDashboardSnapshot<{self.course_id}:{self.student_id}>"


class PostAnalyticsSnapshot(models.Model):
    post = models.OneToOneField(
        CoursePost,
        on_delete=models.CASCADE,
        related_name="analytics_snapshot",
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="post_analytics_snapshots",
    )
    totals = models.JSONField(default=dict, blank=True)
    sentiment_counts = models.JSONField(default=dict, blank=True)
    sentiment_percentages = models.JSONField(default=dict, blank=True)
    range_start = models.DateField()
    range_end = models.DateField()
    range_days = models.PositiveIntegerField(default=7)
    calculated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-calculated_at"]

    def __str__(self) -> str:
        return f"PostAnalyticsSnapshot<{self.post_id}>"
