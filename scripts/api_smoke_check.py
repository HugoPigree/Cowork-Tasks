"""Manual API smoke test against a running server (default http://127.0.0.1:8000/api)."""
import json
import os
import sys
import urllib.error
import urllib.request
from uuid import uuid4


def req(method, url, data=None, headers=None):
    h = {"Accept": "application/json", **(headers or {})}
    body = None
    if data is not None:
        raw = json.dumps(data).encode("utf-8")
        body = raw
        h.setdefault("Content-Type", "application/json")
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            text = resp.read().decode("utf-8")
            return resp.status, json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        try:
            payload = json.loads(text) if text else None
        except json.JSONDecodeError:
            payload = text
        return e.code, payload


def main():
    base = os.environ.get("API_BASE", "http://127.0.0.1:8000/api").rstrip("/")
    results = []
    u = f"smoke_{uuid4().hex[:8]}"
    pw = "SmokeTestPass123!"

    def check(name, ok, detail=""):
        results.append((name, ok, detail))
        sym = "OK" if ok else "FAIL"
        print(f"[{sym}] {name}" + (f" | {detail}" if detail else ""))

    code, _ = req("GET", f"{base}/health/", headers={"Accept": "text/html"})
    check("GET /api/health/", code == 200, f"HTTP {code}")

    code, _ = req(
        "POST",
        f"{base}/auth/register/",
        {
            "username": u,
            "email": f"{u}@example.com",
            "password": pw,
            "password_confirm": pw,
        },
    )
    check("POST /api/auth/register/", code == 201, f"HTTP {code}")

    code, body = req("POST", f"{base}/auth/login/", {"username": u, "password": pw})
    ok_login = code == 200 and isinstance(body, dict) and "access" in body
    check("POST /api/auth/login/", ok_login, f"HTTP {code}")
    if not ok_login:
        sys.exit(1)
    access = body["access"]
    refresh = body["refresh"]
    auth = {"Authorization": f"Bearer {access}"}

    code, wlist = req("GET", f"{base}/workspaces/", headers=auth)
    ws_id = None
    if isinstance(wlist, list) and wlist:
        ws_id = wlist[0].get("id")
    check("GET /api/workspaces/", code == 200 and ws_id is not None, f"HTTP {code}, ws={ws_id}")

    code, _ = req("GET", f"{base}/tasks/")
    check("GET /api/tasks/ sans JWT -> 401", code == 401, f"HTTP {code}")

    code, body = req("GET", f"{base}/tasks/?workspace={ws_id}", headers=auth)
    check("GET /api/tasks/?workspace=", code == 200, f"HTTP {code}")

    code, body = req(
        "POST",
        f"{base}/tasks/",
        {
            "workspace": ws_id,
            "title": "Smoke task",
            "description": "api_smoke_check",
            "status": "todo",
            "priority": "high",
        },
        headers=auth,
    )
    tid = body.get("id") if isinstance(body, dict) else None
    check("POST /api/tasks/", code == 201 and tid is not None, f"HTTP {code}, id={tid}")

    code, body = req(
        "GET",
        f"{base}/tasks/?workspace={ws_id}&status=todo&priority=high&ordering=-priority",
        headers=auth,
    )
    cnt = body.get("count") if isinstance(body, dict) else None
    check("GET tasks filtre+tri", code == 200 and cnt is not None, f"HTTP {code}, count={cnt}")

    code, body = req(
        "PATCH",
        f"{base}/tasks/{tid}/",
        {"status": "done"},
        headers=auth,
    )
    st = body.get("status") if isinstance(body, dict) else None
    check("PATCH /api/tasks/{id}/", code == 200 and st == "done", f"HTTP {code}")

    u2 = f"smoke2_{uuid4().hex[:8]}"
    req(
        "POST",
        f"{base}/auth/register/",
        {
            "username": u2,
            "email": f"{u2}@example.com",
            "password": pw,
            "password_confirm": pw,
        },
    )
    code, body = req("POST", f"{base}/auth/login/", {"username": u2, "password": pw})
    access2 = body.get("access") if isinstance(body, dict) else None
    code, _ = req("GET", f"{base}/tasks/{tid}/", headers={"Authorization": f"Bearer {access2}"})
    check("GET task non-membre -> 404", code == 404, f"HTTP {code}")

    code, _ = req("DELETE", f"{base}/tasks/{tid}/", headers=auth)
    check("DELETE /api/tasks/{id}/ -> 204", code == 204, f"HTTP {code}")

    code, body = req("POST", f"{base}/auth/token/refresh/", {"refresh": refresh})
    check("POST /api/auth/token/refresh/", code == 200 and "access" in (body or {}), f"HTTP {code}")

    code, _ = req("POST", f"{base}/tasks/", {"workspace": ws_id}, headers=auth)
    check("POST /api/tasks/ sans titre -> 400", code == 400, f"HTTP {code}")

    failed = [n for n, ok, _ in results if not ok]
    print()
    print("Resume:", len(results) - len(failed), "/", len(results), "OK")
    if failed:
        print("Echecs:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
