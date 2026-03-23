import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { CheckSquare2, Settings2, Sparkles } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { AddBoardColumnDialog } from "@/components/tasks/AddBoardColumnDialog"
import { KanbanBoard } from "@/components/tasks/KanbanBoard"
import { ProjectBoardToolbar } from "@/components/tasks/ProjectBoardToolbar"
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog"
import { TaskModal } from "@/components/tasks/TaskModal"
import { BacklogObjectivePanel } from "@/components/tasks/BacklogObjectivePanel"
import { SprintManageDialog } from "@/components/tasks/SprintManageDialog"
import { UserAccountMenu } from "@/components/layout/UserAccountMenu"
import { useWorkspace } from "@/context/WorkspaceContext"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { ApiError, tasksApi, workspacesApi } from "@/lib/api"
import type {
  BoardColumn,
  Sprint,
  Task,
  TaskPriority,
  TaskReorderItem,
  TaskStatus,
  WorkspaceMember,
} from "@/lib/types"

export function TasksPage() {
  const {
    workspaces,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    currentWorkspace,
    loading: wsLoading,
  } = useWorkspace()

  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [kanbanTasks, setKanbanTasks] = useState<Task[]>([])
  const [kanbanColumns, setKanbanColumns] = useState<BoardColumn[]>([])
  const [kanbanLoading, setKanbanLoading] = useState(false)
  const [modalTask, setModalTask] = useState<Task | null>(null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [createDefaults, setCreateDefaults] = useState<{
    columnId?: number
  } | null>(null)
  const [addColumnOpen, setAddColumnOpen] = useState(false)
  const [filterAssignee, setFilterAssignee] = useState<string>("all")
  const [filterSprint, setFilterSprint] = useState<string>("all")
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sprintManageOpen, setSprintManageOpen] = useState(false)

  const canManageBoardColumns = Boolean(currentWorkspace)

  function openNewTask(columnId?: number) {
    setEditing(null)
    if (columnId == null) {
      setCreateDefaults(null)
    } else {
      setCreateDefaults({ columnId })
    }
    setDialogOpen(true)
  }

  useEffect(() => {
    if (!currentWorkspaceId) {
      setMembers([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const list = await workspacesApi.members(currentWorkspaceId)
        if (!cancelled) setMembers(list)
      } catch {
        if (!cancelled) setMembers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    if (!currentWorkspaceId) {
      setSprints([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const list = await workspacesApi.listSprints(currentWorkspaceId)
        if (!cancelled) setSprints(list)
      } catch {
        if (!cancelled) setSprints([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentWorkspaceId])

  const loadKanbanBoard = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!currentWorkspaceId) {
        setKanbanTasks([])
        setKanbanColumns([])
        return
      }
      const silent = opts?.silent === true
      if (!silent) setKanbanLoading(true)
      try {
        const [board, data] = await Promise.all([
          workspacesApi.board(currentWorkspaceId),
          tasksApi.list({
            workspace: currentWorkspaceId,
            ordering: "kanban",
            root_only: true,
            page_size: 200,
            page: 1,
            assignee:
              filterAssignee === "all"
                ? ""
                : filterAssignee === "unassigned"
                  ? "unassigned"
                  : filterAssignee,
            search: debouncedSearch,
            sprint:
              filterSprint === "all"
                ? undefined
                : filterSprint === "none"
                  ? "none"
                  : filterSprint,
          }),
        ])
        setKanbanColumns(board.columns)
        setKanbanTasks(data.results)
      } catch {
        if (!silent) toast.error("Impossible de charger le tableau")
        if (!silent) {
          setKanbanTasks([])
          setKanbanColumns([])
        }
      } finally {
        if (!silent) setKanbanLoading(false)
      }
    },
    [currentWorkspaceId, filterAssignee, filterSprint, debouncedSearch],
  )

  const handleSprintsChanged = useCallback(async () => {
    if (!currentWorkspaceId) return
    try {
      const list = await workspacesApi.listSprints(currentWorkspaceId)
      setSprints(list)
      setFilterSprint((prev) => {
        if (
          prev !== "all" &&
          prev !== "none" &&
          !list.some((s) => String(s.id) === prev)
        ) {
          return "all"
        }
        return prev
      })
      await loadKanbanBoard({ silent: true })
    } catch {
      toast.error("Impossible de rafraîchir les sprints")
    }
  }, [currentWorkspaceId, loadKanbanBoard])

  useEffect(() => {
    void loadKanbanBoard()
  }, [loadKanbanBoard])

  async function handleSave(payload: {
    title: string
    description: string
    priority: TaskPriority
    due_date: string | null
    assignee_id: number | null
    sprint_id: number | null
    board_column_id?: number
  }) {
    if (!currentWorkspaceId) return
    try {
      if (editing) {
        await tasksApi.patch(editing.id, {
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          due_date: payload.due_date,
          assignee_id: payload.assignee_id,
          sprint_id: payload.sprint_id,
        })
        toast.success("Tâche mise à jour")
      } else {
        await tasksApi.create({
          workspace: currentWorkspaceId,
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          due_date: payload.due_date,
          assignee_id: payload.assignee_id,
          sprint_id: payload.sprint_id,
          board_column_id: payload.board_column_id,
        })
        toast.success("Tâche créée")
      }
      await loadKanbanBoard({ silent: true })
    } catch (err) {
      if (err instanceof ApiError) toast.error("Enregistrement refusé")
      else toast.error("Erreur réseau")
      throw err
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await tasksApi.delete(deleteTarget.id)
      toast.success("Tâche supprimée")
      setDeleteTarget(null)
      await loadKanbanBoard({ silent: true })
    } catch {
      toast.error("Suppression impossible")
    }
  }

  async function handleKanbanReorder(items: TaskReorderItem[]) {
    if (!currentWorkspaceId) return
    try {
      await tasksApi.reorder({ workspace: currentWorkspaceId, items })
      await loadKanbanBoard({ silent: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        toast.error(
          typeof err.body === "object" && err.body && "detail" in err.body
            ? String((err.body as { detail: string }).detail)
            : "Déplacement refusé (tâche bloquée par des dépendances ?)",
        )
      } else {
        toast.error("Impossible d’enregistrer le déplacement")
      }
      throw new Error("reorder failed")
    }
  }

  async function handleCreateBoardColumn(data: {
    name: string
    maps_to_status: TaskStatus
    wip_limit: number | null
    color: string
  }) {
    if (!currentWorkspaceId) return
    const nextPos =
      kanbanColumns.length === 0
        ? 0
        : Math.max(...kanbanColumns.map((c) => c.position), -1) + 1
    try {
      await workspacesApi.createBoardColumn(currentWorkspaceId, {
        name: data.name,
        position: nextPos,
        maps_to_status: data.maps_to_status,
        color: data.color,
        wip_limit: data.wip_limit,
      })
      toast.success("Colonne ajoutée")
      await loadKanbanBoard({ silent: true })
    } catch (err) {
      if (err instanceof ApiError) toast.error("Impossible d’ajouter la colonne")
      else toast.error("Erreur réseau")
      throw err
    }
  }

  function openTaskModal(t: Task) {
    setModalTask(t)
    setTaskModalOpen(true)
  }

  if (wsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <p className="text-muted-foreground">Chargement des espaces…</p>
      </div>
    )
  }

  if (!currentWorkspaceId || workspaces.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8">
        <p className="text-center text-muted-foreground">
          Aucun espace de travail. Créez-en un pour collaborer.
        </p>
        <Button asChild>
          <Link to="/workspaces">Gérer les espaces</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_120%_90%_at_50%_-25%,hsl(var(--primary)/0.08),transparent)]">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/90 shadow-sm shadow-black/[0.04] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CheckSquare2 className="h-5 w-5" />
            </div>
            <span>Cowork Tasks</span>
          </Link>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
            <div className="min-w-[200px] max-w-xs flex-1 sm:flex-initial">
              <Select
                value={String(currentWorkspaceId)}
                onValueChange={(v) => setCurrentWorkspaceId(parseInt(v, 10))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Espace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/aide-creation-uc" className="gap-1">
                <Sparkles className="h-4 w-4" />
                Aide UC
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/workspaces" className="gap-1">
                <Settings2 className="h-4 w-4" />
                Espaces
              </Link>
            </Button>
            <UserAccountMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[min(100%,1600px)] space-y-6 px-4 py-6 sm:px-5 sm:py-8">
        {currentWorkspaceId ? (
          <BacklogObjectivePanel
            workspaceId={currentWorkspaceId}
            columns={kanbanColumns}
            onTasksCreated={() => loadKanbanBoard({ silent: true })}
          />
        ) : null}
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <ProjectBoardToolbar
            workspaceName={currentWorkspace?.name ?? "Tâches"}
            description={currentWorkspace?.description}
            taskCount={kanbanTasks.length}
            githubUrl={currentWorkspace?.github_url}
            onNewTask={() => openNewTask()}
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            filterAssignee={filterAssignee}
            onFilterAssignee={setFilterAssignee}
            filterSprint={filterSprint}
            onFilterSprint={setFilterSprint}
            sprints={sprints}
            onOpenSprintManager={() => setSprintManageOpen(true)}
            members={members}
          />
          <CardContent className="border-t border-border/50 bg-muted/25 p-4 sm:p-6">
            {kanbanLoading ? (
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-[min(420px,50vh)] w-[300px] shrink-0 rounded-xl"
                  />
                ))}
              </div>
            ) : (
              <KanbanBoard
                workspaceId={currentWorkspaceId}
                workspaceName={currentWorkspace?.name}
                columns={kanbanColumns}
                tasks={kanbanTasks}
                selectedTaskId={
                  taskModalOpen ? modalTask?.id ?? null : null
                }
                onPersistOrder={handleKanbanReorder}
                onOpenTask={openTaskModal}
                onAddTask={(columnId) => openNewTask(columnId)}
                canManageColumns={canManageBoardColumns}
                onRequestAddColumn={() => setAddColumnOpen(true)}
              />
            )}
          </CardContent>
        </Card>
      </main>

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setCreateDefaults(null)
        }}
        task={editing}
        members={members}
        sprints={sprints}
        defaultColumnId={createDefaults?.columnId}
        onSave={handleSave}
      />

      <SprintManageDialog
        open={sprintManageOpen}
        onOpenChange={setSprintManageOpen}
        workspaceId={currentWorkspaceId}
        sprints={sprints}
        onSprintsChanged={() => void handleSprintsChanged()}
      />

      <AddBoardColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        onSubmit={handleCreateBoardColumn}
      />

      <TaskModal
        open={taskModalOpen}
        onOpenChange={(o) => {
          setTaskModalOpen(o)
          if (!o) setModalTask(null)
        }}
        task={modalTask}
        workspaceId={currentWorkspaceId}
        members={members}
        sprints={sprints}
        onUpdated={async () => {
          await loadKanbanBoard({ silent: true })
        }}
        onDelete={(t) => setDeleteTarget(t)}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.title} — action définitive pour tout l&apos;espace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
