from django.conf import settings
from django.db import migrations, models


def copy_user_profiles_into_courses(apps, schema_editor):
    UserProfile = apps.get_model("core", "UserProfile")
    CourseMember = apps.get_model("core", "CourseMember")
    CourseProfile = apps.get_model("core", "CourseProfile")
    db_alias = schema_editor.connection.alias

    profiles = UserProfile.objects.using(db_alias).all()
    for profile in profiles:
        memberships = CourseMember.objects.using(db_alias).filter(user_id=profile.user_id)
        for membership in memberships:
            CourseProfile.objects.using(db_alias).update_or_create(
                user_id=membership.user_id,
                course_id=membership.course_id,
                defaults={
                    "avatar_url": profile.avatar_url,
                    "gender": profile.gender,
                    "city": profile.city,
                    "age_group": profile.age_group,
                    "education_level": profile.education_level,
                    "income_level": profile.income_level,
                    "social_value": profile.social_value,
                    "interests": profile.interests,
                    "sociability": profile.sociability,
                    "openness": profile.openness,
                    "shopping_frequency": profile.shopping_frequency,
                    "buying_behavior": profile.buying_behavior,
                    "decision_factor": profile.decision_factor,
                    "shopping_preference": profile.shopping_preference,
                    "digital_time": profile.digital_time,
                    "content_preference": profile.content_preference,
                    "interaction_style": profile.interaction_style,
                    "influencer_type": profile.influencer_type,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0018_postanalyticssnapshot"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CourseProfile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("avatar_url", models.TextField(blank=True)),
                ("gender", models.CharField(blank=True, max_length=32)),
                ("city", models.CharField(blank=True, max_length=64)),
                ("age_group", models.CharField(blank=True, max_length=32)),
                ("education_level", models.CharField(blank=True, max_length=64)),
                ("income_level", models.CharField(blank=True, max_length=64)),
                ("social_value", models.PositiveSmallIntegerField(default=5)),
                ("interests", models.JSONField(blank=True, default=list)),
                ("sociability", models.PositiveSmallIntegerField(default=5)),
                ("openness", models.PositiveSmallIntegerField(default=5)),
                ("shopping_frequency", models.CharField(blank=True, max_length=64)),
                ("buying_behavior", models.CharField(blank=True, max_length=64)),
                ("decision_factor", models.CharField(blank=True, max_length=64)),
                ("shopping_preference", models.CharField(blank=True, max_length=64)),
                ("digital_time", models.CharField(blank=True, max_length=64)),
                ("content_preference", models.CharField(blank=True, max_length=64)),
                ("interaction_style", models.CharField(blank=True, max_length=64)),
                ("influencer_type", models.CharField(blank=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "course",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="profiles",
                        to="core.course",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="course_profiles",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["course_id", "user_id"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="courseprofile",
            unique_together={("course", "user")},
        ),
        migrations.RunPython(copy_user_profiles_into_courses, migrations.RunPython.noop),
    ]
