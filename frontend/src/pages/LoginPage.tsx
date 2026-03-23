import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
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
import { useAuth } from "@/context/AuthContext"
import { ApiError } from "@/lib/api"
import { loginSchema, type LoginFormValues } from "@/lib/schemas"

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  })

  async function onSubmit(values: LoginFormValues) {
    try {
      await login(values.username, values.password)
      toast.success("Connexion réussie")
      navigate("/", { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Identifiants incorrects")
      } else {
        toast.error("Impossible de se connecter")
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,hsl(var(--primary)/0.06),transparent)] p-6">
      <Card className="w-full max-w-[400px] border-border/50 shadow-sm">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Connexion
          </CardTitle>
          <CardDescription className="text-[13px] leading-relaxed">
            Accédez à vos espaces et au tableau Kanban.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="grid gap-4 pt-0">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom d&apos;utilisateur</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="username"
                        placeholder="vous"
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
                        autoComplete="current-password"
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
                {form.formState.isSubmitting ? "Connexion…" : "Se connecter"}
              </Button>
              <p className="text-center text-[13px] text-muted-foreground">
                Pas encore de compte ?{" "}
                <Link
                  to="/register"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Créer un compte
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
