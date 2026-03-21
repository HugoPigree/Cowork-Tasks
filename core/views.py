"""
API views — workspaces (coworking), tasks with assignees, ordering & filters.
"""
from django.db import transaction
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.http import JsonResponse
from django.views import View
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from core.avatar_utils import user_avatar_absolute_url
from core.models import (
    BoardColumn,
    Task,
    TaskComment,
    User,
    Workspace,
    WorkspaceMembership,
    ensure_workspace_board,
    first_column_for_status,
    task_is_blocked,
)
from core.permissions import (
    IsTaskWorkspaceMember,
    IsWorkspaceCreator,
    IsWorkspaceMember,
    IsWorkspaceOwnerOrAdmin,
)
from core.serializers import (
    AddWorkspaceMemberSerializer,
    AppTokenObtainPairSerializer,
    BoardColumnBriefSerializer,
    BoardColumnStateSerializer,
    BoardColumnWriteSerializer,
    TaskCommentCreateSerializer,
    TaskCommentSerializer,
    ObjectiveGenerateSerializer,
    TaskReorderSerializer,
    TaskSerializer,
    UserRegistrationSerializer,
    WorkspaceMemberSerializer,
    WorkspaceSerializer,
)
from core.objectives_data import list_objectives_public, objective_by_id


class HealthView(View):
    """GET /api/health/ — public JSON smoke test."""

    def get(self, request, *args, **kwargs):
        return JsonResponse({"status": "ok"})


class RegisterView(APIView):
    """POST /api/auth/register/ — JSON or multipart (optional avatar file)."""

    permission_classes = [AllowAny]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

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
        ensure_workspace_board(ws)
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "avatar": user_avatar_absolute_url(user, request),
                "message": "User registered successfully. Use /api/auth/login/ to obtain tokens.",
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    """POST /api/auth/login/"""

    permission_classes = [AllowAny]
    serializer_class = AppTokenObtainPairSerializer


