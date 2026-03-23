import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ApiError, workspacesApi } from "@/lib/api"
import { sprintCreateSchema, type SprintCreateFormValues } from "@/lib/schemas"
import type { Sprint } from "@/lib/types"
import { cn } from "@/lib/utils"

function formatSprintApiError(err: unknown): string {
  if (!(err instanceof ApiError)) return "Erreur réseau"
  if (err.status !== 404) return err.message
  if (/\/api\/api\//i.test(err.requestUrl)) {
    return "URL API incorrecte (/api/api/…). Dans frontend/.env, mettez l’origine seule (ex. http://127.0.0.1:8000), sans /api à la fin."
  }
  return `Sprints introuvables (404). Le serveur qui répond sur le port Django (souvent 8000, ou le conteneur « web ») n’expose pas encore cette route : redémarrez-le depuis ce dépôt, puis exécutez les migrations (python manage.py migrate ou docker compose up après rebuild). ${err.requestUrl ? `→ ${err.requestUrl}` : ""}`
}

const PRESET_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#64748b",
] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: number | null
  sprints: Sprint[]
  onSprintsChanged: () => void
}

export function SprintManageDialog({
  open,
  onOpenChange,
  workspaceId,
  sprints,
  onSprintsChanged,
}: Props) {
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<SprintCreateFormValues>({
    resolver: zodResolver(sprintCreateSchema),
    defaultValues: { name: "", color: PRESET_COLORS[0] },
  })

  useEffect(() => {
    if (open) {
      form.reset({ name: "", color: PRESET_COLORS[0] })
    }
  }, [open, form])

  async function onCreateSubmit(values: SprintCreateFormValues) {
    if (!workspaceId) return
    try {
      await workspacesApi.createSprint(workspaceId, {
        name: values.name.trim(),
        color: values.color,
      })
      toast.success("Sprint créé")
      form.reset({ name: "", color: PRESET_COLORS[0] })
      onSprintsChanged()
    } catch (err) {
      toast.error(formatSprintApiError(err))
    }
  }

  async function confirmDelete() {
    if (!workspaceId || deleteId == null) return
    setDeleting(true)
    try {
      await workspacesApi.deleteSprint(workspaceId, deleteId)
      toast.success("Sprint supprimé — les tâches ne sont plus liées")
      setDeleteId(null)
      onSprintsChanged()
    } catch (err) {
      toast.error(formatSprintApiError(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90dvh,640px)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Gérer les sprints</DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed">
              Créez des itérations et assignez-les aux tâches. La suppression
              retire le lien sans supprimer les tâches.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onCreateSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau sprint</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ex. Sprint 1"
                        maxLength={100}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Couleur</FormLabel>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          title={c}
                          className={cn(
                            "h-8 w-8 rounded-full border-2 shadow-sm transition-transform hover:scale-105",
                            field.value === c
                              ? "border-foreground ring-2 ring-ring/40"
                              : "border-transparent"
                          )}
                          style={{ backgroundColor: c }}
                          onClick={() => field.onChange(c)}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!workspaceId || form.formState.isSubmitting}
                  className="gap-1.5"
                >
                  {form.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Créer
                </Button>
              </DialogFooter>
            </form>
          </Form>

          <div className="border-t border-border/60 pt-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sprints existants
            </p>
            {sprints.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Aucun sprint pour l’instant.
              </p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-muted/15 p-2">
                {sprints.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      <span className="truncate font-medium">{s.name}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Supprimer ${s.name}`}
                      onClick={() => setDeleteId(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteId != null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce sprint ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les tâches conservées ; elles n’auront plus de sprint assigné.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? "…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
