export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high"

export type TaskOrdering =
  | "-priority"
  | "priority"
  | "due_date"
  | "-due_date"
  | "created_at"
  | "-created_at"
  | "position"
  | "kanban"

export interface UserBrief {
  id: number
  username: string
  first_name?: string
  /** URL absolue (upload) ou externe (DiceBear). Vide = initiales. */
  avatar?: string
}

/** Sprint (itération) dans un espace — couleur pour badges Kanban. */
export interface Sprint {
  id: number
  name: string
  color: string
  created_at: string
}

export interface Workspace {
  id: number
  name: string
  description: string
  /** URL du dépôt GitHub (optionnel). */
  github_url: string
  created_at: string
  created_by: number
  member_count: number
  my_role: "owner" | "admin" | "member" | null
}

export interface BoardColumn {
  id: number
  name: string
  position: number
  color: string
  wip_limit: number | null
  maps_to_status: TaskStatus
  task_count?: number
}

export interface WorkspaceBoard {
  id: number
  workspace: number
  created_at: string
  columns: BoardColumn[]
}

/** Objectif produit prédéfini (liste API). */
export interface ObjectiveSummary {
  id: string
  title: string
  description: string
}

/** Proposition de tâche avant création dans le backlog. */
export interface SuggestedTaskTemplate {
  title: string
  description: string
}

export interface WorkspaceMember {
  id: number
  user: UserBrief
  role: string
  joined_at: string
}

/** Tâche référencée comme bloquante (dépendance). */
export interface TaskDependsOnBrief {
  id: number
  title: string
  status: TaskStatus
  board_column: BoardColumn
}

export interface Task {
  id: number
  workspace: number
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  position: number
  subtask_count: number
  board_column: BoardColumn
  /** Sprint optionnel (une seule par tâche). */
  sprint: Pick<Sprint, "id" | "name" | "color"> | null
  estimate: number | null
  created_at: string
  due_date: string | null
  created_by: UserBrief
  assignee: UserBrief | null
  depends_on: TaskDependsOnBrief[]
  is_blocked: boolean
}

export interface TaskComment {
  id: number
  body: string
  author: UserBrief
  created_at: string
}

export interface TaskReorderItem {
  id: number
  column_id?: number
  status?: TaskStatus
  position?: number
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface TokenResponse {
  access: string
  refresh: string
  user?: { id: number; username: string; avatar?: string }
}

export interface MeResponse {
  id: number
  username: string
  avatar: string
}

export interface RegisterResponse {
  id: number
  username: string
  email: string
  avatar?: string
  message?: string
}
