import type { TaskStatus } from "@/lib/types"

export type DueUrgency = "none" | "soon" | "overdue"

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * - overdue : échéance dépassée (maintenant)
 * - soon : échéance dans les prochaines 24 h (pas encore en retard)
 */
export function getDueUrgency(
  iso: string | null | undefined,
  opts?: { taskStatus?: TaskStatus }
): DueUrgency {
  if (!iso?.trim()) return "none"
  if (opts?.taskStatus === "done") return "none"
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return "none"
  const now = Date.now()
  if (t < now) return "overdue"
  if (t <= now + MS_PER_DAY) return "soon"
  return "none"
}
