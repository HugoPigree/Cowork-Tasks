"""
Custom DRF permissions for workspaces and tasks.

Tasks are visible to any member of the task's workspace (coworking model).
Only workspace owners can add/remove members.
"""
from rest_framework.permissions import BasePermission

from core.models import WorkspaceMembership


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
