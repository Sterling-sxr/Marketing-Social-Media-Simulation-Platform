from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0013_dashboardsnapshot"),
    ]

    operations = [
        migrations.CreateModel(
            name="CourseDashboardSnapshot",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
                ("data", models.JSONField(blank=True, default=dict)),
                ("calculated_at", models.DateTimeField(auto_now=True)),
                (
                    "course",
                    models.OneToOneField(on_delete=models.CASCADE, related_name="dashboard_snapshot", to="core.course"),
                ),
            ],
            options={"ordering": ["course_id"]},
        ),
    ]
