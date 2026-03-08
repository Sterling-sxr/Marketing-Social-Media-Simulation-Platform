import datetime

from django.conf import settings
from django.db import migrations, models


def seed_courses(apps, schema_editor):
    Course = apps.get_model("core", "Course")
    if Course.objects.exists():
        return
    today = datetime.date.today()
    default_start = datetime.date(today.year, 2, 1)
    default_end = datetime.date(today.year, 5, 31)
    courses = [
        {
            "name": "Social Media Strategy",
            "course_code": "COMM5010",
            "term": "2025T1",
            "join_code": "JOINCOMM",
        },
        {
            "name": "Digital Communities",
            "course_code": "COMM5020",
            "term": "2025T1",
            "join_code": "JOINDIGI",
        },
        {
            "name": "Marketing Analytics",
            "course_code": "COMM5030",
            "term": "2025T1",
            "join_code": "JOINMKTG",
        },
    ]
    for course in courses:
        Course.objects.create(
            name=course["name"],
            course_code=course["course_code"],
            term=course["term"],
            join_code=course["join_code"],
            start_date=default_start,
            end_date=default_end,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_notification"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("gender", models.CharField(max_length=32)),
                ("city", models.CharField(max_length=64)),
                ("age_group", models.CharField(max_length=32)),
                ("education_level", models.CharField(max_length=64)),
                ("income_level", models.CharField(max_length=64)),
                ("social_value", models.PositiveSmallIntegerField()),
                ("interests", models.JSONField(blank=True, default=list)),
                ("sociability", models.PositiveSmallIntegerField()),
                ("openness", models.PositiveSmallIntegerField()),
                ("shopping_frequency", models.CharField(max_length=64)),
                ("buying_behavior", models.CharField(max_length=64)),
                ("decision_factor", models.CharField(max_length=64)),
                ("shopping_preference", models.CharField(max_length=64)),
                ("digital_time", models.CharField(max_length=64)),
                ("content_preference", models.CharField(max_length=64)),
                ("interaction_style", models.CharField(max_length=64)),
                ("influencer_type", models.CharField(max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=models.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="Course",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("course_code", models.CharField(max_length=32)),
                ("term", models.CharField(max_length=32)),
                ("join_code", models.CharField(max_length=16, unique=True)),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="courses_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["course_code"], "unique_together": {("course_code", "term")}},
        ),
        migrations.CreateModel(
            name="CourseMember",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("teacher", "Teacher"), ("student", "Student")], default="student", max_length=16)),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                (
                    "course",
                    models.ForeignKey(on_delete=models.CASCADE, related_name="members", to="core.course"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=models.CASCADE, related_name="course_memberships", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={"ordering": ["-joined_at"], "unique_together": {("course", "user")}},
        ),
        migrations.RunPython(seed_courses, migrations.RunPython.noop),
    ]
