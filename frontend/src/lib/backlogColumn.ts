import type { BoardColumn } from "@/lib/types"

/** Colonne « Backlog » si elle existe, sinon la première colonne du tableau. */
export function backlogColumnId(columns: BoardColumn[]): number | null {
  if (columns.length === 0) return null
  const byName = columns.find(
    (c) => c.name.trim().toLowerCase() === "backlog"
  )
  if (byName) return byName.id
  const sorted = [...columns].sort((a, b) => a.position - b.position)
  return sorted[0]?.id ?? null
}
