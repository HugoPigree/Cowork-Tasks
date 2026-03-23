import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react"
import { CommentSection } from "@/components/tasks/CommentSection"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, tasksApi } from "@/lib/api"
import { FORMATTED_MULTILINE } from "@/lib/formattedText"
import { getDueUrgency } from "@/lib/dueDateUrgency"
import type {
  Sprint,
  Task,
  TaskPriority,
  TaskStatus,
  WorkspaceMember,
} from "@/lib/types"
import { cn } from "@/lib/utils"

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
  if (p === "medium") return "secondary"
  return "outline"
}

function withTaskDefaults(t: Task): Task {
  return {
    ...t,
    depends_on: t.depends_on ?? [],
    is_blocked: Boolean(t.is_blocked),
    sprint: t.sprint ?? null,
  }
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  workspaceId: number | null
  /** Membres de l’espace pour le select « Assigné à » */
  members: WorkspaceMember[]
  /** Sprints de l’espace pour l’assignation */
  sprints: Sprint[]
  onUpdated: () => Promise<void> | void
  onDelete: (task: Task) => void
}

export function TaskModal({
  open,
  onOpenChange,
  task,
  workspaceId,
  members,
  sprints,
  onUpdated,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("")
  const [savingTitle, setSavingTitle] = useState(false)
  const [description, setDescription] = useState("")
  const [savingDescription, setSavingDescription] = useState(false)
  const [assigneeKey, setAssigneeKey] = useState<string>("__none__")
  const [savingAssignee, setSavingAssignee] = useState(false)
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [savingPriority, setSavingPriority] = useState(false)
  const [dueLocal, setDueLocal] = useState("")
  const [savingDue, setSavingDue] = useState(false)
  const [sprintKey, setSprintKey] = useState<string>("__none__")
  const [savingSprint, setSavingSprint] = useState(false)

  const [detail, setDetail] = useState<Task | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [candidates, setCandidates] = useState<Task[]>([])
  const [addDepId, setAddDepId] = useState<string>("")
  const [depsSaving, setDepsSaving] = useState(false)

  useEffect(() => {
    if (!open || !task) {
      setDetail(null)
      return
    }
    setTitle(task.title)
    setDescription(task.description ?? "")
    setAssigneeKey(task.assignee ? String(task.assignee.id) : "__none__")
    setPriority(task.priority)
    setDueLocal(toDatetimeLocal(task.due_date))
    setSprintKey(task.sprint ? String(task.sprint.id) : "__none__")
    setDetail(withTaskDefaults(task))
    setDetailLoading(true)
    void (async () => {
      try {
        const fresh = await tasksApi.get(task.id)
        const normalized = withTaskDefaults(fresh)
        setDetail(normalized)
        setTitle(normalized.title)
        setDescription(normalized.description ?? "")
        setAssigneeKey(
          normalized.assignee ? String(normalized.assignee.id) : "__none__"
        )
        setPriority(normalized.priority)
        setDueLocal(toDatetimeLocal(normalized.due_date))
        setSprintKey(
          normalized.sprint ? String(normalized.sprint.id) : "__none__"
        )
      } catch {
        toast.error("Impossible de charger le détail de la tâche")
      } finally {
        setDetailLoading(false)
      }
    })()
  }, [open, task?.id])

  useEffect(() => {
    if (!open || !workspaceId) {
      setCandidates([])
      return
    }
    void (async () => {
      try {
        const data = await tasksApi.list({
          workspace: workspaceId,
          root_only: true,
          page_size: 200,
          page: 1,
        })
        setCandidates(data.results)
      } catch {
        setCandidates([])
      }
    })()
  }, [open, workspaceId])

  async function refreshDetail(taskId: number) {
    const fresh = await tasksApi.get(taskId)
    setDetail(withTaskDefaults(fresh))
  }

  async function commitTitle() {
    if (!detail) return
    const next = title.trim()
    if (!next || next === detail.title) return
    setSavingTitle(true)
    try {
      await tasksApi.patch(detail.id, { title: next })
      toast.success("Titre mis à jour")
      await onUpdated()
      await refreshDetail(detail.id)
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
      setTitle(detail.title)
    } finally {
      setSavingTitle(false)
    }
  }

  async function commitDescription() {
    if (!detail) return
    const next = description
    if (next === (detail.description ?? "")) return
    setSavingDescription(true)
    try {
      await tasksApi.patch(detail.id, { description: next })
      await onUpdated()
      await refreshDetail(detail.id)
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
      setDescription(detail.description ?? "")
    } finally {
      setSavingDescription(false)
    }
  }

  async function commitAssignee(nextKey: string) {
    if (!detail) return
    const assignee_id =
      nextKey === "__none__" ? null : parseInt(nextKey, 10)
    const prevKey = detail.assignee
      ? String(detail.assignee.id)
      : "__none__"
    if (nextKey === prevKey) return
    setAssigneeKey(nextKey)
    setSavingAssignee(true)
    try {
      await tasksApi.patch(detail.id, { assignee_id })
      await onUpdated()
      await refreshDetail(detail.id)
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
      setAssigneeKey(prevKey)
    } finally {
      setSavingAssignee(false)
    }
  }

  async function commitPriority(next: TaskPriority) {
    if (!detail || next === detail.priority) return
    const prev = detail.priority
    setPriority(next)
    setSavingPriority(true)
    try {
      await tasksApi.patch(detail.id, { priority: next })
      await onUpdated()
      await refreshDetail(detail.id)
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
      setPriority(prev)
    } finally {
      setSavingPriority(false)
    }
  }

  async function commitSprint(nextKey: string) {
    if (!detail) return
    const sprint_id =
      nextKey === "__none__" ? null : parseInt(nextKey, 10)
    const prevKey = detail.sprint ? String(detail.sprint.id) : "__none__"
    if (nextKey === prevKey) return
    setSprintKey(nextKey)
    setSavingSprint(true)
    try {
      await tasksApi.patch(detail.id, { sprint_id })
      await onUpdated()
      await refreshDetail(detail.id)
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
      setSprintKey(prevKey)
    } finally {
      setSavingSprint(false)
    }
  }

  async function commitDue() {
    if (!detail) return
    const nextIso = dueLocal
      ? new Date(dueLocal).toISOString()
      : null
    const prevIso = detail.due_date
    if (nextIso === prevIso || (!nextIso && !prevIso)) return
    setSavingDue(true)
    try {
      await tasksApi.patch(detail.id, { due_date: nextIso })
      await onUpdated()
      await refreshDetail(detail.id)
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
      setDueLocal(toDatetimeLocal(detail.due_date))
    } finally {
      setSavingDue(false)
    }
  }

  async function setDependsOnIds(nextIds: number[]) {
    if (!detail) return
    setDepsSaving(true)
    try {
      const updated = await tasksApi.patch(detail.id, {
        depends_on_ids: nextIds,
      })
      setDetail(withTaskDefaults(updated))
      setAddDepId("")
      toast.success("Dépendances mises à jour")
      await onUpdated()
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
    } finally {
      setDepsSaving(false)
    }
  }

  function removeDependency(blockerId: number) {
    if (!detail) return
    const next = detail.depends_on
      .filter((d) => d.id !== blockerId)
      .map((d) => d.id)
    void setDependsOnIds(next)
  }

  function addDependency() {
    if (!detail || !addDepId) return
    const id = Number(addDepId)
    if (Number.isNaN(id)) return
    const ids = new Set(detail.depends_on.map((d) => d.id))
    ids.add(id)
    void setDependsOnIds([...ids])
  }

  const display = detail
  const dueUrgency = display
    ? getDueUrgency(display.due_date, { taskStatus: display.status })
    : "none"
  const depIds = new Set(display?.depends_on.map((d) => d.id) ?? [])
  const pickable = candidates.filter(
    (c) => c.id !== display?.id && !depIds.has(c.id)
  )

  const sectionLabel =
    "text-xs font-semibold uppercase tracking-wider text-muted-foreground"

  const dueHint =
    display?.due_date && dueUrgency === "overdue"
      ? "Échéance dépassée"
      : display?.due_date && dueUrgency === "soon"
        ? "Échéance dans moins de 24 h"
        : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,880px)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {display ? (
          <>
            <DialogHeader className="shrink-0 space-y-3 border-b border-border/60 bg-muted/35 px-5 py-5 text-left">
              <div className="flex flex-wrap items-center gap-2">
                {detailLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
                <Badge variant={statusVariant(display.status)}>
                  {statusLabel[display.status]}
                </Badge>
                <Badge variant={priorityVariant(priority)}>
                  {priorityLabel[priority]}
                </Badge>
                {display.is_blocked ? (
                  <Badge variant="destructive">Bloquée</Badge>
                ) : display.depends_on.length > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800"
                  >
                    Débloquée
                  </Badge>
                ) : null}
              </div>
              <DialogTitle className="sr-only">Détail de la tâche</DialogTitle>
              <DialogDescription className="sr-only">
                Modifier la tâche, les dépendances et les commentaires.
              </DialogDescription>
              <div className="space-y-2 pr-8">
                <Label htmlFor="task-modal-title" className={sectionLabel}>
                  Titre
                </Label>
                <Input
                  id="task-modal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => void commitTitle()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void commitTitle()
                    }
                  }}
                  className="border-transparent bg-transparent px-0 text-xl font-semibold leading-snug tracking-tight shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-muted/35"
                  disabled={savingTitle}
                />
              </div>
            </DialogHeader>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background/40 px-5 py-6">
                <div className="space-y-8 pb-2">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={sectionLabel}>Description</h3>
                      {savingDescription ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : null}
                    </div>
                    <Textarea
                      id="task-modal-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => void commitDescription()}
                      placeholder="Contexte, liens, critères d’acceptation…"
                      rows={6}
                      disabled={savingDescription}
                      className={cn(
                        FORMATTED_MULTILINE,
                        "min-h-[148px] resize-y"
                      )}
                    />
                  </section>

                  <section className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="task-modal-assignee">Assigné à</Label>
                      <Select
                        value={assigneeKey}
                        onValueChange={(v) => void commitAssignee(v)}
                        disabled={savingAssignee}
                      >
                        <SelectTrigger
                          id="task-modal-assignee"
                          className="h-10 w-full"
                        >
                          <SelectValue placeholder="Choisir…" />
                        </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Non assigné</SelectItem>
                            {members.map((m) => (
                              <SelectItem
                                key={m.id}
                                value={String(m.user.id)}
                              >
                                {m.user.username}
                                {m.role === "owner" ? " (owner)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="task-modal-sprint">Sprint</Label>
                        {savingSprint ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>
                      <Select
                        value={sprintKey}
                        onValueChange={(v) => void commitSprint(v)}
                        disabled={savingSprint}
                      >
                        <SelectTrigger
                          id="task-modal-sprint"
                          className="h-10 w-full"
                        >
                          <SelectValue placeholder="Choisir…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Aucun sprint</SelectItem>
                          {sprints.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
                                  style={{ backgroundColor: s.color }}
                                  aria-hidden
                                />
                                {s.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Mobile : 2 blocs empilés. ≥sm : grille 3 lignes (libellés / champs h-10 / alerte). */}
                    <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-x-4 sm:gap-y-2">
                      <div className="flex flex-col gap-2 sm:contents">
                        <Label
                          htmlFor="task-modal-priority"
                          className="text-[13px] font-semibold leading-snug sm:col-start-1 sm:row-start-1 sm:self-end"
                        >
                          Priorité
                        </Label>
                        <div className="min-w-0 sm:col-start-1 sm:row-start-2">
                          <Select
                            value={priority}
                            onValueChange={(v) =>
                              void commitPriority(v as TaskPriority)
                            }
                            disabled={savingPriority}
                          >
                            <SelectTrigger
                              id="task-modal-priority"
                              className="h-10 w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Basse</SelectItem>
                              <SelectItem value="medium">Moyenne</SelectItem>
                              <SelectItem value="high">Haute</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:contents">
                        <Label
                          htmlFor="task-modal-due"
                          className="text-[13px] font-semibold leading-snug sm:col-start-2 sm:row-start-1 sm:self-end"
                        >
                          Échéance (optionnel)
                        </Label>
                        <div className="min-w-0 sm:col-start-2 sm:row-start-2">
                          <Input
                            id="task-modal-due"
                            type="datetime-local"
                            value={dueLocal}
                            onChange={(e) => setDueLocal(e.target.value)}
                            onBlur={() => void commitDue()}
                            disabled={savingDue}
                            className="h-10 w-full py-0 leading-normal shadow-sm"
                          />
                        </div>
                        <div className="sm:col-start-2 sm:row-start-3">
                          {dueHint ? (
                            <p
                              className={cn(
                                "flex flex-wrap items-center gap-1.5 text-xs",
                                dueUrgency === "overdue" &&
                                  "font-medium text-destructive",
                                dueUrgency === "soon" &&
                                  "font-medium text-destructive"
                              )}
                            >
                              {dueUrgency === "overdue" ? (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 shrink-0"
                                  aria-hidden
                                />
                              ) : null}
                              {dueHint}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section
                    className="rounded-xl border border-border/60 bg-card px-4 py-5 shadow-md shadow-black/[0.05] ring-1 ring-black/[0.03] sm:px-5"
                    aria-labelledby="task-deps-heading"
                  >
                    <div className="border-b border-border/60 pb-4">
                      <h3 id="task-deps-heading" className={sectionLabel}>
                        Dépendances
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Bloquée tant qu&apos;une tâche liée n&apos;est pas en
                        colonne « Terminé ».
                      </p>
                    </div>
                    <div className="space-y-3 py-4">
                      {display.depends_on.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Aucune dépendance.
                        </p>
                      ) : (
                        <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-background/80">
                          {display.depends_on.map((d) => (
                            <li
                              key={d.id}
                              className="flex items-start justify-between gap-3 px-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {d.title}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant={statusVariant(d.status)}
                                    className="text-[10px]"
                                  >
                                    {statusLabel[d.status]}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {d.board_column.name}
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                disabled={depsSaving}
                                aria-label={`Retirer la dépendance ${d.title}`}
                                onClick={() => removeDependency(d.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-3 border-t border-border/60 pt-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Label htmlFor="add-dep" className={sectionLabel}>
                            Ajouter une bloquante
                          </Label>
                          <Select
                            value={addDepId || undefined}
                            onValueChange={setAddDepId}
                            disabled={
                              !workspaceId ||
                              pickable.length === 0 ||
                              depsSaving
                            }
                          >
                            <SelectTrigger id="add-dep" className="w-full">
                              <SelectValue placeholder="Choisir une tâche…" />
                            </SelectTrigger>
                            <SelectContent className="max-h-56">
                              {pickable.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  <span className="truncate">
                                    #{c.id} · {c.title}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="shrink-0 sm:mb-0.5"
                          disabled={!addDepId || depsSaving}
                          onClick={() => addDependency()}
                        >
                          {depsSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Ajouter"
                          )}
                        </Button>
                      </div>
                      {!workspaceId ? (
                        <p className="text-xs text-muted-foreground">
                          Sélectionnez un espace pour gérer les dépendances.
                        </p>
                      ) : null}
                    </div>
                  </section>

                  <Separator className="bg-border/60" />
                  <CommentSection taskId={display.id} open={open} />
                </div>
              </div>
              <div className="shrink-0 border-t border-border/60 bg-muted/40 px-5 py-4">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      onDelete(display)
                      onOpenChange(false)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
