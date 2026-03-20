from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from core.models import Task, User, Workspace, WorkspaceMembership


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Admin UI for the custom user model."""

    pass


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ("name", "created_by", "created_at")
    search_fields = ("name", "created_by__username")


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(admin.ModelAdmin):
    list_display = ("workspace", "user", "role", "joined_at")
    list_filter = ("role",)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "workspace",
        "assignee",
        "created_by",
        "status",
        "priority",
        "created_at",
        "due_date",
    )
    list_filter = ("status", "priority", "workspace")
    search_fields = ("title", "workspace__name", "assignee__username")
