import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RegisterPayload } from "@/context/AuthContext"
import { useAuth } from "@/context/AuthContext"
import { ApiError } from "@/lib/api"

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
  const { register } = useAuth()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [avatarChoice, setAvatarChoice] = useState<RegisterAvatarChoice>({
    kind: "none",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    return () => {
      if (avatarChoice.kind === "file") {
        URL.revokeObjectURL(avatarChoice.previewUrl)
      }
    }
  }, [avatarChoice])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (avatarChoice.kind === "file") {
        const fd = new FormData()
        fd.append("username", username)
        fd.append("email", email)
        fd.append("password", password)
        fd.append("password_confirm", passwordConfirm)
        fd.append("avatar", avatarChoice.file)
        await register(fd)
      } else if (avatarChoice.kind === "url") {
        const payload: RegisterPayload = {
          username,
          email,
          password,
          password_confirm: passwordConfirm,
          avatar_url: avatarChoice.url,
        }
        await register(payload)
      } else {
        await register({
          username,
          email,
          password,
          password_confirm: passwordConfirm,
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
      <Card className="w-full max-w-lg border-border/60 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Créer un compte
          </CardTitle>
          <CardDescription>
            Avatar optionnel (initiales DiceBear, aléatoire ou fichier), puis accès JWT.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-4">
            <RegisterAvatarPicker
              username={username}
              value={avatarChoice}
              onChange={setAvatarChoice}
            />
            <div className="grid gap-2">
              <Label htmlFor="user">Nom d&apos;utilisateur</Label>
              <Input
                id="user"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pass">Mot de passe</Label>
              <Input
                id="pass"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pass2">Confirmer le mot de passe</Label>
              <Input
                id="pass2"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Création…" : "S'inscrire"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Déjà inscrit ?{" "}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Se connecter
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
