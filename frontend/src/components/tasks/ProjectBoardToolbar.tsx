import { Columns3, Github, Plus, Search, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Sprint, WorkspaceMember } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Préfixe https si l’utilisateur colle `github.com/...`. */
export function normalizeExternalUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

export function gitHubRepoHref(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  try {
    const u = new URL(normalizeExternalUrl(raw))
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    return u.href
  } catch {
    return null
  }
}

export type ProjectBoardToolbarProps = {
  workspaceName: string
  description?: string
  taskCount: number
  githubUrl?: string | null
  onNewTask: () => void
  searchInput: string
  onSearchChange: (value: string) => void
  filterAssignee: string
  onFilterAssignee: (value: string) => void
  /** "all" | "none" | sprint id string */
  filterSprint: string
  onFilterSprint: (value: string) => void
  sprints: Sprint[]
  onOpenSprintManager: () => void
  members: WorkspaceMember[]
}

export function ProjectBoardToolbar({
  workspaceName,
  description,
  taskCount,
  githubUrl,
  onNewTask,
  searchInput,
  onSearchChange,
  filterAssignee,
  onFilterAssignee,
  filterSprint,
  onFilterSprint,
  sprints,
  onOpenSprintManager,
  members,
}: ProjectBoardToolbarProps) {
  const repoHref = gitHubRepoHref(githubUrl ?? "")

  return (
    <div className="border-b border-border/50 bg-card px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Tableau · Kanban
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {workspaceName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <span className="font-medium text-foreground">{taskCount}</span>
                tâche{taskCount !== 1 ? "s" : ""}
              </span>
              <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/90">
                <Columns3 className="h-3.5 w-3.5" />
                Vue colonnes
              </span>
            </div>
            {description?.trim() ? (
              <p className="max-w-2xl whitespace-pre-wrap text-sm leading-[1.65] text-muted-foreground line-clamp-2">
                {description.trim()}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pt-1">
            {repoHref ? (
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a
                  href={repoHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                >
                  <Github className="h-4 w-4" />
                  Repo
                </a>
              </Button>
            ) : null}
            <Button onClick={onNewTask} size="sm" className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Nouvelle tâche
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 dark:bg-muted/15"
          )}
        >
          <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher par titre…"
              className="h-9 border-border/60 bg-background pl-9 text-sm"
              aria-label="Rechercher une tâche par titre"
            />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-0 sm:flex-1 sm:flex-row sm:gap-2">
            <div className="w-full min-w-0 sm:w-[min(100%,200px)] sm:flex-1">
              <Select value={filterAssignee} onValueChange={onFilterAssignee}>
                <SelectTrigger
                  className="h-9 border-border/60 bg-background text-sm"
                  aria-label="Filtrer par assignation"
                >
                  <SelectValue placeholder="Assignation" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">Toute l’équipe</SelectItem>
                  <SelectItem value="unassigned">Non assigné</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={String(m.user.id)}>
                      {m.user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-full min-w-0 gap-2 sm:w-[min(100%,220px)] sm:flex-1">
              <Select value={filterSprint} onValueChange={onFilterSprint}>
                <SelectTrigger
                  className="h-9 flex-1 border-border/60 bg-background text-sm"
                  aria-label="Filtrer par sprint"
                >
                  <SelectValue placeholder="Sprint" />
                </SelectTrigger>
                <SelectContent align="end" className="max-h-72">
                  <SelectItem value="all">Tous les sprints</SelectItem>
                  <SelectItem value="none">Sans sprint</SelectItem>
                  {sprints.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                          aria-hidden
                        />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1 px-2.5 text-xs"
                onClick={onOpenSprintManager}
                title="Gérer les sprints"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sprints</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
