"""
API views — workspaces (coworking), tasks with assignees, ordering & filters.
"""
from django.db.models import Case, IntegerField, Value, When
from django.http import JsonResponse
from django.views import View
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from core.models import Task, User, Workspace, WorkspaceMembership
from core.permissions import (
    IsTaskWorkspaceMember,
    IsWorkspaceMember,
    IsWorkspaceOwner,
)
from core.serializers import (
    AddWorkspaceMemberSerializer,
    TaskSerializer,
    UserRegistrationSerializer,
    WorkspaceMemberSerializer,
    WorkspaceSerializer,
)


class HealthView(View):
    """GET /api/health/ — public JSON smoke test."""

    def get(self, request, *args, **kwargs):
        return JsonResponse({"status": "ok"})


class RegisterView(APIView):
    """POST /api/auth/register/"""

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        ws = Workspace.objects.create(
            name=f"Espace de {user.username}",
            description="Votre espace personnel — invitez des coéquipiers depuis la page Espaces.",
            created_by=user,
        )
        WorkspaceMembership.objects.create(
            workspace=ws,
            user=user,
            role=WorkspaceMembership.Role.OWNER,
        )
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "message": "User registered successfully. Use /api/auth/login/ to obtain tokens.",
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    """POST /api/auth/login/"""

    permission_classes = [AllowAny]


class WorkspaceViewSet(viewsets.ModelViewSet):
    """
    List/create workspaces the user belongs to.
    Owners can add/remove members.
    """

    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]
    pagination_class = None

    def get_queryset(self):
        return (
            Workspace.objects.filter(memberships__user=self.request.user)
            .distinct()
            .select_related("created_by")
        )

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        if self.action == "list":
            return [IsAuthenticated()]
        if self.action == "retrieve":
            return [IsAuthenticated(), IsWorkspaceMember()]
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsWorkspaceOwner()]
        if self.action == "members":
            return [IsAuthenticated(), IsWorkspaceMember()]
        if self.action == "add_member":
            return [IsAuthenticated(), IsWorkspaceOwner()]
        if self.action == "remove_member":
            return [IsAuthenticated(), IsWorkspaceOwner()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        ws = serializer.save(created_by=self.request.user)
        WorkspaceMembership.objects.create(
            workspace=ws,
            user=self.request.user,
            role=WorkspaceMembership.Role.OWNER,
        )

    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        workspace = self.get_object()
        qs = workspace.memberships.select_related("user").order_by("joined_at")
        return Response(WorkspaceMemberSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsWorkspaceOwner])
    def add_member(self, request, pk=None):
        workspace = self.get_object()
        ser = AddWorkspaceMemberSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        username = ser.validated_data["username"]
        user = User.objects.get(username__iexact=username)
        if user.id == request.user.id:
            return Response(
                {"detail": "You are already in this workspace."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        m, created = WorkspaceMembership.objects.get_or_create(
            workspace=workspace,
            user=user,
            defaults={"role": WorkspaceMembership.Role.MEMBER},
        )
        if not created:
            return Response(
                {"detail": "User is already a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            WorkspaceMemberSerializer(m).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"members/(?P<user_id>\d+)",
        permission_classes=[IsAuthenticated, IsWorkspaceOwner],
    )
    def remove_member(self, request, pk=None, user_id=None):
        workspace = self.get_object()
        target_id = int(user_id)
        if target_id == request.user.id:
            return Response(
                {"detail": "Owners cannot remove themselves this way; transfer ownership first (not implemented)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deleted, _ = WorkspaceMembership.objects.filter(
            workspace=workspace,
            user_id=target_id,
        ).exclude(role=WorkspaceMembership.Role.OWNER).delete()
        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _task_priority_order():
    return Case(
        When(priority=Task.Priority.HIGH, then=Value(3)),
        When(priority=Task.Priority.MEDIUM, then=Value(2)),
        When(priority=Task.Priority.LOW, then=Value(1)),
        default=Value(0),
        output_field=IntegerField(),
    )


class TaskViewSet(viewsets.ModelViewSet):
    """
    Tasks in workspaces the user belongs to.

    Query params:
    - workspace: filter by workspace id (recommended)
    - status, priority: filters
    - assignee: user id, or "unassigned"
    - ordering: -priority (default), priority, due_date, -due_date, created_at, -created_at
    """

    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsTaskWorkspaceMember]

    def get_queryset(self):
        qs = (
            Task.objects.filter(workspace__memberships__user=self.request.user)
            .distinct()
            .select_related("workspace", "created_by", "assignee")
        )

        workspace_id = self.request.query_params.get("workspace")
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)

        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)

        pr = self.request.query_params.get("priority")
        if pr:
            qs = qs.filter(priority=pr)

        assignee = self.request.query_params.get("assignee")
        if assignee == "unassigned" or assignee == "none":
            qs = qs.filter(assignee__isnull=True)
        elif assignee:
            qs = qs.filter(assignee_id=assignee)

        qs = qs.annotate(_priority_rank=_task_priority_order())
        ordering = self.request.query_params.get("ordering", "-priority")
        if ordering == "-priority":
            qs = qs.order_by("-_priority_rank", "due_date", "-created_at")
        elif ordering == "priority":
            qs = qs.order_by("_priority_rank", "due_date", "-created_at")
        elif ordering == "due_date":
            qs = qs.order_by("due_date", "-_priority_rank", "-created_at")
        elif ordering == "-due_date":
            qs = qs.order_by("-due_date", "-_priority_rank", "-created_at")
        elif ordering == "created_at":
            qs = qs.order_by("created_at")
        elif ordering == "-created_at":
            qs = qs.order_by("-created_at")
        else:
            qs = qs.order_by("-_priority_rank", "due_date", "-created_at")

        return qs
