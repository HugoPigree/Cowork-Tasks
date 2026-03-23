import { z } from "zod"

const taskPrioritySchema = z.enum(["low", "medium", "high"])

export const taskFormSchema = z.object({
  title: z.string().min(1, "Titre requis").max(500),
  description: z.string(),
  priority: taskPrioritySchema,
  dueLocal: z.string(),
  assigneeKey: z.string(),
  sprintKey: z.string(),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>
