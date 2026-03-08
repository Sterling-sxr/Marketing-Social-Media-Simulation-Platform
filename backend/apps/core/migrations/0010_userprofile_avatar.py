from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_coursepostcomment"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="avatar_url",
            field=models.TextField(blank=True),
        ),
    ]


