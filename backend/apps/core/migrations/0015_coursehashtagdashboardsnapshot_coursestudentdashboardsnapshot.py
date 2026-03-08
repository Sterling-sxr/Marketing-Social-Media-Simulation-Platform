from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0014_coursedashboardsnapshot"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CourseHashtagDashboardSnapshot",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("hashtag", models.CharField(max_length=120)),
                ("data", models.JSONField(blank=True, default=dict)),
                ("calculated_at", models.DateTimeField(auto_now=True)),
                ("course", models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name="hashtag_dashboard_snapshots",
                    to="core.course",
                )),
            ],
            options={
                "ordering": ["course_id", "hashtag"],
                "unique_together": {("course", "hashtag")},
            },
        ),
        migrations.CreateModel(
            name="CourseStudentDashboardSnapshot",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("data", models.JSONField(blank=True, default=dict)),
                ("calculated_at", models.DateTimeField(auto_now=True)),
                ("course", models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name="student_dashboard_snapshots",
                    to="core.course",
                )),
                ("student", models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name="course_dashboard_snapshots",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ["course_id", "student_id"],
                "unique_together": {("course", "student")},
            },
        ),
    ]
