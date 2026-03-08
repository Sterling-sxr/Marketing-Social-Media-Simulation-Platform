from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="MediaAsset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="uploads/")),
                ("original_name", models.CharField(max_length=255)),
                ("content_type", models.CharField(blank=True, max_length=128)),
                ("size", models.BigIntegerField()),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-uploaded_at"]},
        ),
    ]
