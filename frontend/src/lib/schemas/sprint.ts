import { z } from "zod"

export const sprintCreateSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(100),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Couleur hex invalide"),
})

export type SprintCreateFormValues = z.infer<typeof sprintCreateSchema>
