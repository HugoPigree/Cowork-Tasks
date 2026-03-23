import type { TaskPriority } from "@/lib/types"

const ALLOWED_STATUS = "À faire"
const ALLOWED_PRIORITIES = ["Haute", "Moyenne", "Basse"] as const

export type ImportedUc = {
  title: string
  description: string
  status: string
  priority: string
  assignee: null
  dueDate: null
  dependencies: unknown[]
  comments: unknown[]
}

export type ValidateUcJsonResult =
  | { ok: true; items: ImportedUc[] }
  | { ok: false; message: string }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
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
        message: `${prefix} : "dependencies" doit être un tableau [].`,
      }
    }

    if (!Array.isArray(comments)) {
      return {
        ok: false,
        message: `${prefix} : "comments" doit être un tableau [].`,
      }
    }

    items.push({
      title: title.trim(),
      description,
      status,
      priority,
      assignee: null,
      dueDate: null,
      dependencies,
      comments,
    })
  }

  return { ok: true, items }
}

export function mapUcPriorityToApi(p: ImportedUc["priority"]): TaskPriority {
  if (p === "Haute") return "high"
  if (p === "Basse") return "low"
  return "medium"
}
