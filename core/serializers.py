"""
DRF serializers — validation errors surface as HTTP 400 with field details.
"""
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Max
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from core.avatar_utils import user_avatar_absolute_url
from core.models import (
    Board,
    BoardColumn,
    Sprint,
    Task,
    TaskComment,
    Workspace,
    WorkspaceMembership,
    dependency_would_create_cycle,
    ensure_workspace_board,
    first_column_for_status,
    task_is_blocked,
)

User = get_user_model()

_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


class SprintSerializer(serializers.ModelSerializer):
    """Sprint CRUD payload (scoped to workspace via URL)."""

    class Meta:
        model = Sprint
        fields = ("id", "name", "color", "created_at")
        read_only_fields = ("id", "created_at")

    def validate_color(self, value):
        if not _HEX_COLOR.match((value or "").strip()):
            raise serializers.ValidationError(
                "Couleur hex sur 6 caractères requise (ex. #6366f1)."
            )
        return (value or "").strip()


class SprintBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sprint
        fields = ("id", "name", "color")


class UserBriefSerializer(serializers.ModelSerializer):
    """Minimal user for nested task/workspace payloads."""

    class Meta:
        model = User
        fields = ("id", "username", "first_name")


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Register a new user with a validated password (Django validators)."""

    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    avatar_url = serializers.URLField(
        required=False,
        allow_blank=True,
        max_length=500,
        help_text="Optional DiceBear or other HTTPS avatar URL.",
    )
    avatar = serializers.ImageField(
        required=False,
        allow_null=True,
        write_only=True,
        help_text="Optional uploaded image (takes precedence over avatar_url).",
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "password",
            "password_confirm",
            "avatar_url",
            "avatar",
        )
        extra_kwargs = {
            "email": {"required": True},
        }

    def validate_avatar(self, value):
        if value and value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Image too large (max 2 MB).")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        validate_password(attrs["password"])
        return attrs

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        avatar_file = validated_data.pop("avatar", None)
        avatar_url_val = (validated_data.pop("avatar_url", None) or "").strip()
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        if avatar_file:
            user.avatar_url = ""
        elif avatar_url_val:
            user.avatar_url = avatar_url_val
        user.save()
        if avatar_file:
            user.avatar.save(avatar_file.name, avatar_file, save=True)
        return user


class AppTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Access + refresh tokens and current user id (for client permissions)."""

    def validate(self, attrs):
        data = super().validate(attrs)
        request = self.context.get("request")
        data["user"] = {
            "id": self.user.pk,
            "username": self.user.get_username(),
            "avatar": user_avatar_absolute_url(self.user, request),
        }
        return data


class WorkspaceSerializer(serializers.ModelSerializer):
    """Workspace with member count and current user's role."""

    member_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = (
            "id",
            "name",
            "description",
            "github_url",
            "created_at",
            "created_by",
            "member_count",
            "my_role",
        )
        read_only_fields = ("id", "created_at", "created_by", "member_count", "my_role")

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        m = obj.memberships.filter(user=request.user).first()
        return m.role if m else None


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)

    class Meta:
        model = WorkspaceMembership
        fields = ("id", "user", "role", "joined_at")


class AddWorkspaceMemberSerializer(serializers.Serializer):
    """Add an existing user by username (owner only)."""

    username = serializers.CharField(max_length=150)

    def validate_username(self, value):
        if not User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("No user with this username.")
        return value


class BoardColumnBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoardColumn
        fields = (
            "id",
            "name",
            "position",
            "color",
            "wip_limit",
            "maps_to_status",
        )


class BoardColumnStateSerializer(BoardColumnBriefSerializer):
    """Column + root task count (Kanban header)."""

    task_count = serializers.IntegerField(read_only=True)

    class Meta(BoardColumnBriefSerializer.Meta):
        fields = BoardColumnBriefSerializer.Meta.fields + ("task_count",)


class BoardColumnWriteSerializer(serializers.ModelSerializer):
    """Create / update a column (owner/admin)."""

    class Meta:
        model = BoardColumn
        fields = ("name", "position", "wip_limit", "color", "maps_to_status")


class BoardDetailSerializer(serializers.ModelSerializer):
    columns = BoardColumnStateSerializer(many=True, read_only=True)

    class Meta:
        model = Board
        fields = ("id", "workspace", "created_at", "columns")
        read_only_fields = fields


class TaskDependsOnBriefSerializer(serializers.ModelSerializer):
    """Minimal task info for dependency lists (blockers)."""

    board_column = BoardColumnBriefSerializer(read_only=True)

    class Meta:
        model = Task
        fields = ("id", "title", "status", "board_column")


