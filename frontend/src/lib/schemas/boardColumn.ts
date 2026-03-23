import { z } from "zod"

export const boardColumnFormSchema = z
  .object({
    name: z.string().trim().min(1, "Nom requis").max(100),
    maps_to_status: z.enum(["todo", "in_progress", "done"]),
    wipStr: z.string(),
    color: z.string().min(1, "Choisissez une couleur"),
  })
  .superRefine((val, ctx) => {
    const w = val.wipStr.trim()
    if (w === "") return
    const n = parseInt(w, 10)
    if (Number.isNaN(n) || n < 1 || n > 99) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wipStr"],
        message: "Nombre entre 1 et 99, ou laissez vide",
      })
    }
  })

export type BoardColumnFormValues = z.infer<typeof boardColumnFormSchema>
