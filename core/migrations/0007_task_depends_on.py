from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_clear_column_wip_limits"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="depends_on",
            field=models.ManyToManyField(
                blank=True,
                help_text="Tasks that must be Done before this one can close.",
                related_name="dependents",
                to="core.task",
            ),
        ),
    ]
