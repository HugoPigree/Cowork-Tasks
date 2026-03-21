"""
Custom DRF permissions for workspaces and tasks.

Tasks are visible to any member of the task's workspace (coworking model).
Workspace creator can rename/delete the space and manage invites; board
columns may still be edited by owners/admins.
"""
from rest_framework.permissions import BasePermission

from core.models import WorkspaceMembership


class IsWorkspaceCreator(BasePermission):
    """The user created this workspace (`Workspace.created_by`)."""

    message = "Seul le créateur de l'espace peut effectuer cette action."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return getattr(obj, "created_by_id", None) == user.id


class IsWorkspaceMember(BasePermission):
    """The user belongs to this workspace (object is Workspace)."""

    message = "You are not a member of this workspace."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return WorkspaceMembership.objects.filter(workspace=obj, user=user).exists()


class IsWorkspaceOwner(BasePermission):
    """The user is owner of this workspace."""

    message = "Only a workspace owner can perform this action."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return WorkspaceMembership.objects.filter(
            workspace=obj,
            user=user,
            role=WorkspaceMembership.Role.OWNER,
        ).exists()


class IsWorkspaceOwnerOrAdmin(BasePermission):
    """Owner or admin — membership management and workspace settings (not delete workspace)."""

    message = "Only an owner or admin can perform this action."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return WorkspaceMembership.objects.filter(
            workspace=obj,
            user=user,
            role__in=(
                WorkspaceMembership.Role.OWNER,
                WorkspaceMembership.Role.ADMIN,
            ),
        ).exists()


class IsTaskWorkspaceMember(BasePermission):
    """The user is a member of the task's workspace."""

    message = "You do not have access to this task."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return WorkspaceMembership.objects.filter(
            workspace=obj.workspace,
            user=user,
        ).exists()
