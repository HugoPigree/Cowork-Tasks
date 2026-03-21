from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_workspace_github_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar",
            field=models.ImageField(blank=True, null=True, upload_to="avatars/"),
        ),
        migrations.AddField(
            model_name="user",
            name="avatar_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="External avatar URL (e.g. DiceBear) when no uploaded image.",
                max_length=500,
            ),
        ),
    ]
