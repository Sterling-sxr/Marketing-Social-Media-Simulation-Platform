import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0017_courseaiuseridentity"),
    ]

    operations = [
        migrations.CreateModel(
            name="PostAnalyticsSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("totals", models.JSONField(blank=True, default=dict)),
                ("sentiment_counts", models.JSONField(blank=True, default=dict)),
                ("sentiment_percentages", models.JSONField(blank=True, default=dict)),
                ("range_start", models.DateField()),
                ("range_end", models.DateField()),
                ("range_days", models.PositiveIntegerField(default=7)),
                ("calculated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="post_analytics_snapshots", to="core.course")),
                ("post", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="analytics_snapshot", to="core.coursepost")),
            ],
            options={
                "ordering": ["-calculated_at"],
            },
        ),
    ]
