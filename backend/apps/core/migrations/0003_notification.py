from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_mediaasset"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("recipient", models.CharField(db_index=True, max_length=64)),
                ("actor", models.CharField(max_length=64)),
                ("action", models.CharField(max_length=32)),
                ("subject", models.CharField(max_length=255)),
                ("body", models.TextField(blank=True)),
                ("link", models.URLField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
