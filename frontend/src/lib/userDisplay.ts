import type { UserBrief } from "@/lib/types"

export function userInitials(u: UserBrief): string {
  const fn = (u.first_name ?? "").trim()
  if (fn.length >= 2) return fn.slice(0, 2).toUpperCase()
  if (fn.length === 1) return (fn + (u.username[0] ?? "")).toUpperCase()
  return (u.username || "?").slice(0, 2).toUpperCase()
}
