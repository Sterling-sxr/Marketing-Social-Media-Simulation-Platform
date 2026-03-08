import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_coursepostmention"),
    ]

    operations = [
        migrations.CreateModel(
            name="CoursePostComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "post",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="core.coursepost"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="course_post_comments", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
    ]


