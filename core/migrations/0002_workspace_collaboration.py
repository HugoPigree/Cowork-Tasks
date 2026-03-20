# Generated manually — workspaces, memberships, task assignee/creator refactor.

from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models


def forwards_workspace_task(apps, schema_editor):
    User = apps.get_model("core", "User")
    Task = apps.get_model("core", "Task")
    Workspace = apps.get_model("core", "Workspace")
    WorkspaceMembership = apps.get_model("core", "WorkspaceMembership")

    user_workspace = {}
    for user in User.objects.all():
        ws = Workspace.objects.create(
            name=f"Espace de {user.username}",
            description="",
            created_by_id=user.id,
        )
        WorkspaceMembership.objects.create(
            workspace=ws,
            user_id=user.id,
            role="owner",
        )
        user_workspace[user.id] = ws.id

    for task in Task.objects.all():
        uid = task.user_id
        ws_id = user_workspace.get(uid)
        if ws_id is None:
            continue
        Task.objects.filter(pk=task.pk).update(
            workspace_id=ws_id,
            created_by_id=uid,
            assignee_id=uid,
        )


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Workspace",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="workspaces_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="WorkspaceMembership",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "role",
                    models.CharField(
                        choices=[("owner", "Owner"), ("member", "Member")],
                        default="member",
                        max_length=20,
                    ),
                ),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="workspace_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="core.workspace",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="workspacemembership",
            constraint=models.UniqueConstraint(
                fields=("workspace", "user"),
                name="uniq_workspace_user_membership",
            ),
        ),
        migrations.AddIndex(
            model_name="workspacemembership",
            index=models.Index(
                fields=["workspace", "user"],
                name="core_workspa_workspa_idx",
            ),
        ),
        migrations.RemoveIndex(
            model_name="task",
            name="core_task_user_id_0440f1_idx",
        ),
        migrations.RemoveIndex(
            model_name="task",
            name="core_task_user_id_b7b7b4_idx",
        ),
        migrations.AddField(
            model_name="task",
            name="assignee",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tasks_assigned",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="task",
            name="created_by",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tasks_created",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="task",
            name="workspace",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tasks",
                to="core.workspace",
            ),
        ),
        migrations.RunPython(forwards_workspace_task, backwards_noop),
        migrations.RemoveField(
            model_name="task",
            name="user",
        ),
        migrations.AlterField(
            model_name="task",
            name="workspace",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tasks",
                to="core.workspace",
            ),
        ),
        migrations.AlterField(
            model_name="task",
            name="created_by",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tasks_created",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddIndex(
            model_name="task",
            index=models.Index(
                fields=["workspace", "status"],
                name="core_task_workspa_status_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="task",
            index=models.Index(
                fields=["workspace", "priority"],
                name="core_task_workspa_priorit_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="task",
            index=models.Index(
                fields=["workspace", "assignee"],
                name="core_task_workspa_assigne_idx",
            ),
        ),
    ]
