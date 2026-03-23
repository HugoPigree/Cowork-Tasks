import type { TaskPriority } from "@/lib/types"

const ALLOWED_STATUS = "À faire"
const ALLOWED_PRIORITIES = ["Haute", "Moyenne", "Basse"] as const

const T_POSITION_REF = /^[Tt]-(\d+)$/

export type ImportedUc = {
  title: string
  description: string
  status: string
  priority: string
  assignee: null
  dueDate: null
  /** Références vers d’autres UC du même import (ex. "UC-01", "T-02"). */
  dependencies: string[]
  comments: unknown[]
  /** Optionnel : identifiant stable pour les lier depuis "dependencies" (ex. "T-01"). */
  ref?: string
}

export type ValidateUcJsonResult =
  | { ok: true; items: ImportedUc[] }
  | { ok: false; message: string }

export type ValidateUcDependencyResult =
  | { ok: true; blockerIndicesByItem: number[][] }
  | { ok: false; message: string }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Ex. "UC-01: Titre" → "UC-01" */
export function extractTitleCode(title: string): string | null {
  const m = title.trim().match(/^([A-Za-z]+-\d+)/)
  return m ? m[1].toUpperCase() : null
}

function dependencyGraphHasCycle(blockerIndicesByItem: number[][]): boolean {
  const n = blockerIndicesByItem.length
  const visiting = new Set<number>()
  const visited = new Set<number>()

  function dfs(u: number): boolean {
    if (visiting.has(u)) return true
    if (visited.has(u)) return false
    visiting.add(u)
    for (const v of blockerIndicesByItem[u]) {
      if (dfs(v)) return true
    }
    visiting.delete(u)
    visited.add(u)
    return false
  }

  for (let i = 0; i < n; i++) {
    if (!visited.has(i) && dfs(i)) return true
  }
  return false
}

/**
 * Résout les chaînes "dependencies" vers des indices dans le tableau `items`
 * (même ordre que le JSON). Détecte les références invalides et les cycles.
 */
export function validateUcDependencyGraph(
  items: ImportedUc[]
): ValidateUcDependencyResult {
  const n = items.length
  const refToIndex = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const r = items[i].ref
    if (r === undefined) continue
    const key = r.trim().toLowerCase()
    if (!key) {
      return {
        ok: false,
        message: `UC #${i + 1} : "ref" ne peut pas être vide.`,
      }
    }
    if (refToIndex.has(key)) {
      return {
        ok: false,
        message: `La référence "ref" "${r.trim()}" est utilisée plusieurs fois.`,
      }
    }
    refToIndex.set(key, i)
  }

  const codeToIndex = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const c = extractTitleCode(items[i].title)
    if (!c) continue
    if (codeToIndex.has(c)) {
      return {
        ok: false,
        message: `Plusieurs UC partagent le code titre "${c}" (préfixe avant ":"). Rendez les titres uniques.`,
      }
    }
    codeToIndex.set(c, i)
  }

  const blockerIndicesByItem: number[][] = []

  for (let i = 0; i < n; i++) {
    const seen = new Set<number>()
    const blockers: number[] = []
    const deps = items[i].dependencies

    for (const raw of deps) {
      const d = raw.trim()
      if (!d) {
        return {
          ok: false,
          message: `UC #${i + 1} ("${items[i].title}") : une dépendance vide n’est pas autorisée.`,
        }
      }

      const refKey = d.toLowerCase()
      let j: number | undefined

      if (refToIndex.has(refKey)) {
        j = refToIndex.get(refKey)
      } else {
        const tm = d.match(T_POSITION_REF)
        if (tm) {
          const num = parseInt(tm[1], 10)
          const idx = num - 1
          if (idx < 0 || idx >= n) {
            return {
              ok: false,
              message: `UC #${i + 1} ("${items[i].title}") : "${d}" est hors plage (le tableau a ${n} entrée(s), utiliser T-1 … T-${n}).`,
            }
          }
          j = idx
        } else {
          const upper = d.toUpperCase()
          if (codeToIndex.has(upper)) {
            j = codeToIndex.get(upper)
          } else {
            const prefixMatches: number[] = []
            for (let k = 0; k < n; k++) {
              if (k === i) continue
              if (items[k].title.trim().startsWith(d)) prefixMatches.push(k)
            }
            if (prefixMatches.length === 1) j = prefixMatches[0]
            else if (prefixMatches.length > 1) {
              return {
                ok: false,
                message: `UC #${i + 1} ("${items[i].title}") : la dépendance "${d}" est ambiguë (plusieurs titres commencent ainsi). Utilisez le code UC (ex. UC-01) ou T-n.`,
              }
            }
          }
        }
      }

      if (j === undefined) {
        return {
          ok: false,
          message: `UC #${i + 1} ("${items[i].title}") : dépendance inconnue "${raw}". Utilisez un "ref" défini dans l’import, un code titre (ex. UC-02), ou T-n (position 1…${n}).`,
        }
      }

      if (j === i) {
        return {
          ok: false,
          message: `UC #${i + 1} ("${items[i].title}") : une tâche ne peut pas dépendre d’elle-même.`,
        }
      }

      if (!seen.has(j)) {
        seen.add(j)
        blockers.push(j)
      }
    }

    blockerIndicesByItem.push(blockers)
  }

  if (dependencyGraphHasCycle(blockerIndicesByItem)) {
    return {
      ok: false,
      message:
        "Les dépendances forment un cycle (A bloque B qui bloque A, etc.). Corrigez le graphe.",
    }
  }

  return { ok: true, blockerIndicesByItem }
}

