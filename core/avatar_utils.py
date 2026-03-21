"""Resolve user avatar URL for API responses (uploaded file or external URL)."""


def user_avatar_absolute_url(user, request=None) -> str:
    if getattr(user, "avatar", None) and user.avatar:
        url = user.avatar.url
        if request and str(url).startswith("/"):
            return request.build_absolute_uri(url)
        return str(url)
    if getattr(user, "avatar_url", None) and user.avatar_url:
        return str(user.avatar_url)
    return ""
