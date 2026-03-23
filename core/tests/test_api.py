"""API tests — workspaces, tasks, assignees, ordering."""
import json

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from core.models import (
    Sprint,
    Task,
    Workspace,
    WorkspaceMembership,
    ensure_workspace_board,
)

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
    ensure_workspace_board(ws)
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
def test_register_with_avatar_url(api_client):
    payload = {
        "username": "charlie",
        "email": "charlie@example.com",
        "password": "strongpass123",
        "password_confirm": "strongpass123",
        "avatar_url": "https://api.dicebear.com/7.x/initials/svg?seed=Charlie",
    }
    r = api_client.post("/api/auth/register/", payload, format="json")
    assert r.status_code == status.HTTP_201_CREATED
    assert r.data.get("avatar") == payload["avatar_url"]
    u = User.objects.get(username="charlie")
    assert u.avatar_url == payload["avatar_url"]


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
    assert r.data.get("user") == {
        "id": user_a.id,
        "username": "alice",
        "avatar": "",
    }


@pytest.mark.django_db
def test_me_returns_current_user(api_client, user_a):
    api_client.force_authenticate(user=user_a)
    r = api_client.get("/api/auth/me/")
    assert r.status_code == status.HTTP_200_OK
    assert r.data == {"id": user_a.id, "username": "alice", "avatar": ""}


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
def test_workspace_admin_cannot_add_member_if_not_creator(
    api_client, user_a, user_b, workspace_a
):
    WorkspaceMembership.objects.create(
        workspace=workspace_a,
        user=user_b,
        role=WorkspaceMembership.Role.ADMIN,
    )
    api_client.force_authenticate(user=user_b)
    r = api_client.post(
        f"/api/workspaces/{workspace_a.id}/add_member/",
        {"username": "alice"},
        format="json",
    )
    assert r.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_workspace_creator_can_patch_and_delete(
    api_client, user_a, user_b, workspace_a
):
    api_client.force_authenticate(user=user_a)
    r = api_client.patch(
        f"/api/workspaces/{workspace_a.id}/",
        {"name": "Renamed", "description": "New desc"},
        format="json",
    )
    assert r.status_code == status.HTTP_200_OK
    assert r.data["name"] == "Renamed"
    workspace_a.refresh_from_db()
    assert workspace_a.name == "Renamed"

    WorkspaceMembership.objects.create(
        workspace=workspace_a,
        user=user_b,
        role=WorkspaceMembership.Role.ADMIN,
    )
    api_client.force_authenticate(user=user_b)
    denied = api_client.patch(
        f"/api/workspaces/{workspace_a.id}/",
        {"name": "Hack"},
        format="json",
    )
    assert denied.status_code == status.HTTP_403_FORBIDDEN

    api_client.force_authenticate(user=user_a)
    delete_r = api_client.delete(f"/api/workspaces/{workspace_a.id}/")
    assert delete_r.status_code == status.HTTP_204_NO_CONTENT
    assert not Workspace.objects.filter(pk=workspace_a.id).exists()


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


@pytest.mark.django_db
def test_task_reorder_root_tasks(api_client, user_a, workspace_a):
    api_client.force_authenticate(user=user_a)
    done_col = (
        workspace_a.board.columns.filter(maps_to_status=Task.Status.DONE)
        .order_by("position")
        .first()
    )
    assert done_col is not None
    a = api_client.post(
        "/api/tasks/",
        {
            "workspace": workspace_a.id,
            "title": "A",
            "status": Task.Status.TODO,
            "priority": Task.Priority.MEDIUM,
        },
        format="json",
    )
    b = api_client.post(
        "/api/tasks/",
        {
            "workspace": workspace_a.id,
            "title": "B",
            "status": Task.Status.IN_PROGRESS,
            "priority": Task.Priority.MEDIUM,
        },
        format="json",
    )
    assert a.status_code == status.HTTP_201_CREATED
    assert b.status_code == status.HTTP_201_CREATED
    id_a, id_b = a.data["id"], b.data["id"]
    r = api_client.post(
        "/api/tasks/reorder/",
        {
            "workspace": workspace_a.id,
            "items": [
                {"id": id_a, "column_id": done_col.id, "position": 0},
                {"id": id_b, "column_id": done_col.id, "position": 1},
            ],
        },
        format="json",
    )
    assert r.status_code == status.HTTP_200_OK
    t1 = api_client.get(f"/api/tasks/{id_a}/")
    t2 = api_client.get(f"/api/tasks/{id_b}/")
    assert t1.data["status"] == Task.Status.DONE
    assert t2.data["status"] == Task.Status.DONE


