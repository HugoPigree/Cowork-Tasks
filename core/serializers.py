"""
DRF serializers — validation errors surface as HTTP 400 with field details.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from core.models import Task, Workspace, WorkspaceMembership

User = get_user_model()


class UserBriefSerializer(serializers.ModelSerializer):
    """Minimal user for nested task/workspace payloads."""

    class Meta:
        model = User
        fields = ("id", "username")


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Register a new user with a validated password (Django validators)."""

    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "password_confirm")
        extra_kwargs = {
            "email": {"required": True},
        }

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
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


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


class TaskSerializer(serializers.ModelSerializer):
    """Task in a workspace with assignee; workspace writable only on create."""

    created_by = UserBriefSerializer(read_only=True)
    assignee = UserBriefSerializer(read_only=True, allow_null=True)
    assignee_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
    )
    workspace = serializers.PrimaryKeyRelatedField(
        queryset=Workspace.objects.all(),
    )

    class Meta:
        model = Task
        fields = (
            "id",
            "workspace",
            "title",
            "description",
            "status",
            "priority",
            "created_at",
            "due_date",
            "created_by",
            "assignee",
            "assignee_id",
        )
        read_only_fields = ("id", "created_at", "created_by", "assignee")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["workspace"].queryset = Workspace.objects.filter(
                memberships__user=request.user
            ).distinct()
        if self.instance is not None:
            self.fields["workspace"].read_only = True

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
        return attrs

    def create(self, validated_data):
        assignee_id = validated_data.pop("assignee_id", None)
        request = self.context.get("request")
        user = request.user if request else None
        task = Task.objects.create(
            **validated_data,
            created_by=user,
            assignee_id=assignee_id,
        )
        return task

    def update(self, instance, validated_data):
        assignee_id = validated_data.pop("assignee_id", serializers.empty)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if assignee_id is not serializers.empty:
            instance.assignee_id = assignee_id
        instance.save()
        return instance
