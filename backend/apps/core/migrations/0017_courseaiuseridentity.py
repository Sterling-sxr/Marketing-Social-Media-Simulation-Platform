import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0016_courseaiuser"),
    ]

    operations = [
        migrations.CreateModel(
            name="CourseAIUserIdentity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("ai_user", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="identity",
                    to="core.courseaiuser",
                )),
                ("user", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="ai_user_identity",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ["ai_user_id"],
            },
        ),
    ]
