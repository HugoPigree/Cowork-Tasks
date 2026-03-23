import type {
  BoardColumn,
  Paginated,
  Task,
  TaskComment,
  TaskOrdering,
  TaskPriority,
  TaskReorderItem,
  TaskStatus,
  MeResponse,
  ObjectiveSummary,
  RegisterResponse,
  Sprint,
  SuggestedTaskTemplate,
  TokenResponse,
  Workspace,
  WorkspaceBoard,
  WorkspaceMember,
} from "./types"

/** Origin only (e.g. http://localhost:8000). Paths already include `/api/...`. */
const API_BASE_RAW = (import.meta.env.VITE_API_BASE ?? "").trim()

function buildUrl(path: string): string {
  if (path.startsWith("http")) return path
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  let base = API_BASE_RAW.replace(/\/+$/, "")
  // If env wrongly ends with `/api` and path is `/api/...`, avoid `/api/api/...` (404).
  if (
    /\/api$/i.test(base) &&
    normalizedPath.toLowerCase().startsWith("/api/")
  ) {
    base = base.replace(/\/api$/i, "").replace(/\/+$/, "")
  }
  if (!base) return normalizedPath
  return `${base}${normalizedPath}`
}

export class ApiError extends Error {
  status: number
  body: unknown
  /** Resolved request URL (useful when debugging 404 / wrong API base). */
  requestUrl: string

  constructor(status: number, body: unknown, requestUrl = "") {
    super(
      typeof body === "object" && body && "detail" in (body as object)
        ? String((body as { detail: unknown }).detail)
        : `HTTP ${status}`
    )
    this.status = status
    this.body = body
    this.requestUrl = requestUrl
  }
}

type ApiFetchOptions = RequestInit & { json?: unknown; formData?: FormData }

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
  options: ApiFetchOptions = {},
  retried = false
): Promise<T> {
  const { json, formData, headers, ...rest } = options
  const hdrs = new Headers(headers)
  hdrs.set("Accept", "application/json")
  if (formData !== undefined) {
    rest.body = formData
  } else if (json !== undefined) {
    hdrs.set("Content-Type", "application/json")
    rest.body = JSON.stringify(json)
  }
  const access = localStorage.getItem("access")
  if (access) hdrs.set("Authorization", `Bearer ${access}`)

  const requestUrl = buildUrl(path)
  const res = await fetch(requestUrl, { ...rest, headers: hdrs })
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
    if (refreshed) return apiFetch<T>(path, options as ApiFetchOptions, true)
  }

  if (!res.ok) {
    throw new ApiError(res.status, data, requestUrl)
  }
  return data
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<TokenResponse>("/api/auth/login/", {
      method: "POST",
      json: { username, password },
    }),
  me: () => apiFetch<MeResponse>("/api/auth/me/"),
  register: (
    input:
      | {
          username: string
          email: string
          password: string
          password_confirm: string
          avatar_url?: string
        }
      | FormData
  ) =>
    input instanceof FormData
      ? apiFetch<RegisterResponse>("/api/auth/register/", {
          method: "POST",
          formData: input,
        })
      : apiFetch<RegisterResponse>("/api/auth/register/", {
          method: "POST",
          json: input,
        }),
}

export const workspacesApi = {
  list: () => apiFetch<Workspace[]>("/api/workspaces/"),
  create: (body: {
    name: string
    description?: string
    github_url?: string
  }) =>
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
  board: (id: number) =>
    apiFetch<WorkspaceBoard>(`/api/workspaces/${id}/board/`),
  update: (
    id: number,
    body: { name?: string; description?: string; github_url?: string }
  ) =>
    apiFetch<Workspace>(`/api/workspaces/${id}/`, {
      method: "PATCH",
      json: body,
    }),
  delete: (id: number) =>
    apiFetch<null>(`/api/workspaces/${id}/`, { method: "DELETE" }),
  createBoardColumn: (
    workspaceId: number,
    body: {
      name: string
      position?: number
      wip_limit?: number | null
      color?: string
      maps_to_status?: TaskStatus
    }
  ) =>
    apiFetch<BoardColumn>(`/api/workspaces/${workspaceId}/board/columns/`, {
      method: "POST",
      json: body,
    }),

  listSprints: (workspaceId: number) =>
    apiFetch<Sprint[]>(`/api/workspaces/${workspaceId}/sprints/`),

  createSprint: (workspaceId: number, body: { name: string; color: string }) =>
    apiFetch<Sprint>(`/api/workspaces/${workspaceId}/sprints/`, {
      method: "POST",
      json: body,
    }),

  deleteSprint: (workspaceId: number, sprintId: number) =>
    apiFetch<null>(
      `/api/workspaces/${workspaceId}/sprints/${sprintId}/`,
      { method: "DELETE" }
    ),
}

export const objectivesApi = {
  list: () => apiFetch<ObjectiveSummary[]>("/api/objectives/"),
  generate: (objectiveId: string) =>
    apiFetch<{ suggestions: SuggestedTaskTemplate[] }>(
      "/api/objectives/generate/",
      { method: "POST", json: { objective_id: objectiveId } }
    ),
}

export const tasksApi = {
  list: (params: {
    workspace: number
    page?: number
    page_size?: number
    status?: TaskStatus | ""
    priority?: TaskPriority | ""
    assignee?: string
    /** Filtre sprint : id numérique, ou "none" pour sans sprint ; omis = tous */
    sprint?: string
    ordering?: TaskOrdering
    search?: string
    root_only?: boolean
  }) => {
    const q = new URLSearchParams()
    q.set("workspace", String(params.workspace))
    if (params.page) q.set("page", String(params.page))
    if (params.page_size) q.set("page_size", String(params.page_size))
    if (params.status) q.set("status", params.status)
    if (params.priority) q.set("priority", params.priority)
    if (params.assignee) q.set("assignee", params.assignee)
    if (params.sprint != null && params.sprint !== "") {
      q.set("sprint", params.sprint)
    }
    if (params.ordering) q.set("ordering", params.ordering)
    if (params.search?.trim()) q.set("search", params.search.trim())
    if (params.root_only) q.set("root_only", "true")
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
    sprint_id?: number | null
    board_column_id?: number
    estimate?: number | null
  }) => apiFetch<Task>("/api/tasks/", { method: "POST", json: body }),
  patch: (
    id: number,
    body: Partial<{
      title: string
      description: string
      status: TaskStatus
      priority: TaskPriority
      position: number
      due_date: string | null
      assignee_id: number | null
      sprint_id: number | null
      board_column_id: number
      estimate: number | null
      depends_on_ids: number[]
    }>
  ) => apiFetch<Task>(`/api/tasks/${id}/`, { method: "PATCH", json: body }),
  delete: (id: number) =>
    apiFetch<null>(`/api/tasks/${id}/`, { method: "DELETE" }),
  reorder: (body: { workspace: number; items: TaskReorderItem[] }) =>
    apiFetch<{ updated: number }>("/api/tasks/reorder/", {
      method: "POST",
      json: body,
    }),
  listComments: (taskId: number) =>
    apiFetch<TaskComment[]>(`/api/tasks/${taskId}/comments/`),
  addComment: (taskId: number, body: string) =>
    apiFetch<TaskComment>(`/api/tasks/${taskId}/comments/`, {
      method: "POST",
      json: { body },
    }),
}
