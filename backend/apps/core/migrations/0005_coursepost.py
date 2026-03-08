from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0004_userprofile_courses"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CoursePost",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="course_posts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "course",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="posts",
                        to="core.course",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="CoursePostLike",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "post",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="likes",
                        to="core.coursepost",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="liked_course_posts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"], "unique_together": {("post", "user")}},
        ),
    ]
