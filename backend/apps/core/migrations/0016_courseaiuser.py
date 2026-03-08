import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0015_coursehashtagdashboardsnapshot_coursestudentdashboardsnapshot"),
    ]

    operations = [
        migrations.CreateModel(
            name="CourseAIUser",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("username", models.CharField(max_length=64)),
                ("display_name", models.CharField(blank=True, max_length=120)),
                ("gender", models.CharField(blank=True, max_length=32)),
                ("city", models.CharField(blank=True, max_length=64)),
                ("age_group", models.CharField(blank=True, max_length=32)),
                ("education_level", models.CharField(blank=True, max_length=64)),
                ("income_level", models.CharField(blank=True, max_length=64)),
                ("social_value", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("sociability", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("openness", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("content_preference", models.CharField(blank=True, max_length=64)),
                ("interests", models.JSONField(blank=True, default=list)),
                ("shopping_frequency", models.CharField(blank=True, max_length=64)),
                ("buying_behavior", models.CharField(blank=True, max_length=64)),
                ("decision_factor", models.CharField(blank=True, max_length=64)),
                ("shopping_preference", models.CharField(blank=True, max_length=64)),
                ("digital_time", models.CharField(blank=True, max_length=64)),
                ("interaction_style", models.CharField(blank=True, max_length=64)),
                ("influencer_type", models.CharField(blank=True, max_length=64)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("course", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="ai_users",
                    to="core.course",
                )),
                ("created_by", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="created_ai_users",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ["username"],
                "unique_together": {("course", "username")},
            },
        ),
    ]
