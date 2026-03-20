export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high"

export type TaskOrdering =
  | "-priority"
  | "priority"
  | "due_date"
  | "-due_date"
  | "created_at"
  | "-created_at"

export interface UserBrief {
  id: number
  username: string
}

export interface Workspace {
  id: number
  name: string
  description: string
  created_at: string
  created_by: number
  member_count: number
  my_role: "owner" | "member" | null
}

export interface WorkspaceMember {
  id: number
  user: UserBrief
  role: string
  joined_at: string
}

export interface Task {
  id: number
  workspace: number
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  created_at: string
  due_date: string | null
  created_by: UserBrief
  assignee: UserBrief | null
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
}
