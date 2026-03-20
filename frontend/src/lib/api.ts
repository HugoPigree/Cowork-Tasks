import type {
  Paginated,
  Task,
  TaskOrdering,
  TaskPriority,
  TaskStatus,
  TokenResponse,
  Workspace,
  WorkspaceMember,
} from "./types"

const API_BASE = import.meta.env.VITE_API_BASE ?? ""

function buildUrl(path: string): string {
  if (path.startsWith("http")) return path
  const p = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE}${p}`
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(
      typeof body === "object" && body && "detail" in (body as object)
        ? String((body as { detail: unknown }).detail)
        : `HTTP ${status}`
    )
    this.status = status
    this.body = body
  }
}

function parseJson(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function tryRefresh(): Promise<boolean> {
  const refresh = localStorage.getItem("refresh")
  if (!refresh) return false
  const res = await fetch(buildUrl("/api/auth/token/refresh/"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) return false
  const data = (await res.json()) as { access: string }
  localStorage.setItem("access", data.access)
  return true
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
  retried = false
): Promise<T> {
  const { json, headers, ...rest } = options
  const hdrs = new Headers(headers)
  hdrs.set("Accept", "application/json")
  if (json !== undefined) {
    hdrs.set("Content-Type", "application/json")
    rest.body = JSON.stringify(json)
  }
  const access = localStorage.getItem("access")
  if (access) hdrs.set("Authorization", `Bearer ${access}`)

  const res = await fetch(buildUrl(path), { ...rest, headers: hdrs })
  const text = await res.text()
  const data = parseJson(text) as T

  if (
    res.status === 401 &&
    !retried &&
    !path.includes("auth/login") &&
    !path.includes("auth/register") &&
    !path.includes("auth/token/refresh")
  ) {
    const refreshed = await tryRefresh()
    if (refreshed) return apiFetch<T>(path, options, true)
  }

  if (!res.ok) {
    throw new ApiError(res.status, data)
  }
  return data
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<TokenResponse>("/api/auth/login/", {
      method: "POST",
      json: { username, password },
    }),
  register: (payload: {
    username: string
    email: string
    password: string
    password_confirm: string
  }) =>
    apiFetch<{ id: number; username: string; email: string }>(
      "/api/auth/register/",
      { method: "POST", json: payload }
    ),
}

export const workspacesApi = {
  list: () => apiFetch<Workspace[]>("/api/workspaces/"),
  create: (body: { name: string; description?: string }) =>
    apiFetch<Workspace>("/api/workspaces/", { method: "POST", json: body }),
  members: (id: number) =>
    apiFetch<WorkspaceMember[]>(`/api/workspaces/${id}/members/`),
  addMember: (id: number, username: string) =>
    apiFetch<WorkspaceMember>(`/api/workspaces/${id}/add_member/`, {
      method: "POST",
      json: { username },
    }),
  removeMember: (workspaceId: number, userId: number) =>
    apiFetch<null>(`/api/workspaces/${workspaceId}/members/${userId}/`, {
      method: "DELETE",
    }),
}

export const tasksApi = {
  list: (params: {
    workspace: number
    page?: number
    status?: TaskStatus | ""
    priority?: TaskPriority | ""
    assignee?: string
    ordering?: TaskOrdering
  }) => {
    const q = new URLSearchParams()
    q.set("workspace", String(params.workspace))
    if (params.page) q.set("page", String(params.page))
    if (params.status) q.set("status", params.status)
    if (params.priority) q.set("priority", params.priority)
    if (params.assignee) q.set("assignee", params.assignee)
    if (params.ordering) q.set("ordering", params.ordering)
    return apiFetch<Paginated<Task>>(`/api/tasks/?${q.toString()}`)
  },
  get: (id: number) => apiFetch<Task>(`/api/tasks/${id}/`),
  create: (body: {
    workspace: number
    title: string
    description?: string
    status?: TaskStatus
    priority?: TaskPriority
    due_date?: string | null
    assignee_id?: number | null
  }) => apiFetch<Task>("/api/tasks/", { method: "POST", json: body }),
  patch: (
    id: number,
    body: Partial<{
      title: string
      description: string
      status: TaskStatus
      priority: TaskPriority
      due_date: string | null
      assignee_id: number | null
    }>
  ) => apiFetch<Task>(`/api/tasks/${id}/`, { method: "PATCH", json: body }),
  delete: (id: number) =>
    apiFetch<null>(`/api/tasks/${id}/`, { method: "DELETE" }),
}
