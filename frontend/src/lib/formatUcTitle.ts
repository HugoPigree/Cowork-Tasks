const UC_TITLE_PREFIX = /^UC-\d{1,2}:\s*/i

/** Retire un préfixe UC-xx déjà présent pour éviter les doublons. */
export function stripUcPrefix(title: string): string {
  return title.replace(UC_TITLE_PREFIX, "").trim()
}

/** Libellé affiché / titre de tâche : `UC-01: …` (numérotation 1-based). */
export function formatUcTitle(indexZeroBased: number, rawTitle: string): string {
  const base = stripUcPrefix(rawTitle)
  const n = String(indexZeroBased + 1).padStart(2, "0")
  return `UC-${n}: ${base}`
}