/**
 * Parse et valide le JSON produit par ChatGPT selon les règles métier.
 */
export function validateImportedUcJson(raw: string): ValidateUcJsonResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, message: "Collez d’abord un JSON (tableau d’UC)." }
  }

  let data: unknown
  try {
    data = JSON.parse(trimmed) as unknown
  } catch {
    return {
      ok: false,
      message:
        "JSON invalide : syntaxe incorrecte. Vérifiez qu’il n’y a pas de texte avant ou après le tableau.",
    }
  }

  if (!Array.isArray(data)) {
    return {
      ok: false,
      message: "Le JSON doit être un tableau [...], pas un objet seul.",
    }
  }

  return validateImportedUcArray(data as unknown[])
}

/**
 * Valide un tableau d’UC déjà parsé (JSON ou saisie après prévisualisation).
 */
export function validateImportedUcArray(data: unknown[]): ValidateUcJsonResult {
  if (data.length === 0) {
    return { ok: false, message: "Le tableau ne contient aucune UC." }
  }

  const items: ImportedUc[] = []

  for (let i = 0; i < data.length; i++) {
    const el = data[i]
    const prefix = `UC #${i + 1}`

    if (!isPlainObject(el)) {
      return {
        ok: false,
        message: `${prefix} : chaque entrée doit être un objet { ... }.`,
      }
    }

    const title = el.title
    const description = el.description
    const status = el.status
    const priority = el.priority
    const assignee = el.assignee
    const dueDate = el.dueDate
    const dependencies = el.dependencies
    const comments = el.comments
    const refRaw = el.ref

    if (typeof title !== "string" || !title.trim()) {
      return {
        ok: false,
        message: `${prefix} : le champ "title" est obligatoire (chaîne non vide).`,
      }
    }

    if (typeof description !== "string") {
      return {
        ok: false,
        message: `${prefix} : le champ "description" doit être une chaîne.`,
      }
    }

    if (status !== ALLOWED_STATUS) {
      return {
        ok: false,
        message: `${prefix} : "status" doit être exactement "${ALLOWED_STATUS}" (reçu : ${JSON.stringify(status)}).`,
      }
    }

    if (
      typeof priority !== "string" ||
      !ALLOWED_PRIORITIES.includes(
        priority as (typeof ALLOWED_PRIORITIES)[number]
      )
    ) {
      return {
        ok: false,
        message: `${prefix} : "priority" doit être "Haute", "Moyenne" ou "Basse".`,
      }
    }

    if (assignee !== null) {
      return {
        ok: false,
        message: `${prefix} : "assignee" doit être null.`,
      }
    }

    if (dueDate !== null) {
      return {
        ok: false,
        message: `${prefix} : "dueDate" doit être null.`,
      }
    }

    if (!Array.isArray(dependencies)) {
      return {
        ok: false,
        message: `${prefix} : "dependencies" doit être un tableau de chaînes (ex. ["UC-01","T-02"] ou []).`,
      }
    }

    const depStrings: string[] = []
    for (let di = 0; di < dependencies.length; di++) {
      const dep = dependencies[di]
      if (typeof dep !== "string") {
        return {
          ok: false,
          message: `${prefix} : chaque entrée de "dependencies" doit être une chaîne (index ${di}).`,
        }
      }
      depStrings.push(dep)
    }

    if (!Array.isArray(comments)) {
      return {
        ok: false,
        message: `${prefix} : "comments" doit être un tableau [].`,
      }
    }

    let ref: string | undefined
    if (refRaw !== undefined && refRaw !== null) {
      if (typeof refRaw !== "string" || !refRaw.trim()) {
        return {
          ok: false,
          message: `${prefix} : "ref" doit être une chaîne non vide si présent.`,
        }
      }
      ref = refRaw.trim()
    }

    items.push({
      title: title.trim(),
      description,
      status,
      priority,
      assignee: null,
      dueDate: null,
      dependencies: depStrings,
      comments,
      ...(ref !== undefined ? { ref } : {}),
    })
  }

  const graph = validateUcDependencyGraph(items)
  if (!graph.ok) {
    return { ok: false, message: graph.message }
  }

  return { ok: true, items }
}

export function mapUcPriorityToApi(p: ImportedUc["priority"]): TaskPriority {
  if (p === "Haute") return "high"
  if (p === "Basse") return "low"
  return "medium"
}
