import { createContext } from "react"
import type { Workspace } from "@/lib/types"

export type WorkspaceContextValue = {
  workspaces: Workspace[]
  currentWorkspaceId: number | null
  currentWorkspace: Workspace | null
  setCurrentWorkspaceId: (id: number | null) => void
  refreshWorkspaces: () => Promise<void>
  loading: boolean
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null
)