class MeView(APIView):
    """GET /api/auth/me/ — current user id (bootstrap when `user` missing from login)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response(
            {
                "id": u.pk,
                "username": u.username,
                "avatar": user_avatar_absolute_url(u, request),
            }
        )


class WorkspaceViewSet(viewsets.ModelViewSet):
    """
    List/create workspaces the user belongs to.
    Only the workspace creator can rename/delete it and invite/remove members.
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
        if self.action in ("update", "partial_update"):
            return [IsAuthenticated(), IsWorkspaceCreator()]
        if self.action == "destroy":
            return [IsAuthenticated(), IsWorkspaceCreator()]
        if self.action in ("members", "board"):
            return [IsAuthenticated(), IsWorkspaceMember()]
        if self.action == "add_member":
            return [IsAuthenticated(), IsWorkspaceCreator()]
        if self.action == "remove_member":
            return [IsAuthenticated(), IsWorkspaceCreator()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        ws = serializer.save(created_by=self.request.user)
        WorkspaceMembership.objects.create(
            workspace=ws,
            user=self.request.user,
            role=WorkspaceMembership.Role.OWNER,
        )
        ensure_workspace_board(ws)

    @action(detail=True, methods=["get"], url_path="board")
    def board(self, request, pk=None):
        workspace = self.get_object()
        board = ensure_workspace_board(workspace)
        columns = board.columns.annotate(
            task_count=Count("tasks", filter=Q(tasks__parent__isnull=True)),
        ).order_by("position", "id")
        return Response(
            {
                "id": board.id,
                "workspace": workspace.id,
                "created_at": board.created_at,
                "columns": BoardColumnStateSerializer(columns, many=True).data,
            }
        )

    @action(
        detail=True,
        methods=["post"],
        url_path=r"board/columns",
        permission_classes=[IsAuthenticated, IsWorkspaceOwnerOrAdmin],
    )
    def board_column_create(self, request, pk=None):
        workspace = self.get_object()
        board = ensure_workspace_board(workspace)
        ser = BoardColumnWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        col = BoardColumn.objects.create(board=board, **ser.validated_data)
        return Response(
            BoardColumnBriefSerializer(col).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch"],
        url_path=r"board/columns/(?P<col_id>\d+)",
        permission_classes=[IsAuthenticated, IsWorkspaceOwnerOrAdmin],
    )
    def board_column_update(self, request, pk=None, col_id=None):
        workspace = self.get_object()
        board = ensure_workspace_board(workspace)
        col = BoardColumn.objects.filter(pk=col_id, board=board).first()
        if not col:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ser = BoardColumnWriteSerializer(col, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(BoardColumnBriefSerializer(col).data)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"board/columns/(?P<col_id>\d+)",
        permission_classes=[IsAuthenticated, IsWorkspaceOwnerOrAdmin],
    )
    def board_column_delete(self, request, pk=None, col_id=None):
        workspace = self.get_object()
        board = ensure_workspace_board(workspace)
        col = BoardColumn.objects.filter(pk=col_id, board=board).first()
        if not col:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if col.tasks.exists():
            return Response(
                {"detail": "Move or delete tasks before removing this column."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        col.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=["post"],
        url_path="board/reorder_columns",
        permission_classes=[IsAuthenticated, IsWorkspaceOwnerOrAdmin],
    )
    def board_reorder_columns(self, request, pk=None):
        workspace = self.get_object()
        board = ensure_workspace_board(workspace)
        order = request.data.get("order")
        if not isinstance(order, list) or not order:
            return Response(
                {"detail": "`order` must be a non-empty list of column ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ids = [int(x) for x in order]
        existing = set(
            board.columns.filter(pk__in=ids).values_list("pk", flat=True)
        )
        if len(existing) != len(ids) or len(ids) != board.columns.count():
            return Response(
                {"detail": "Must include every column id exactly once."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            for pos, cid in enumerate(ids):
                BoardColumn.objects.filter(pk=cid, board=board).update(position=pos)
        columns = board.columns.order_by("position", "id")
        return Response(
            BoardColumnBriefSerializer(columns, many=True).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        workspace = self.get_object()
        qs = workspace.memberships.select_related("user").order_by("joined_at")
        return Response(WorkspaceMemberSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsWorkspaceCreator])
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
        permission_classes=[IsAuthenticated, IsWorkspaceCreator],
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


class TaskPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 200


class TaskViewSet(viewsets.ModelViewSet):
    """
    Tasks in workspaces the user belongs to.

    Query params:
    - workspace: filter by workspace id (recommended)
    - status, priority: filters
    - assignee: user id, or "unassigned"
    - search: case-insensitive title contains
    - root_only: true / 1 — hide subtasks (kanban root cards)
    - ordering: -priority (default), priority, due_date, -due_date, created_at, -created_at,
      position, kanban (status columns then position)
    - page_size: up to 200 (kanban)
    """

    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsTaskWorkspaceMember]
    pagination_class = TaskPagination

    def get_queryset(self):
        qs = (
            Task.objects.filter(workspace__memberships__user=self.request.user)
            .distinct()
            .select_related(
                "workspace",
                "created_by",
                "assignee",
                "board_column",
                "board_column__board",
            )
            .annotate(scount=Count("subtasks"))
        )

        workspace_id = self.request.query_params.get("workspace")
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)

        bcol = self.request.query_params.get("board_column")
        if bcol:
            qs = qs.filter(board_column_id=bcol)

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

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(title__icontains=search)

        root_only = self.request.query_params.get("root_only", "").lower()
        if root_only in ("1", "true", "yes"):
            qs = qs.filter(parent__isnull=True)

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
        elif ordering == "position":
            qs = qs.order_by("board_column__position", "position", "-created_at")
        elif ordering == "kanban":
            qs = qs.order_by("board_column__position", "position", "-created_at")
        else:
            qs = qs.order_by("-_priority_rank", "due_date", "-created_at")

        return qs.prefetch_related(
            "depends_on",
            "depends_on__board_column",
        )

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        """Batch update status/position for root tasks (drag & drop kanban)."""
        ser = TaskReorderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ws_id = ser.validated_data["workspace"]
        if not WorkspaceMembership.objects.filter(
            workspace_id=ws_id,
            user=request.user,
        ).exists():
            return Response(
                {"detail": "You are not a member of this workspace."},
                status=status.HTTP_403_FORBIDDEN,
            )
        items = ser.validated_data["items"]
        if not items:
            return Response({"updated": 0})

        ids = [i["id"] for i in items]
        tasks = list(
            Task.objects.filter(
                id__in=ids,
                workspace_id=ws_id,
                parent__isnull=True,
            ).prefetch_related("depends_on", "depends_on__board_column")
        )
        if len(tasks) != len(set(ids)):
            return Response(
                {"detail": "Invalid task ids, subtasks, or workspace mismatch."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        by_id = {t.id: t for t in tasks}
        ws = Workspace.objects.get(pk=ws_id)
        ensure_workspace_board(ws)
        with transaction.atomic():
            for item in items:
                t = by_id[item["id"]]
                if "column_id" in item:
                    col = BoardColumn.objects.get(
                        pk=item["column_id"],
                        board__workspace_id=ws_id,
                    )
                    if (
                        col.maps_to_status == Task.Status.DONE
                        and task_is_blocked(t)
                    ):
                        return Response(
                            {
                                "detail": "Cannot move a blocked task to Done until its dependencies are completed.",
                                "task_id": t.id,
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    t.board_column = col
                elif "status" in item and item["status"] is not None:
                    col = first_column_for_status(ws, item["status"])
                    if col:
                        t.board_column = col
                if "position" in item:
                    t.position = item["position"]
                t.save()
        return Response({"updated": len(items)})

    @action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        task = self.get_object()
        if request.method == "GET":
            qs = task.comments.select_related("author").order_by("created_at")
            return Response(TaskCommentSerializer(qs, many=True).data)
        cser = TaskCommentCreateSerializer(data=request.data)
        cser.is_valid(raise_exception=True)
        comment = TaskComment.objects.create(
            task=task,
            author=request.user,
            body=cser.validated_data["body"],
        )
        comment = TaskComment.objects.select_related("author").get(pk=comment.pk)
        return Response(
            TaskCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )


class ObjectiveListView(APIView):
    """GET /api/objectives/ — predefined objectives (no suggestions payload)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(list_objectives_public())


class ObjectiveGenerateView(APIView):
    """POST /api/objectives/generate/ — task suggestions for one objective."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = ObjectiveGenerateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = objective_by_id(ser.validated_data["objective_id"])
        return Response({"suggestions": obj["suggestions"]})
