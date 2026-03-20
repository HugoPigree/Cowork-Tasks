"""API tests — workspaces, tasks, assignees, ordering."""
import json

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Task, Workspace, WorkspaceMembership

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_a(db):
    return User.objects.create_user(
        username="alice",
        email="alice@example.com",
        password="secret12345",
    )


@pytest.fixture
def user_b(db):
    return User.objects.create_user(username="bob", password="secret12345")


@pytest.fixture
def workspace_a(user_a):
    ws = Workspace.objects.create(name="Alice WS", created_by=user_a)
    WorkspaceMembership.objects.create(
        workspace=ws,
        user=user_a,
        role=WorkspaceMembership.Role.OWNER,
    )
    return ws


@pytest.mark.django_db
def test_health_endpoint_public_ok(api_client):
    r = api_client.get("/api/health/")
    assert r.status_code == status.HTTP_200_OK
    assert json.loads(r.content) == {"status": "ok"}


@pytest.mark.django_db
def test_register_creates_user(api_client):
    payload = {
        "username": "newuser",
        "email": "new@example.com",
        "password": "strongpass123",
        "password_confirm": "strongpass123",
    }
    r = api_client.post("/api/auth/register/", payload, format="json")
    assert r.status_code == status.HTTP_201_CREATED
    assert User.objects.filter(username="newuser").exists()
    u = User.objects.get(username="newuser")
    assert Workspace.objects.filter(created_by=u).exists()
    assert WorkspaceMembership.objects.filter(user=u, role=WorkspaceMembership.Role.OWNER).exists()


@pytest.mark.django_db
def test_register_duplicate_username_returns_400(api_client, user_a):
    r = api_client.post(
        "/api/auth/register/",
        {
            "username": "alice",
            "email": "other@example.com",
            "password": "strongpass123",
            "password_confirm": "strongpass123",
        },
        format="json",
    )
    assert r.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_register_password_mismatch_returns_400(api_client):
    r = api_client.post(
        "/api/auth/register/",
        {
            "username": "u1",
            "email": "u1@example.com",
            "password": "strongpass123",
            "password_confirm": "different",
        },
        format="json",
    )
    assert r.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_login_returns_access_and_refresh(api_client, user_a):
    r = api_client.post(
        "/api/auth/login/",
        {"username": "alice", "password": "secret12345"},
        format="json",
    )
    assert r.status_code == status.HTTP_200_OK
    assert "access" in r.data
    assert "refresh" in r.data


@pytest.mark.django_db
def test_login_invalid_credentials_401(api_client, user_a):
    r = api_client.post(
        "/api/auth/login/",
        {"username": "alice", "password": "wrong"},
        format="json",
    )
    assert r.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_tasks_list_requires_auth_401(api_client):
    r = api_client.get("/api/tasks/")
    assert r.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_create_task_requires_workspace_400(api_client, user_a, workspace_a):
    api_client.force_authenticate(user=user_a)
    r = api_client.post("/api/tasks/", {}, format="json")
    assert r.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_task_crud_workspace_member(api_client, user_a, user_b, workspace_a):
    WorkspaceMembership.objects.create(
        workspace=workspace_a,
        user=user_b,
        role=WorkspaceMembership.Role.MEMBER,
    )
    api_client.force_authenticate(user=user_a)
    create = api_client.post(
        "/api/tasks/",
        {
            "workspace": workspace_a.id,
            "title": "Shared task",
            "description": "Desc",
            "status": Task.Status.TODO,
            "priority": Task.Priority.HIGH,
            "assignee_id": user_b.id,
        },
        format="json",
    )
    assert create.status_code == status.HTTP_201_CREATED
    task_id = create.data["id"]
    assert create.data["assignee"]["username"] == "bob"

    api_client.force_authenticate(user=user_b)
    ok = api_client.get(f"/api/tasks/{task_id}/")
    assert ok.status_code == status.HTTP_200_OK
    patch_ok = api_client.patch(
        f"/api/tasks/{task_id}/",
        {"status": Task.Status.DONE},
        format="json",
    )
    assert patch_ok.status_code == status.HTTP_200_OK

    api_client.force_authenticate(user=user_a)
    delete_ok = api_client.delete(f"/api/tasks/{task_id}/")
    assert delete_ok.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
def test_non_member_cannot_see_task(api_client, user_a, user_b, workspace_a):
    api_client.force_authenticate(user=user_a)
    create = api_client.post(
        "/api/tasks/",
        {
            "workspace": workspace_a.id,
            "title": "Private team",
            "status": Task.Status.TODO,
            "priority": Task.Priority.MEDIUM,
        },
        format="json",
    )
    task_id = create.data["id"]

    api_client.force_authenticate(user=user_b)
    r404 = api_client.get(f"/api/tasks/{task_id}/")
    assert r404.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_filter_tasks_and_ordering_priority(api_client, user_a, workspace_a):
    api_client.force_authenticate(user=user_a)
    api_client.post(
        "/api/tasks/",
        {
            "workspace": workspace_a.id,
            "title": "Low",
            "status": Task.Status.TODO,
            "priority": Task.Priority.LOW,
        },
        format="json",
    )
    api_client.post(
        "/api/tasks/",
        {
            "workspace": workspace_a.id,
            "title": "High",
            "status": Task.Status.TODO,
            "priority": Task.Priority.HIGH,
        },
        format="json",
    )
    r = api_client.get(
        f"/api/tasks/?workspace={workspace_a.id}&ordering=-priority",
    )
    assert r.status_code == status.HTTP_200_OK
    assert r.data["results"][0]["title"] == "High"
    assert r.data["results"][1]["title"] == "Low"


@pytest.mark.django_db
def test_filter_unassigned(api_client, user_a, workspace_a):
    api_client.force_authenticate(user=user_a)
    api_client.post(
        "/api/tasks/",
        {
            "workspace": workspace_a.id,
            "title": "No one",
            "priority": Task.Priority.MEDIUM,
        },
        format="json",
    )
    r = api_client.get(
        f"/api/tasks/?workspace={workspace_a.id}&assignee=unassigned",
    )
    assert r.status_code == status.HTTP_200_OK
    assert r.data["count"] == 1


@pytest.mark.django_db
def test_workspace_add_member(api_client, user_a, user_b, workspace_a):
    api_client.force_authenticate(user=user_a)
    r = api_client.post(
        f"/api/workspaces/{workspace_a.id}/add_member/",
        {"username": "bob"},
        format="json",
    )
    assert r.status_code == status.HTTP_201_CREATED
    assert WorkspaceMembership.objects.filter(
        workspace=workspace_a, user=user_b
    ).exists()


@pytest.mark.django_db
def test_tasks_pagination(api_client, user_a, workspace_a):
    api_client.force_authenticate(user=user_a)
    for i in range(15):
        api_client.post(
            "/api/tasks/",
            {
                "workspace": workspace_a.id,
                "title": f"Task {i}",
                "status": Task.Status.TODO,
                "priority": Task.Priority.MEDIUM,
            },
            format="json",
        )
    r = api_client.get(f"/api/tasks/?workspace={workspace_a.id}")
    assert r.status_code == status.HTTP_200_OK
    assert "next" in r.data
    assert r.data["next"] is not None
    assert len(r.data["results"]) <= 10
