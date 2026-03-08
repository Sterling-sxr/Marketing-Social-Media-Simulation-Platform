from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_alter_course_created_by"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CoursePostMention",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("identifier", models.CharField(blank=True, max_length=80)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "post",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="mentions_rel",
                        to="core.coursepost",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="mentioned_in_posts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["id"], "unique_together": {("post", "user")}},
        ),
    ]
