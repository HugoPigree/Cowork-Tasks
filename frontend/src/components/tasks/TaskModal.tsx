import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Pencil, Trash2, X } from "lucide-react"
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
import { ApiError, tasksApi } from "@/lib/api"
import { getDueUrgency } from "@/lib/dueDateUrgency"
import type { Task, TaskPriority, TaskStatus } from "@/lib/types"
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
  if (p === "medium") return "default"
  return "outline"
}

function withTaskDefaults(t: Task): Task {
  return {
    ...t,
    depends_on: t.depends_on ?? [],
    is_blocked: Boolean(t.is_blocked),
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  workspaceId: number | null
  onUpdated: () => Promise<void> | void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskModal({
  open,
  onOpenChange,
  task,
  workspaceId,
  onUpdated,
  onEdit,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("")
  const [savingTitle, setSavingTitle] = useState(false)
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
    setDetail(withTaskDefaults(task))
    setDetailLoading(true)
    void (async () => {
      try {
        const fresh = await tasksApi.get(task.id)
        const normalized = withTaskDefaults(fresh)
        setDetail(normalized)
        setTitle(normalized.title)
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

  async function commitTitle() {
    if (!detail) return
    const next = title.trim()
    if (!next || next === detail.title) return
    setSavingTitle(true)
    try {
      await tasksApi.patch(detail.id, { title: next })
      toast.success("Titre mis à jour")
      await onUpdated()
      const fresh = await tasksApi.get(detail.id)
      setDetail(withTaskDefaults(fresh))
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
      setTitle(detail.title)
    } finally {
      setSavingTitle(false)
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
    "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,880px)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {display ? (
          <>
            <DialogHeader className="shrink-0 space-y-3 border-b border-border/50 bg-muted/20 px-5 py-4 text-left">
              <div className="flex flex-wrap items-center gap-2">
                {detailLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
                <Badge variant={statusVariant(display.status)}>
                  {statusLabel[display.status]}
                </Badge>
                <Badge variant={priorityVariant(display.priority)}>
                  {priorityLabel[display.priority]}
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
              <div className="space-y-2 pr-8">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => void commitTitle()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void commitTitle()
                    }
                  }}
                  className="border-transparent bg-transparent px-0 text-xl font-semibold leading-tight tracking-tight shadow-none focus-visible:ring-0"
                  disabled={savingTitle}
                />
                <DialogDescription className="text-left text-sm text-foreground/80">
                  <span className="text-muted-foreground">Échéance :</span>{" "}
                  {display.due_date ? (
                    <span
                      className={cn(
                        "inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 align-middle",
                        dueUrgency === "soon" && "font-semibold text-destructive",
                        dueUrgency === "overdue" && "font-semibold text-destructive"
                      )}
                    >
                      {dueUrgency === "overdue" ? (
                        <AlertTriangle
                          className="inline h-4 w-4 shrink-0 text-destructive"
                          aria-hidden
                        />
                      ) : null}
                      {new Date(display.due_date).toLocaleString("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {dueUrgency === "overdue" ? (
                        <Badge variant="destructive" className="text-[10px]">
                          En retard
                        </Badge>
                      ) : dueUrgency === "soon" ? (
                        <Badge
                          variant="outline"
                          className="border-destructive/45 text-[10px] text-destructive"
                        >
                          Sous 24 h
                        </Badge>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}{" "}
                  <span className="mx-1.5 text-border">·</span>
                  <span className="text-muted-foreground">Assigné :</span>{" "}
                  {display.assignee
                    ? `@${display.assignee.username}`
                    : "non assigné"}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5">
                <div className="space-y-8 pb-2">
                  <section className="space-y-2">
                    <h3 className={sectionLabel}>Description</h3>
                    <p className="border-l-2 border-primary/25 pl-3 text-[15px] leading-relaxed text-foreground">
                      {display.description?.trim()
                        ? display.description
                        : "Aucune description."}
                    </p>
                  </section>

                  <section
                    className="rounded-xl border-2 border-border/70 bg-muted/35 px-4 py-5 shadow-sm ring-1 ring-black/[0.04] sm:px-5"
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
              <div className="shrink-0 border-t border-border/60 bg-muted/25 px-5 py-3.5">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      onEdit(display)
                      onOpenChange(false)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier tout
                  </Button>
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