@pytest.mark.django_db
def test_task_comments_list_and_create(api_client, user_a, workspace_a):
    api_client.force_authenticate(user=user_a)
    c = api_client.post(
        "/api/tasks/",
        {
            "workspace": workspace_a.id,
            "title": "Discuss",
            "status": Task.Status.TODO,
            "priority": Task.Priority.LOW,
        },
        format="json",
    )
    tid = c.data["id"]
    empty = api_client.get(f"/api/tasks/{tid}/comments/")
    assert empty.status_code == status.HTTP_200_OK
    assert empty.data == []
    post = api_client.post(
        f"/api/tasks/{tid}/comments/",
        {"body": "LGTM"},
        format="json",
    )
    assert post.status_code == status.HTTP_201_CREATED
    assert post.data["body"] == "LGTM"
    listed = api_client.get(f"/api/tasks/{tid}/comments/")
    assert len(listed.data) == 1


@pytest.mark.django_db
def test_objectives_list_authenticated(api_client, user_a):
    api_client.force_authenticate(user=user_a)
    r = api_client.get("/api/objectives/")
    assert r.status_code == status.HTTP_200_OK
    assert isinstance(r.data, list)
    assert len(r.data) >= 15
    assert "id" in r.data[0] and "title" in r.data[0] and "description" in r.data[0]


@pytest.mark.django_db
def test_objectives_list_requires_auth_401(api_client):
    r = api_client.get("/api/objectives/")
    assert r.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_objectives_generate_ok(api_client, user_a):
    api_client.force_authenticate(user=user_a)
    r = api_client.post(
        "/api/objectives/generate/",
        {"objective_id": "api_rest"},
        format="json",
    )
    assert r.status_code == status.HTTP_200_OK
    assert "suggestions" in r.data
    assert len(r.data["suggestions"]) >= 2
    assert "title" in r.data["suggestions"][0]
    assert "description" in r.data["suggestions"][0]


@pytest.mark.django_db
def test_objectives_generate_unknown_400(api_client, user_a):
    api_client.force_authenticate(user=user_a)
    r = api_client.post(
        "/api/objectives/generate/",
        {"objective_id": "nope"},
        format="json",
    )
    assert r.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_sprint_crud_and_task_filter(api_client, user_a, workspace_a):
    api_client.force_authenticate(user=user_a)
    empty = api_client.get(f"/api/workspaces/{workspace_a.id}/sprints/")
    assert empty.status_code == status.HTTP_200_OK
    assert empty.data == []

    create_sp = api_client.post(
        f"/api/workspaces/{workspace_a.id}/sprints/",
        {"name": "Sprint 1", "color": "#22c55e"},
        format="json",
    )
    assert create_sp.status_code == status.HTTP_201_CREATED
    sp_id = create_sp.data["id"]
    assert create_sp.data["name"] == "Sprint 1"

    task_r = api_client.post(
        "/api/tasks/",
        {
            "workspace": workspace_a.id,
            "title": "In sprint",
            "status": Task.Status.TODO,
            "priority": Task.Priority.MEDIUM,
            "sprint_id": sp_id,
        },
        format="json",
    )
    assert task_r.status_code == status.HTTP_201_CREATED
    tid = task_r.data["id"]
    assert task_r.data["sprint"]["id"] == sp_id

    list_all = api_client.get(
        "/api/tasks/",
        {"workspace": workspace_a.id, "root_only": "true", "page_size": 50},
    )
    assert list_all.status_code == status.HTTP_200_OK
    assert len(list_all.data["results"]) >= 1

    list_sp = api_client.get(
        "/api/tasks/",
        {
            "workspace": workspace_a.id,
            "root_only": "true",
            "page_size": 50,
            "sprint": str(sp_id),
        },
    )
    assert list_sp.status_code == status.HTTP_200_OK
    ids = [t["id"] for t in list_sp.data["results"]]
    assert tid in ids

    del_sp = api_client.delete(
        f"/api/workspaces/{workspace_a.id}/sprints/{sp_id}/",
    )
    assert del_sp.status_code == status.HTTP_204_NO_CONTENT
    assert not Sprint.objects.filter(pk=sp_id).exists()
    t = Task.objects.get(pk=tid)
    assert t.sprint_id is None
