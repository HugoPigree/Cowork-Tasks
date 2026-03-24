"""
Root URL configuration — includes API routes under `/api/`.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import RedirectView
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
]

_base = getattr(settings, "FRONTEND_ORIGIN", "") or ""
if _base:
    origin = _base.rstrip("/")
    urlpatterns += [
        path("", RedirectView.as_view(url=f"{origin}/", permanent=False)),
        path("login", RedirectView.as_view(url=f"{origin}/login", permanent=False)),
        path("login/", RedirectView.as_view(url=f"{origin}/login", permanent=False)),
        path("register", RedirectView.as_view(url=f"{origin}/register", permanent=False)),
        path(
            "register/",
            RedirectView.as_view(url=f"{origin}/register", permanent=False),
        ),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif getattr(settings, "SERVE_MEDIA_THROUGH_DJANGO", False):
    # Small deployments only — prefer nginx (or object storage) for user uploads at scale.
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]
