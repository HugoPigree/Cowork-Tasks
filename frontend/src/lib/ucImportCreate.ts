import { ApiError, tasksApi } from "@/lib/api"
import {
  mapUcPriorityToApi,
  validateUcDependencyGraph,
  type ImportedUc,
} from "@/lib/ucImportValidation"

export type CreateUcsResult = {
  created: number
  failures: { title: string; message: string }[]
}

/**
 * Ordre de création : toutes les tâches bloquantes d’une UC sont créées avant elle
 * (tri topologique), pour pouvoir envoyer `depends_on_ids` dès le POST.
 */
function creationOrder(blockerIndicesByItem: number[][]): number[] {
  const n = blockerIndicesByItem.length
  const inDegree = blockerIndicesByItem.map((b) => b.length)
  const dependents: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (const j of blockerIndicesByItem[i]) {
      dependents[j].push(i)
    }
  }
  const queue: number[] = []
  for (let i = 0; i < n; i++) {
    if (inDegree[i] === 0) queue.push(i)
  }
  const order: number[] = []
  while (queue.length > 0) {
    const u = queue.shift()!
    order.push(u)
    for (const v of dependents[u]) {
      inDegree[v]--
      if (inDegree[v] === 0) queue.push(v)
    }
  }
  return order
}

/**
 * Crée les UC importées dans le backlog. Les `dependencies` du JSON sont des repères
 * (UC-01, T-2…) : on les valide puis on crée dans l’ordre des prérequis ; chaque
 * nouvelle tâche reçoit les IDs serveur des bloquantes déjà créées — pas besoin
 * d’éditer les dépendances à la main après coup.
 */
export async function createUCs(
  ucs: ImportedUc[],
  workspaceId: number,
  boardColumnId: number
): Promise<CreateUcsResult> {
  const failures: { title: string; message: string }[] = []
  const depGraph = validateUcDependencyGraph(ucs)
  if (!depGraph.ok) {
    return {
      created: 0,
      failures: [{ title: "(validation)", message: depGraph.message }],
    }
  }
  const { blockerIndicesByItem } = depGraph
  const n = ucs.length

  const order = creationOrder(blockerIndicesByItem)
  if (order.length !== n) {
    return {
      created: 0,
      failures: [
        {
          title: "(validation)",
          message:
            "Ordre de création impossible (cycle ou graphe invalide). Vérifiez les dépendances.",
        },
      ],
    }
  }

  const taskIds: (number | null)[] = new Array(n).fill(null)
  let created = 0

  for (const i of order) {
    const uc = ucs[i]
    const blockerIdxs = blockerIndicesByItem[i]
    const depIds: number[] = []
    let missingBlocker = false
    for (const j of blockerIdxs) {
      const bid = taskIds[j]
      if (bid == null) {
        missingBlocker = true
        break
      }
      depIds.push(bid)
    }

    try {
      const task = await tasksApi.create({
        workspace: workspaceId,
        title: uc.title,
        description: uc.description,
        priority: mapUcPriorityToApi(uc.priority),
        due_date: null,
        assignee_id: null,
        board_column_id: boardColumnId,
        ...(depIds.length > 0 && !missingBlocker
          ? { depends_on_ids: depIds }
          : {}),
      })
      taskIds[i] = task.id
      created++
      if (missingBlocker && blockerIdxs.length > 0) {
        failures.push({
          title: uc.title,
          message:
            "Créée sans liens de dépendance : une tâche prérequis n’a pas pu être créée.",
        })
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Erreur réseau ou serveur"
      failures.push({ title: uc.title, message })
    }
  }

  return { created, failures }
}
