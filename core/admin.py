from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from core.models import (
    Board,
    BoardColumn,
    Sprint,
    Task,
    TaskComment,
    User,
    Workspace,
    WorkspaceMembership,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Admin UI for the custom user model."""

    pass


class BoardColumnInline(admin.TabularInline):
    model = BoardColumn
    extra = 0


@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ("id", "workspace", "created_at")
    inlines = [BoardColumnInline]


@admin.register(BoardColumn)
class BoardColumnAdmin(admin.ModelAdmin):
    list_display = ("name", "board", "position", "maps_to_status", "wip_limit")
    list_filter = ("maps_to_status",)


@admin.register(Sprint)
class SprintAdmin(admin.ModelAdmin):
    list_display = ("name", "workspace", "color", "created_at")
    list_filter = ("workspace",)


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
        "sprint",
        "parent",
        "assignee",
        "created_by",
        "status",
        "priority",
        "position",
        "created_at",
        "due_date",
    )
    list_filter = ("status", "priority", "workspace", "sprint")
    search_fields = ("title", "workspace__name", "assignee__username")


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = ("task", "author", "created_at")
    search_fields = ("body", "author__username")
