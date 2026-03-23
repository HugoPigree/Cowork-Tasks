import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  RegisterAvatarPicker,
  type RegisterAvatarChoice,
} from "@/components/auth/RegisterAvatarPicker"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { RegisterPayload } from "@/context/AuthContext"
import { useAuth } from "@/context/AuthContext"
import { ApiError } from "@/lib/api"
import { registerSchema, type RegisterFormValues } from "@/lib/schemas"

function formatFieldErrors(body: unknown): string {
  if (!body || typeof body !== "object") return "Inscription impossible"
  const o = body as Record<string, unknown>
  const parts: string[] = []
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`)
    else if (typeof v === "string") parts.push(v)
  }
  return parts.join(" · ") || "Inscription impossible"
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const [avatarChoice, setAvatarChoice] = useState<RegisterAvatarChoice>({
    kind: "none",
  })

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      password_confirm: "",
    },
  })

  const watchedUsername = useWatch({
    control: form.control,
    name: "username",
  })

  useEffect(() => {
    return () => {
      if (avatarChoice.kind === "file") {
        URL.revokeObjectURL(avatarChoice.previewUrl)
      }
    }
  }, [avatarChoice])

  async function onSubmit(values: RegisterFormValues) {
    try {
      if (avatarChoice.kind === "file") {
        const fd = new FormData()
        fd.append("username", values.username)
        fd.append("email", values.email)
        fd.append("password", values.password)
        fd.append("password_confirm", values.password_confirm)
        fd.append("avatar", avatarChoice.file)
        await registerUser(fd)
      } else if (avatarChoice.kind === "url") {
        const payload: RegisterPayload = {
          username: values.username,
          email: values.email,
          password: values.password,
          password_confirm: values.password_confirm,
          avatar_url: avatarChoice.url,
        }
        await registerUser(payload)
      } else {
        await registerUser({
          username: values.username,
          email: values.email,
          password: values.password,
          password_confirm: values.password_confirm,
        })
      }
      toast.success("Compte créé — connectez-vous")
      navigate("/login", { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        toast.error(formatFieldErrors(err.body))
      } else {
        toast.error("Inscription impossible")
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,hsl(var(--primary)/0.06),transparent)] p-6">
      <Card className="w-full max-w-lg border-border/50 shadow-sm">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Créer un compte
          </CardTitle>
          <CardDescription className="text-[13px] leading-relaxed">
            Avatar optionnel (DiceBear, fichier ou URL), puis connexion JWT.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="grid gap-4 pt-0">
              <RegisterAvatarPicker
                username={watchedUsername}
                value={avatarChoice}
                onChange={setAvatarChoice}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom d&apos;utilisateur</FormLabel>
                    <FormControl>
                      <Input autoComplete="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password_confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Création…" : "S'inscrire"}
              </Button>
              <p className="text-center text-[13px] text-muted-foreground">
                Déjà inscrit ?{" "}
                <Link
                  to="/login"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Se connecter
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
