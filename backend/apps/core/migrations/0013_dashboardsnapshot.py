from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_coursepostview"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DashboardSnapshot",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
                ("data", models.JSONField(blank=True, default=dict)),
                ("calculated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=models.CASCADE,
                        related_name="dashboard_snapshot",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-calculated_at"]},
        ),
    ]
