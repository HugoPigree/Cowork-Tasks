"""URL routes for the public API (mounted under `/api/`)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from core.views import (
    HealthView,
    LoginView,
    MeView,
    ObjectiveGenerateView,
    ObjectiveListView,
    RegisterView,
    TaskViewSet,
    WorkspaceViewSet,
)

router = DefaultRouter()
router.register("workspaces", WorkspaceViewSet, basename="workspace")
router.register("tasks", TaskViewSet, basename="task")

# Explicit sprint routes (registered before the router) so `/api/workspaces/<id>/sprints/`
# always resolves even if a deployed DRF router build omits custom @action URLs.
_workspace_sprints = WorkspaceViewSet.as_view({"get": "sprints", "post": "sprints"})
_workspace_sprint_destroy = WorkspaceViewSet.as_view({"delete": "sprint_destroy"})

urlpatterns = [
    path("health/", HealthView.as_view(), name="api-health"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("objectives/", ObjectiveListView.as_view(), name="objectives-list"),
    path(
        "objectives/generate/",
        ObjectiveGenerateView.as_view(),
        name="objectives-generate",
    ),
    path("workspaces/<int:pk>/sprints/", _workspace_sprints, name="workspace-sprints"),
    path(
        "workspaces/<int:pk>/sprints/<int:sprint_id>/",
        _workspace_sprint_destroy,
        name="workspace-sprint-destroy",
    ),
    path("", include(router.urls)),
]
