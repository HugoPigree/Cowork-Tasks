import type { CSSProperties, ReactNode } from "react"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  Link2,
  Plus,
} from "lucide-react"
import { UserAvatar } from "@/components/UserAvatar"
import { getDueUrgency } from "@/lib/dueDateUrgency"
import type { DependantMarker } from "@/lib/dependantMarkers"
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
      className:
        "border border-border/90 bg-muted/70 text-foreground/80 dark:bg-muted/50 dark:text-foreground/75",
    }
  return {
    label: "Priorité basse",
    className: "border border-border bg-muted/80 text-muted-foreground",
  }
}

function BlockedPadlockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
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
  /** Cartes qui listent cette tâche en prérequis (ex. UC-01) — utile hors colonne du parent. */
  dependantMarkers?: DependantMarker[]
  onOpen?: () => void
  /** Panneau UC : replier / déplier les tâches liées (depends_on). */
  ucExpand?: {
    expanded: boolean
    onToggle: () => void
    depCount: number
  }
  /** Contenu sous la carte (ex. liste imbriquée sortable) — rendu par le parent Kanban. */
  children?: ReactNode
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
  dependantMarkers,
  onOpen,
  ucExpand,
  children,
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
  const showDependsSummary =
    Boolean(dependsLine) &&
    !(ucExpand?.expanded && dependsOn.length > 0)
  const progressPct =
    subs > 0 ? Math.min(100, Math.round((0 / subs) * 100)) : 0

  return (
    <div
      style={style}
      className={cn(
        "group rounded-xl border border-border/70 bg-card text-card-foreground shadow-sm shadow-black/[0.05] transition-[box-shadow,transform,ring,opacity] duration-200",
        "hover:border-border hover:shadow-md",
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
        <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            className="cursor-grab touch-none rounded border border-transparent p-0.5 text-muted-foreground opacity-60 transition-opacity hover:border-border hover:bg-muted/60 hover:opacity-100 active:cursor-grabbing"
            aria-label="Glisser la tâche"
            {...dragAttributes}
            {...dragListeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {ucExpand ? (
            <button
              type="button"
              disabled={ucExpand.depCount === 0}
              className={cn(
                "rounded border border-border/60 bg-muted/40 p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                ucExpand.depCount === 0 && "cursor-not-allowed opacity-40"
              )}
              aria-expanded={ucExpand.expanded}
              aria-label={
                ucExpand.depCount === 0
                  ? "Aucune dépendance"
                  : ucExpand.expanded
                    ? "Masquer les tâches liées"
                    : `Afficher les ${ucExpand.depCount} tâche${ucExpand.depCount > 1 ? "s" : ""} liées`
              }
              onClick={(e) => {
                e.stopPropagation()
                ucExpand.onToggle()
              }}
            >
              {ucExpand.expanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
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
          {dependantMarkers && dependantMarkers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="sr-only">Liée comme prérequis à :</span>
              {dependantMarkers.map((m) => (
                <span
                  key={m.parentTaskId}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-violet-900/40 bg-violet-200 px-2 py-1 font-mono text-[11px] font-bold leading-none text-violet-950 shadow-sm dark:border-violet-300/50 dark:bg-violet-950 dark:text-zinc-50"
                  title={m.parentTitle}
                >
                  <Link2
                    className="h-3 w-3 shrink-0 text-violet-800 dark:text-violet-200"
                    aria-hidden
                  />
                  <span className="min-w-0 truncate text-violet-950 dark:text-zinc-50">
                    {m.label}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
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
                className="inline-flex shrink-0 text-muted-foreground"
                title={blockedTooltip}
                role="img"
                aria-label={blockedTooltip}
              >
                <BlockedPadlockIcon className="h-3.5 w-3.5" />
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
            {task.sprint ? (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-muted/35 px-2 py-0.5 text-[11px] font-medium text-foreground"
                title={task.sprint.name}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                  style={{ backgroundColor: task.sprint.color }}
                  aria-hidden
                />
                <span className="truncate">{task.sprint.name}</span>
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
          {showDependsSummary ? (
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
      {children ? (
        <div className="border-t border-border/50 px-3 pb-3 pt-0">{children}</div>
      ) : null}
    </div>
  )
}
