from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_task_depends_on"),
    ]

    operations = [
        migrations.AddField(
            model_name="workspace",
            name="github_url",
            field=models.URLField(blank=True, default="", max_length=500),
        ),
    ]
