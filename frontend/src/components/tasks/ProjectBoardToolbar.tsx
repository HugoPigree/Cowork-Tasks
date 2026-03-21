import { Columns3, Github, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WorkspaceMember } from "@/lib/types"
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
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground line-clamp-2">
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
            "flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 dark:bg-muted/15"
          )}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher par titre…"
              className="h-9 border-border/60 bg-background pl-9 text-sm"
              aria-label="Rechercher une tâche par titre"
            />
          </div>
          <div className="w-full shrink-0 sm:w-[200px]">
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
        </div>
      </div>
    </div>
  )
}
