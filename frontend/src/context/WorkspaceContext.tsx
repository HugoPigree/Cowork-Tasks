import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { workspacesApi } from "@/lib/api"
import type { Workspace } from "@/lib/types"

const STORAGE_KEY = "tm_workspace_id"

type WorkspaceContextValue = {
  workspaces: Workspace[]
  currentWorkspaceId: number | null
  currentWorkspace: Workspace | null
  setCurrentWorkspaceId: (id: number | null) => void
  refreshWorkspaces: () => Promise<void>
  loading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceIdState] = useState<
    number | null
  >(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  })
  const [loading, setLoading] = useState(true)

  const setCurrentWorkspaceId = useCallback((id: number | null) => {
    setCurrentWorkspaceIdState(id)
    if (id == null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, String(id))
  }, [])

  const refreshWorkspaces = useCallback(async () => {
    setLoading(true)
    try {
      const list = await workspacesApi.list()
      setWorkspaces(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshWorkspaces()
  }, [refreshWorkspaces])

  useEffect(() => {
    if (loading) return
    if (workspaces.length === 0) {
      if (currentWorkspaceId != null) setCurrentWorkspaceId(null)
      return
    }
    const ok =
      currentWorkspaceId != null &&
      workspaces.some((w) => w.id === currentWorkspaceId)
    if (!ok) setCurrentWorkspaceId(workspaces[0].id)
  }, [loading, workspaces, currentWorkspaceId, setCurrentWorkspaceId])

  const currentWorkspace =
    workspaces.find((w) => w.id === currentWorkspaceId) ?? null

  const value = useMemo(
    () => ({
      workspaces,
      currentWorkspaceId,
      currentWorkspace,
      setCurrentWorkspaceId,
      refreshWorkspaces,
      loading,
    }),
    [
      workspaces,
      currentWorkspaceId,
      currentWorkspace,
      setCurrentWorkspaceId,
      refreshWorkspaces,
      loading,
    ]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return ctx
}
