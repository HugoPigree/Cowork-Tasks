"""
Domain models: users, collaborative workspaces, and tasks inside a workspace.

Tasks have a creator (`created_by`) and an optional assignee (`assignee`).
All workspace members can view and edit tasks (coworking); only owners manage membership.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Application user — JWT auth and workspace membership."""

    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    avatar_url = models.URLField(
        max_length=500,
        blank=True,
        default="",
        help_text="External avatar URL (e.g. DiceBear) when no uploaded image.",
    )

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"


class Workspace(models.Model):
    """A shared space for a team (project / groupe)."""

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    github_url = models.URLField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="workspaces_created",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class WorkspaceMembership(models.Model):
    """Links a user to a workspace with a role."""

    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="workspace_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MEMBER,
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "user"],
                name="uniq_workspace_user_membership",
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "user"]),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} @ {self.workspace_id} ({self.role})"


class Sprint(models.Model):
    """Time-boxed iteration (Scrum-style) within a workspace; tasks optionally belong to one sprint."""

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="sprints",
    )
    name = models.CharField(max_length=100)
    color = models.CharField(
        max_length=7,
        default="#6366f1",
        help_text="Hex color for UI badges (e.g. #6366f1).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["workspace", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} (ws={self.workspace_id})"


class Task(models.Model):
    """Task scoped to a workspace; assignee is optional (backlog / unassigned)."""

    class Status(models.TextChoices):
        TODO = "todo", "Todo"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Done"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    sprint = models.ForeignKey(
        Sprint,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subtasks",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="tasks_created",
    )
    assignee = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks_assigned",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TODO,
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    position = models.PositiveIntegerField(
        default=0,
        help_text="Order within the same workspace column (status) for root tasks.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateTimeField(null=True, blank=True)
    board_column = models.ForeignKey(
        "BoardColumn",
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    estimate = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Story points / rough estimate (e.g. 1–21).",
    )
    depends_on = models.ManyToManyField(
        "self",
        symmetrical=False,
        related_name="dependents",
        blank=True,
        help_text="Tasks that must be Done before this one can close.",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "status", "position"]),
            models.Index(fields=["workspace", "board_column", "position"]),
            models.Index(fields=["workspace", "priority"]),
            models.Index(fields=["workspace", "assignee"]),
            models.Index(fields=["workspace", "parent"]),
            models.Index(fields=["workspace", "sprint"]),
        ]

    def save(self, *args, **kwargs):
        if self.board_column_id:
            col = self.board_column
            if col and self.status != col.maps_to_status:
                self.status = col.maps_to_status
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.title} (ws={self.workspace_id})"


def dependency_would_create_cycle(dependent_pk: int, blocker_ids: list[int]) -> bool:
    """
    True if setting dependent's depends_on to include these blockers would create a cycle.
    A cycle exists if any blocker can reach dependent by following depends_on edges.
    """
    for bid in blocker_ids:
        if bid == dependent_pk:
            return True
        stack = [bid]
        seen: set[int] = set()
        while stack:
            tid = stack.pop()
            if tid == dependent_pk:
                return True
            if tid in seen:
                continue
            seen.add(tid)
            t = Task.objects.filter(pk=tid).prefetch_related("depends_on").first()
            if not t:
                continue
            for b in t.depends_on.all():
                stack.append(b.pk)
    return False


def task_is_blocked(task: Task) -> bool:
    """True if any dependency is not completed (column maps to done)."""
    return task.depends_on.exclude(
        board_column__maps_to_status=Task.Status.DONE,
    ).exists()


class Board(models.Model):
    """One kanban / project board per workspace (GitHub Projects style)."""

    workspace = models.OneToOneField(
        Workspace,
        on_delete=models.CASCADE,
        related_name="board",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Board #{self.pk} ({self.workspace_id})"


class BoardColumn(models.Model):
    """Custom column: name, WIP limit, color; maps to a coarse status for filters / legacy."""

    board = models.ForeignKey(
        Board,
        on_delete=models.CASCADE,
        related_name="columns",
    )
    name = models.CharField(max_length=100)
    position = models.PositiveIntegerField(default=0)
    wip_limit = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Max items in column (optional).",
    )
    color = models.CharField(
        max_length=7,
        default="#6b7280",
        help_text="Hex color for column header dot.",
    )
    maps_to_status = models.CharField(
        max_length=20,
        choices=Task.Status.choices,
        default=Task.Status.TODO,
        help_text="Coarse status used for API filters and task.status sync.",
    )

    class Meta:
        ordering = ["position", "id"]
        indexes = [
            models.Index(fields=["board", "position"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} (board {self.board_id})"


class TaskComment(models.Model):
    """Threaded discussion on a task (Linear / GitHub style)."""

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="task_comments",
    )
    body = models.TextField(max_length=4000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["task", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"Comment on task {self.task_id} by {self.author_id}"


DEFAULT_BOARD_COLUMN_SPECS = (
    ("Backlog", 0, Task.Status.TODO, "#22c55e"),
    ("Ready", 1, Task.Status.TODO, "#3b82f6"),
    ("In progress", 2, Task.Status.IN_PROGRESS, "#ca8a04"),
    ("In review", 3, Task.Status.IN_PROGRESS, "#9333ea"),
    ("Done", 4, Task.Status.DONE, "#ea580c"),
)


def seed_default_columns(board: Board) -> None:
    if board.columns.exists():
        return
    for name, pos, st, color in DEFAULT_BOARD_COLUMN_SPECS:
        BoardColumn.objects.create(
            board=board,
            name=name,
            position=pos,
            maps_to_status=st,
            color=color,
        )


def ensure_workspace_board(workspace: Workspace) -> Board:
    board, _ = Board.objects.get_or_create(workspace=workspace)
    seed_default_columns(board)
    return board


def first_column_for_status(workspace: Workspace, status: str) -> BoardColumn | None:
    try:
        board = workspace.board
    except Board.DoesNotExist:
        return None
    return (
        board.columns.filter(maps_to_status=status).order_by("position").first()
    )
