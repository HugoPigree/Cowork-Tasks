import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LogOut,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  UserCircle2,
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useAuth } from "@/context/AuthContext"
import { useWorkspace } from "@/context/WorkspaceContext"
import { ApiError, tasksApi, workspacesApi } from "@/lib/api"
import type {
  Task,
  TaskOrdering,
  TaskPriority,
  TaskStatus,
  WorkspaceMember,
} from "@/lib/types"

const PAGE_SIZE = 10

const statusLabel: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
}

const priorityLabel: Record<TaskPriority, string> = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
}

function statusVariant(
  s: TaskStatus
): "default" | "secondary" | "outline" | "destructive" {
  if (s === "done") return "secondary"
  if (s === "in_progress") return "default"
  return "outline"
}

function priorityVariant(
  p: TaskPriority
): "default" | "secondary" | "outline" | "destructive" {
  if (p === "high") return "destructive"
  if (p === "medium") return "default"
  return "outline"
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

const orderingLabels: Record<TaskOrdering, string> = {
  "-priority": "Priorité (haute → basse)",
  priority: "Priorité (basse → haute)",
  due_date: "Échéance (proche d’abord)",
  "-due_date": "Échéance (lointaines d’abord)",
  created_at: "Création (anciennes d’abord)",
  "-created_at": "Création (récentes d’abord)",
}

export function TasksPage() {
  const { username, logout } = useAuth()
  const {
    workspaces,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    currentWorkspace,
    loading: wsLoading,
  } = useWorkspace()

  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all")
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">(
    "all"
  )
  const [filterAssignee, setFilterAssignee] = useState<string>("all")
  const [ordering, setOrdering] = useState<TaskOrdering>("-priority")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)

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

  const load = useCallback(async () => {
    if (!currentWorkspaceId) {
      setTasks([])
      setCount(0)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await tasksApi.list({
        workspace: currentWorkspaceId,
        page,
        status: filterStatus === "all" ? "" : filterStatus,
        priority: filterPriority === "all" ? "" : filterPriority,
        assignee:
          filterAssignee === "all"
            ? ""
            : filterAssignee === "unassigned"
              ? "unassigned"
              : filterAssignee,
        ordering,
      })
      setTasks(data.results)
      setCount(data.count)
      setTotalPages(Math.max(1, Math.ceil(data.count / PAGE_SIZE)))
    } catch {
      toast.error("Impossible de charger les tâches")
    } finally {
      setLoading(false)
    }
  }, [
    currentWorkspaceId,
    page,
    filterStatus,
    filterPriority,
    filterAssignee,
    ordering,
  ])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [filterStatus, filterPriority, filterAssignee, ordering, currentWorkspaceId])

  async function handleSave(payload: {
    title: string
    description: string
    status: TaskStatus
    priority: TaskPriority
    due_date: string | null
    assignee_id: number | null
  }) {
    if (!currentWorkspaceId) return
    try {
      if (editing) {
        await tasksApi.patch(editing.id, {
          title: payload.title,
          description: payload.description,
          status: payload.status,
          priority: payload.priority,
          due_date: payload.due_date,
          assignee_id: payload.assignee_id,
        })
        toast.success("Tâche mise à jour")
      } else {
        await tasksApi.create({
          workspace: currentWorkspaceId,
          title: payload.title,
          description: payload.description,
          status: payload.status,
          priority: payload.priority,
          due_date: payload.due_date,
          assignee_id: payload.assignee_id,
        })
        toast.success("Tâche créée")
      }
      await load()
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
      await load()
    } catch {
      toast.error("Suppression impossible")
    }
  }

  if (wsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">Chargement des espaces…</p>
      </div>
    )
  }

  if (!currentWorkspaceId || workspaces.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
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
              <Link to="/workspaces" className="gap-1">
                <Settings2 className="h-4 w-4" />
                Espaces
              </Link>
            </Button>
            <ThemeToggle />
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <span className="hidden text-sm text-muted-foreground lg:inline">
              {username}
            </span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="mr-1 h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {currentWorkspace?.name ?? "Tâches"}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {count} tâche{count !== 1 ? "s" : ""} · tri{" "}
              <span className="font-medium text-foreground">
                {orderingLabels[ordering]}
              </span>
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
            className="shrink-0 gap-2 shadow-md"
          >
            <Plus className="h-4 w-4" />
            Nouvelle tâche
          </Button>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle className="text-lg">Filtres & tri</CardTitle>
                <CardDescription>
                  Priorité, statut, assignation — pensé pour le travail en équipe.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="w-[200px]">
                  <Select
                    value={ordering}
                    onValueChange={(v) => setOrdering(v as TaskOrdering)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tri" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(orderingLabels) as TaskOrdering[]).map(
                        (k) => (
                          <SelectItem key={k} value={k}>
                            {orderingLabels[k]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[150px]">
                  <Select
                    value={filterStatus}
                    onValueChange={(v) => setFilterStatus(v as TaskStatus | "all")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      <SelectItem value="todo">À faire</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="done">Terminé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[150px]">
                  <Select
                    value={filterPriority}
                    onValueChange={(v) =>
                      setFilterPriority(v as TaskPriority | "all")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes prio.</SelectItem>
                      <SelectItem value="low">Basse</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="high">Haute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[180px]">
                  <Select
                    value={filterAssignee}
                    onValueChange={setFilterAssignee}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assigné" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les assignés</SelectItem>
                      <SelectItem value="unassigned">Non assigné</SelectItem>
                      {members.map((m) => (
                        <SelectItem
                          key={m.id}
                          value={String(m.user.id)}
                        >
                          {m.user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <Tabs defaultValue="cards" className="w-full">
              <div className="flex items-center justify-between border-b px-4 py-2">
                <TabsList className="h-8">
                  <TabsTrigger value="cards" className="gap-1 text-xs">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Cartes
                  </TabsTrigger>
                </TabsList>
              </div>
              <ScrollArea className="min-h-[320px] max-h-[calc(100vh-24rem)]">
                <div className="p-4">
                  {loading ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-40 rounded-xl" />
                      ))}
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <p className="text-lg font-medium">Aucune tâche</p>
                      <p className="mt-1 max-w-md text-sm text-muted-foreground">
                        Créez une tâche assignée à un coéquipier ou ajustez filtres / tri.
                      </p>
                      <Button
                        className="mt-6"
                        onClick={() => {
                          setEditing(null)
                          setDialogOpen(true)
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Créer une tâche
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {tasks.map((t) => (
                        <Card
                          key={t.id}
                          className="group border-border/60 transition-shadow hover:shadow-md"
                        >
                          <CardHeader className="space-y-2 pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="line-clamp-2 text-base leading-snug">
                                {t.title}
                              </CardTitle>
                              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditing(t)
                                    setDialogOpen(true)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(t)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={statusVariant(t.status)}>
                                {statusLabel[t.status]}
                              </Badge>
                              <Badge variant={priorityVariant(t.priority)}>
                                {priorityLabel[t.priority]}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 pb-4 pt-0">
                            {t.description ? (
                              <p className="line-clamp-3 text-sm text-muted-foreground">
                                {t.description}
                              </p>
                            ) : null}
                            <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-2 text-xs">
                              <UserCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="space-y-0.5">
                                <p>
                                  <span className="text-muted-foreground">
                                    Assigné :{" "}
                                  </span>
                                  <span className="font-medium">
                                    {t.assignee
                                      ? `@${t.assignee.username}`
                                      : "Non assigné"}
                                  </span>
                                </p>
                                <p className="text-muted-foreground">
                                  Créé par @{t.created_by.username}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Créée : {formatDate(t.created_at)}
                              <br />
                              Échéance : {formatDate(t.due_date)}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        members={members}
        onSave={handleSave}
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