class TaskSerializer(serializers.ModelSerializer):
    """Task in a workspace with assignee; workspace writable only on create."""

    created_by = UserBriefSerializer(read_only=True)
    assignee = UserBriefSerializer(read_only=True, allow_null=True)
    sprint = SprintBriefSerializer(read_only=True, allow_null=True)
    sprint_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
    )
    assignee_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
    )
    parent_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
    )
    subtask_count = serializers.SerializerMethodField()
    board_column = BoardColumnBriefSerializer(read_only=True)
    board_column_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
    )
    workspace = serializers.PrimaryKeyRelatedField(
        queryset=Workspace.objects.all(),
    )
    depends_on = TaskDependsOnBriefSerializer(many=True, read_only=True)
    depends_on_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    is_blocked = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id",
            "workspace",
            "parent_id",
            "subtask_count",
            "board_column",
            "board_column_id",
            "sprint",
            "sprint_id",
            "depends_on",
            "depends_on_ids",
            "is_blocked",
            "title",
            "description",
            "status",
            "priority",
            "position",
            "estimate",
            "created_at",
            "due_date",
            "created_by",
            "assignee",
            "assignee_id",
        )
        read_only_fields = (
            "id",
            "created_at",
            "created_by",
            "assignee",
            "sprint",
            "subtask_count",
            "board_column",
            "depends_on",
            "is_blocked",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["workspace"].queryset = Workspace.objects.filter(
                memberships__user=request.user
            ).distinct()
        if self.instance is not None:
            self.fields["workspace"].read_only = True
            self.fields.pop("parent_id", None)

    def get_subtask_count(self, obj):
        if hasattr(obj, "scount"):
            return obj.scount
        return obj.subtasks.count()

    def get_is_blocked(self, obj):
        return task_is_blocked(obj)

    def _sync_depends_on(self, task, raw):
        if raw is None:
            return
        if not isinstance(raw, (list, tuple)):
            raise serializers.ValidationError(
                {"depends_on_ids": "Must be a list of task ids."}
            )
        ids = list(dict.fromkeys(int(x) for x in raw))
        ws = task.workspace_id
        qs = Task.objects.filter(pk__in=ids, workspace_id=ws, parent__isnull=True)
        found = {t.pk for t in qs}
        if set(ids) != found:
            raise serializers.ValidationError(
                {
                    "depends_on_ids": "All tasks must exist, be root tasks, and belong to this workspace."
                }
            )
        if dependency_would_create_cycle(task.pk, ids):
            raise serializers.ValidationError(
                {"depends_on_ids": "This dependency would create a cycle."}
            )
        task.depends_on.set(ids)

    def validate(self, attrs):
        workspace = attrs.get("workspace")
        if workspace is None and self.instance is not None:
            workspace = self.instance.workspace

        assignee_id = attrs.get("assignee_id", serializers.empty)
        if assignee_id is serializers.empty:
            assignee_id = None if not self.partial else serializers.empty

        if assignee_id is not serializers.empty and assignee_id is not None and workspace:
            if not WorkspaceMembership.objects.filter(
                workspace=workspace, user_id=assignee_id
            ).exists():
                raise serializers.ValidationError(
                    {"assignee_id": "Assignee must be a member of this workspace."}
                )

        if "sprint_id" in attrs and workspace:
            sid = attrs["sprint_id"]
            if sid is not None and not Sprint.objects.filter(
                pk=sid, workspace_id=workspace.id
            ).exists():
                raise serializers.ValidationError(
                    {"sprint_id": "Sprint introuvable pour cet espace."}
                )

        parent_id = attrs.get("parent_id", serializers.empty)
        if parent_id is not serializers.empty and parent_id is not None and workspace:
            try:
                parent = Task.objects.get(pk=parent_id)
            except Task.DoesNotExist:
                raise serializers.ValidationError({"parent_id": "Parent task not found."})
            if parent.workspace_id != workspace.id:
                raise serializers.ValidationError(
                    {"parent_id": "Parent must belong to the same workspace."}
                )
            if self.instance and parent.pk == self.instance.pk:
                raise serializers.ValidationError({"parent_id": "A task cannot be its own parent."})

        bc_id = attrs.pop("board_column_id", serializers.empty)
        if bc_id is not serializers.empty and bc_id is not None and workspace:
            try:
                col = BoardColumn.objects.select_related("board").get(pk=bc_id)
            except BoardColumn.DoesNotExist:
                raise serializers.ValidationError({"board_column_id": "Invalid column."})
            if col.board.workspace_id != workspace.id:
                raise serializers.ValidationError(
                    {"board_column_id": "Column does not belong to this workspace."}
                )
            attrs["board_column"] = col

        status_val = attrs.get("status", serializers.empty)
        if (
            "board_column" not in attrs
            and status_val is not serializers.empty
            and status_val is not None
            and workspace
        ):
            ensure_workspace_board(workspace)
            col = first_column_for_status(workspace, status_val)
            if col:
                attrs["board_column"] = col

        bc = attrs.get("board_column")
        if bc is not None and workspace and bc.board.workspace_id != workspace.id:
            raise serializers.ValidationError(
                {"board_column_id": "Column does not belong to this workspace."}
            )

        if (
            bc is not None
            and self.instance is not None
            and bc.maps_to_status == Task.Status.DONE
            and task_is_blocked(self.instance)
        ):
            raise serializers.ValidationError(
                {
                    "board_column_id": "Cannot move to Done while this task has unfinished dependencies."
                }
            )

        return attrs

    def create(self, validated_data):
        assignee_id = validated_data.pop("assignee_id", None)
        parent_id = validated_data.pop("parent_id", None)
        validated_data.pop("board_column_id", None)
        request = self.context.get("request")
        user = request.user if request else None
        workspace = validated_data["workspace"]
        parent = None
        if parent_id is not None:
            parent = Task.objects.get(pk=parent_id)
            validated_data["parent"] = parent
            validated_data.setdefault("position", 0)
            if "board_column" not in validated_data and parent.board_column_id:
                validated_data["board_column"] = parent.board_column
        else:
            if "board_column" not in validated_data:
                ensure_workspace_board(workspace)
                st = validated_data.get("status", Task.Status.TODO)
                col = first_column_for_status(workspace, st)
                if not col:
                    raise serializers.ValidationError(
                        {"board_column_id": "No board column available for this workspace."}
                    )
                validated_data["board_column"] = col
            col = validated_data["board_column"]
            agg = Task.objects.filter(
                workspace=workspace,
                board_column=col,
                parent__isnull=True,
            ).aggregate(m=Max("position"))
            max_p = agg["m"]
            validated_data["position"] = 0 if max_p is None else max_p + 1

        task = Task.objects.create(
            **validated_data,
            created_by=user,
            assignee_id=assignee_id,
        )
        if "depends_on_ids" in self.initial_data:
            self._sync_depends_on(task, self.initial_data.get("depends_on_ids"))
        return task

    def update(self, instance, validated_data):
        assignee_id = validated_data.pop("assignee_id", serializers.empty)
        validated_data.pop("board_column_id", None)
        status_val = validated_data.pop("status", serializers.empty)
        if (
            status_val is not serializers.empty
            and status_val is not None
            and "board_column" not in validated_data
        ):
            ensure_workspace_board(instance.workspace)
            col = first_column_for_status(instance.workspace, status_val)
            if col:
                validated_data["board_column"] = col
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if assignee_id is not serializers.empty:
            instance.assignee_id = assignee_id
        instance.save()
        if "depends_on_ids" in self.initial_data:
            self._sync_depends_on(instance, self.initial_data.get("depends_on_ids"))
        return instance


class TaskCommentSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)

    class Meta:
        model = TaskComment
        fields = ("id", "body", "author", "created_at")
        read_only_fields = ("id", "author", "created_at")


class TaskCommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=4000, allow_blank=False)


class TaskReorderItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    column_id = serializers.IntegerField(required=False)
    position = serializers.IntegerField(min_value=0, required=False)
    status = serializers.ChoiceField(choices=Task.Status.choices, required=False)

    def validate(self, attrs):
        if (
            "position" not in attrs
            and "column_id" not in attrs
            and "status" not in attrs
        ):
            raise serializers.ValidationError(
                "Each item must include at least `position`, `column_id`, or `status`."
            )
        return attrs


class TaskReorderSerializer(serializers.Serializer):
    workspace = serializers.IntegerField()
    items = TaskReorderItemSerializer(many=True)


class ObjectiveGenerateSerializer(serializers.Serializer):
    objective_id = serializers.CharField(max_length=64)

    def validate_objective_id(self, value: str) -> str:
        from core.objectives_data import objective_by_id

        if objective_by_id(value.strip()) is None:
            raise serializers.ValidationError("Objectif inconnu.")
        return value.strip()
