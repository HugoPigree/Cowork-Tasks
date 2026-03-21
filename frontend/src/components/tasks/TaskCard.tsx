import type { CSSProperties } from "react"
import { AlertTriangle, Calendar, CheckCircle2, GripVertical, Lock } from "lucide-react"
import { UserAvatar } from "@/components/UserAvatar"
import { getDueUrgency } from "@/lib/dueDateUrgency"
import type { Task, TaskPriority, TaskStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const statusLabel: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
}

const statusDot: Record<TaskStatus, string> = {
  todo: "bg-emerald-500",
  in_progress: "bg-amber-500",
  done: "bg-orange-500",
}

function priorityPill(p: TaskPriority): { label: string; className: string } {
  if (p === "high")
    return {
      label: "Priorité haute",
      className:
        "border border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/20",
    }
  if (p === "medium")
    return {
      label: "Priorité moyenne",
      className: "border border-primary/30 bg-primary/10 text-primary",
    }
  return {
    label: "Priorité basse",
    className: "border border-border bg-muted/80 text-muted-foreground",
  }
}

function formatDue(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export type TaskCardProps = {
  task: Task
  style?: CSSProperties
  className?: string
  dragAttributes?: Record<string, unknown>
  dragListeners?: Record<string, unknown>
  isDragging?: boolean
  /** Cible de dépôt au survol (liste triable) */
  isDropTarget?: boolean
  selected?: boolean
  /** Ligne type repo/issue (ex. nom du projet) */
  workspaceName?: string
  /** Statut affiché en pied de carte si pas de `displayColumn` */
  displayStatus?: TaskStatus
  /** Kanban : pied de carte = nom + couleur de la colonne (plus fidèle que le statut grossier) */
  displayColumn?: { name: string; color: string }
  onOpen?: () => void
}

export function TaskCard({
  task,
  style,
  className,
  dragAttributes,
  dragListeners,
  isDragging,
  isDropTarget,
  selected,
  workspaceName,
  displayStatus,
  displayColumn,
  onOpen,
}: TaskCardProps) {
  const footerStatus = displayStatus ?? task.status
  const due = formatDue(task.due_date)
  const dueUrgency = getDueUrgency(task.due_date, { taskStatus: task.status })
  const ctx = (workspaceName ?? "Projet").slice(0, 28)
  const pPill = priorityPill(task.priority)
  const subs = task.subtask_count
  const dependsOn = task.depends_on ?? []
  const isBlocked = Boolean(task.is_blocked)
  const blockingTitles = dependsOn
    .filter((d) => d.board_column.maps_to_status !== "done")
    .map((d) => d.title)
  const blockedTooltip =
    blockingTitles.length > 0
      ? `En attente de : ${blockingTitles.join(", ")}`
      : "Tâche bloquée par des dépendances non terminées"
  const dependsLine =
    dependsOn.length > 0
      ? dependsOn.map((d) => d.title).join(" · ")
      : ""
  const progressPct =
    subs > 0 ? Math.min(100, Math.round((0 / subs) * 100)) : 0

  return (
    <div
      style={style}
      className={cn(
        "group rounded-md border border-border/80 bg-card text-card-foreground shadow-sm transition-[box-shadow,transform,ring,opacity] duration-200",
        "hover:border-border hover:shadow-md",
        isBlocked && "border-amber-500/35 opacity-[0.92]",
        selected &&
          "ring-2 ring-primary ring-offset-2 ring-offset-background dark:ring-offset-background",
        isDropTarget &&
          "ring-2 ring-primary/60 ring-offset-1 ring-offset-background",
        isDragging &&
          "pointer-events-none scale-[1.02] cursor-grabbing shadow-2xl ring-2 ring-primary/50 ring-offset-2",
        className
      )}
    >
      <div className="flex gap-2 p-3">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none rounded border border-transparent p-0.5 text-muted-foreground opacity-60 transition-opacity hover:border-border hover:bg-muted/60 hover:opacity-100 active:cursor-grabbing"
          aria-label="Glisser la tâche"
          {...dragAttributes}
          {...dragListeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <p
            className="truncate font-mono text-[11px] leading-none text-muted-foreground"
            title={`${ctx} #${task.id}`}
          >
            {ctx} <span className="text-muted-foreground/70">·</span> #{task.id}
          </p>
          <button
            type="button"
            className="w-full text-left text-sm font-semibold leading-snug tracking-tight text-foreground hover:underline"
            onClick={onOpen}
          >
            {task.title}
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                pPill.className
              )}
            >
              {pPill.label}
            </span>
            {isBlocked ? (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100"
                title={blockedTooltip}
              >
                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">
                  Bloquée par {blockingTitles.length || dependsOn.length}{" "}
                  tâche
                  {(blockingTitles.length || dependsOn.length) > 1 ? "s" : ""}
                </span>
              </span>
            ) : dependsOn.length > 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200"
                title="Toutes les dépendances sont terminées"
              >
                <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                Débloquée
              </span>
            ) : null}
            {subs > 0 ? (
              <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                {subs} sous-tâche{subs > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          {subs > 0 ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Progression (sous-tâches)</span>
                <span className="tabular-nums">
                  0 / {subs} · {progressPct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/80 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            ) : null}
          {dependsLine ? (
            <p
              className="text-[10px] leading-snug text-muted-foreground line-clamp-2"
              title={`Dépend de : ${dependsLine}`}
            >
              <span className="font-medium text-foreground/80">
                Dépend de :
              </span>{" "}
              {dependsLine}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {displayColumn ? (
                <>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
                    style={{ backgroundColor: displayColumn.color }}
                    aria-hidden
                  />
                  <span className="truncate text-[11px] text-muted-foreground">
                    {displayColumn.name}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      statusDot[footerStatus]
                    )}
                    aria-hidden
                  />
                  <span className="truncate text-[11px] text-muted-foreground">
                    {statusLabel[footerStatus]}
                  </span>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {due ? (
                <span
                  className={cn(
                    "inline-flex max-w-[min(100%,9rem)] items-center gap-0.5 truncate text-[10px]",
                    dueUrgency === "none" && "text-muted-foreground",
                    dueUrgency === "soon" &&
                      "font-semibold text-destructive dark:text-red-400",
                    dueUrgency === "overdue" &&
                      "font-semibold text-destructive dark:text-red-400"
                  )}
                  title={
                    dueUrgency === "overdue"
                      ? "Échéance dépassée"
                      : dueUrgency === "soon"
                        ? "Échéance dans moins de 24 h"
                        : undefined
                  }
                >
                  {dueUrgency === "overdue" ? (
                    <AlertTriangle
                      className="h-3 w-3 shrink-0 text-destructive"
                      aria-hidden
                    />
                  ) : (
                    <Calendar
                      className={cn(
                        "h-3 w-3 shrink-0",
                        dueUrgency === "soon" && "text-destructive"
                      )}
                      aria-hidden
                    />
                  )}
                  {due}
                </span>
              ) : null}
              {task.assignee ? (
                <span title={`@${task.assignee.username}`} className="shrink-0">
                  <UserAvatar
                    src={task.assignee.avatar}
                    username={task.assignee.username}
                    firstName={task.assignee.first_name}
                    className="!h-6 !w-6 !text-[9px] ring-1"
                  />
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
