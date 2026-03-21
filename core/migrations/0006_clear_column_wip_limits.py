# Les limites WIP restent optionnelles dans le modèle ; on les retire des colonnes
# existantes pour éviter un plafond involontaire (ex. 2 cartes max perçu comme un bug).

from django.db import migrations


def clear_wip_limits(apps, schema_editor):
    BoardColumn = apps.get_model("core", "BoardColumn")
    BoardColumn.objects.all().update(wip_limit=None)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0005_task_column_cascade"),
    ]

    operations = [
        migrations.RunPython(clear_wip_limits, migrations.RunPython.noop),
    ]
