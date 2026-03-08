from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_coursepost"),
    ]

    operations = [
        migrations.AddField(
            model_name="coursepost",
            name="hashtags",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="coursepost",
            name="mentions",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.CreateModel(
            name="CoursePostAttachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("asset", models.ForeignKey(on_delete=models.CASCADE, related_name="post_attachments", to="core.mediaasset")),
                ("post", models.ForeignKey(on_delete=models.CASCADE, related_name="attachments", to="core.coursepost")),
            ],
            options={"ordering": ["id"]},
        ),
    ]
