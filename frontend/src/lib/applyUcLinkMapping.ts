import { ApiError, tasksApi } from "@/lib/api"
import { extractTitleCode } from "@/lib/ucImportValidation"
import type { Task } from "@/lib/types"
import type { UcLinkMapping } from "@/lib/ucLinkMapping"

export type ApplyUcLinkResult = {
  applied: number
  failures: { uc: string; message: string }[]
}

async function fetchAllRootTasks(workspaceId: number): Promise<Task[]> {
  const out: Task[] = []
  let page = 1
  const pageSize = 200
  for (;;) {
    const res = await tasksApi.list({
      workspace: workspaceId,
      root_only: true,
      page,
      page_size: pageSize,
    })
    out.push(...res.results)
    if (!res.next || res.results.length === 0) break
    page += 1
  }
  return out
}

function buildCodeIndex(tasks: Task[]): {
  codeToTask: Map<string, Task>
  duplicateCodes: string[]
} {
  const codeToTask = new Map<string, Task>()
  const duplicateCodes: string[] = []
  for (const t of tasks) {
    const code = extractTitleCode(t.title)
    if (!code) continue
    if (codeToTask.has(code)) {
      if (!duplicateCodes.includes(code)) duplicateCodes.push(code)
      continue
    }
    codeToTask.set(code, t)
  }
  return { codeToTask, duplicateCodes }
}

/**
 * Met à jour `depends_on` sur chaque carte UC listée, d’après les codes titre
 * des tâches racines déjà présentes dans l’espace.
 */
export async function applyUcLinkMapping(
  workspaceId: number,
  mapping: UcLinkMapping
): Promise<ApplyUcLinkResult> {
  const failures: { uc: string; message: string }[] = []
  let applied = 0

  let tasks: Task[]
  try {
    tasks = await fetchAllRootTasks(workspaceId)
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "Impossible de charger les tâches."
    return { applied: 0, failures: [{ uc: "(chargement)", message: msg }] }
  }

  const { codeToTask, duplicateCodes } = buildCodeIndex(tasks)
  if (duplicateCodes.length > 0) {
    return {
      applied: 0,
      failures: [
        {
          uc: "(index)",
          message: `Plusieurs tâches partagent le même code titre : ${duplicateCodes.join(", ")}. Renommez-les pour continuer.`,
        },
      ],
    }
  }

  for (const [ucCode, refs] of Object.entries(mapping)) {
    const ucTask = codeToTask.get(ucCode)
    if (!ucTask) {
      failures.push({
        uc: ucCode,
        message: `Aucune tâche racine dont le titre commence par « ${ucCode}: » dans cet espace.`,
      })
      continue
    }
    if (ucTask.workspace !== workspaceId) {
      failures.push({ uc: ucCode, message: "Tâche hors espace (anormal)." })
      continue
    }

    const missing: string[] = []
    const depIds: number[] = []
    const seen = new Set<number>()
    let selfDep = false
    for (const ref of refs) {
      const dep = codeToTask.get(ref)
      if (!dep) {
        missing.push(ref)
        continue
      }
      if (dep.id === ucTask.id) {
        selfDep = true
        break
      }
      if (!seen.has(dep.id)) {
        seen.add(dep.id)
        depIds.push(dep.id)
      }
    }

    if (selfDep) {
      failures.push({
        uc: ucCode,
        message: "Une UC ne peut pas dépendre d’elle-même.",
      })
      continue
    }
    if (missing.length > 0) {
      failures.push({
        uc: ucCode,
        message: `Prérequis introuvables : ${missing.join(", ")} (titres attendus : « CODE: … »).`,
      })
      continue
    }

    try {
      await tasksApi.patch(ucTask.id, { depends_on_ids: depIds })
      applied += 1
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Erreur réseau ou serveur."
      failures.push({ uc: ucCode, message: msg })
    }
  }

  return { applied, failures }
}
