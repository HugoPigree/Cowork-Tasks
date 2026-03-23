import { z } from "zod"

export const loginSchema = z.object({
  username: z.string().min(1, "Nom d’utilisateur requis"),
  password: z.string().min(1, "Mot de passe requis"),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    username: z.string().min(1, "Nom d’utilisateur requis").max(150),
    email: z.string().email("E-mail invalide"),
    password: z.string().min(8, "Au moins 8 caractères"),
    password_confirm: z.string().min(1, "Confirmez le mot de passe"),
  })
  .refine((d) => d.password === d.password_confirm, {
    path: ["password_confirm"],
    message: "Les mots de passe ne correspondent pas",
  })

export type RegisterFormValues = z.infer<typeof registerSchema>
