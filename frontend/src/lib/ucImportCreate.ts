import { ApiError, tasksApi } from "@/lib/api"
import { mapUcPriorityToApi, type ImportedUc } from "@/lib/ucImportValidation"

export type CreateUcsResult = {
  created: number
  failures: { title: string; message: string }[]
}

/**
 * Crée les UC importées dans le backlog (colonne cible fournie).
 */
export async function createUCs(
  ucs: ImportedUc[],
  workspaceId: number,
  boardColumnId: number
): Promise<CreateUcsResult> {
  const failures: { title: string; message: string }[] = []
  let created = 0
  for (const uc of ucs) {
    try {
      await tasksApi.create({
        workspace: workspaceId,
        title: uc.title,
        description: uc.description,
        priority: mapUcPriorityToApi(uc.priority),
        due_date: null,
        assignee_id: null,
        board_column_id: boardColumnId,
      })
      created++
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Erreur réseau ou serveur"
      failures.push({ title: uc.title, message })
    }
  }
  return { created, failures }
}
