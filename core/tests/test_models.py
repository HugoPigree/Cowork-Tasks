"""Unit tests for domain models."""
import pytest
from django.contrib.auth import get_user_model

from core.models import Task, Workspace, WorkspaceMembership, ensure_workspace_board

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="alice", password="testpass123")


@pytest.fixture
def workspace(user):
    ws = Workspace.objects.create(name="Team", created_by=user)
    WorkspaceMembership.objects.create(
        workspace=ws,
        user=user,
        role=WorkspaceMembership.Role.OWNER,
    )
    ensure_workspace_board(ws)
    return ws


@pytest.mark.django_db
def test_task_str_representation(user, workspace):
    col = workspace.board.columns.order_by("position").first()
    task = Task.objects.create(
        workspace=workspace,
        board_column=col,
        created_by=user,
        title="Buy milk",
        status=Task.Status.TODO,
        priority=Task.Priority.LOW,
    )
    assert "Buy milk" in str(task)
    assert str(workspace.id) in str(task)


@pytest.mark.django_db
def test_task_cascade_delete_when_workspace_removed(user, workspace):
    col = workspace.board.columns.order_by("position").first()
    Task.objects.create(
        workspace=workspace,
        board_column=col,
        created_by=user,
        title="Cascade me",
    )
    workspace.delete()
    assert Task.objects.count() == 0
