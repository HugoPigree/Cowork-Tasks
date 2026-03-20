"""URL routes for the public API (mounted under `/api/`)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from core.views import HealthView, LoginView, RegisterView, TaskViewSet, WorkspaceViewSet

router = DefaultRouter()
router.register("workspaces", WorkspaceViewSet, basename="workspace")
router.register("tasks", TaskViewSet, basename="task")

urlpatterns = [
    path("health/", HealthView.as_view(), name="api-health"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("", include(router.urls)),
]
