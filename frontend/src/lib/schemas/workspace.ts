import { z } from "zod"

const optionalGithubUrl = z
  .string()
  .trim()
  .refine(
    (s) =>
      s === "" ||
      /^https?:\/\/.+/i.test(s),
    { message: "URL invalide (ex. https://github.com/org/repo)" }
  )

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(255),
  description: z.string(),
  githubUrl: optionalGithubUrl,
})

export const workspaceEditSchema = workspaceCreateSchema

export type WorkspaceCreateFormValues = z.infer<typeof workspaceCreateSchema>
export type WorkspaceEditFormValues = z.infer<typeof workspaceEditSchema>

export const addMemberSchema = z.object({
  username: z.string().trim().min(1, "Nom d’utilisateur requis"),
})

export type AddMemberFormValues = z.infer<typeof addMemberSchema>
