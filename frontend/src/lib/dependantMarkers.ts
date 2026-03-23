import type { Task } from "@/lib/types"
import { extractTitleCode } from "@/lib/ucImportValidation"

/** Indique qu’une tâche est prérequis d’une autre carte (ex. UC-01). */
export type DependantMarker = {
  /** Ex. UC-01 ou extrait court du titre parent */
  label: string
  /** Titre complet de la carte parent (tooltip) */
  parentTitle: string
  /** Id de la carte qui déclare ce prérequis */
  parentTaskId: number
}

/**
 * Pour chaque id de tâche, liste des cartes qui la déclarent en `depends_on`
 * (même espace / même liste Kanban).
 */
export function buildDependantMarkers(tasks: Task[]): Map<string, DependantMarker[]> {
  const byDep = new Map<string, Map<number, DependantMarker>>()
  for (const parent of tasks) {
    const deps = parent.depends_on ?? []
    if (deps.length === 0) continue
    const code = extractTitleCode(parent.title)
    const label =
      code ??
      (parent.title.length > 36
        ? `${parent.title.slice(0, 34).trim()}…`
        : parent.title)
    const marker: DependantMarker = {
      label,
      parentTitle: parent.title,
      parentTaskId: parent.id,
    }
    for (const d of deps) {
      const sid = String(d.id)
      if (!byDep.has(sid)) byDep.set(sid, new Map())
      byDep.get(sid)!.set(parent.id, marker)
    }
  }
  const out = new Map<string, DependantMarker[]>()
  for (const [sid, parentMap] of byDep) {
    out.set(
      sid,
      [...parentMap.values()].sort((a, b) =>
        a.label.localeCompare(b.label, "fr", { numeric: true })
      )
    )
  }
  return out
}
