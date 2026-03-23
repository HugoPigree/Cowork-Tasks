import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft,
  Github,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react"
import { gitHubRepoHref } from "@/components/tasks/ProjectBoardToolbar"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/AuthContext"
import { useWorkspace } from "@/context/WorkspaceContext"
import { ApiError, workspacesApi } from "@/lib/api"
import {
  addMemberSchema,
  workspaceCreateSchema,
  workspaceEditSchema,
  type AddMemberFormValues,
  type WorkspaceCreateFormValues,
  type WorkspaceEditFormValues,
} from "@/lib/schemas"
import type { Workspace, WorkspaceMember } from "@/lib/types"

export function WorkspacesPage() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const {
    workspaces,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    refreshWorkspaces,
    loading,
  } = useWorkspace()

  const [createOpen, setCreateOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [membersWsId, setMembersWsId] = useState<number | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editWsId, setEditWsId] = useState<number | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const createForm = useForm<WorkspaceCreateFormValues>({
    resolver: zodResolver(workspaceCreateSchema),
    defaultValues: { name: "", description: "", githubUrl: "" },
  })

  const editForm = useForm<WorkspaceEditFormValues>({
    resolver: zodResolver(workspaceEditSchema),
    defaultValues: { name: "", description: "", githubUrl: "" },
  })

  const addMemberForm = useForm<AddMemberFormValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { username: "" },
  })

  const activeWs = workspaces.find((w) => w.id === membersWsId)
  const editingWs = workspaces.find((w) => w.id === editWsId)

  useEffect(() => {
    if (createOpen) {
      createForm.reset({ name: "", description: "", githubUrl: "" })
    }
  }, [createOpen, createForm])

  function isCreator(w: Workspace) {
    return userId !== null && w.created_by === userId
  }

  async function openMembers(wsId: number) {
    setMembersWsId(wsId)
    setMembersOpen(true)
    addMemberForm.reset({ username: "" })
    setMembersLoading(true)
    try {
      const list = await workspacesApi.members(wsId)
      setMembers(list)
    } catch {
      toast.error("Impossible de charger les membres")
    } finally {
      setMembersLoading(false)
    }
  }

  function openEdit(w: Workspace) {
    setEditWsId(w.id)
    editForm.reset({
      name: w.name,
      description: w.description ?? "",
      githubUrl: w.github_url ?? "",
    })
    setEditOpen(true)
  }

  async function onCreateSubmit(values: WorkspaceCreateFormValues) {
    try {
      const gh = values.githubUrl.trim()
      const ws = await workspacesApi.create({
        name: values.name.trim(),
        description: values.description.trim(),
        ...(gh ? { github_url: gh } : {}),
      })
      toast.success("Espace créé")
      setCreateOpen(false)
      await refreshWorkspaces()
      setCurrentWorkspaceId(ws.id)
      navigate("/")
    } catch (err) {
      if (err instanceof ApiError) toast.error("Création refusée")
      else toast.error("Erreur réseau")
    }
  }

  async function onEditSubmit(values: WorkspaceEditFormValues) {
    if (!editWsId) return
    try {
      const gh = values.githubUrl.trim()
      await workspacesApi.update(editWsId, {
        name: values.name.trim(),
        description: values.description.trim(),
        github_url: gh,
      })
      toast.success("Espace mis à jour")
      setEditOpen(false)
      setEditWsId(null)
      await refreshWorkspaces()
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
    }
  }

  async function confirmDeleteWorkspace() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await workspacesApi.delete(deleteTarget.id)
      toast.success("Espace supprimé")
      setDeleteTarget(null)
      await refreshWorkspaces()
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
    } finally {
      setDeleteLoading(false)
    }
  }

  async function onAddMemberSubmit(values: AddMemberFormValues) {
    if (!membersWsId || !activeWs || !isCreator(activeWs)) return
    try {
      await workspacesApi.addMember(membersWsId, values.username.trim())
      toast.success("Membre ajouté")
      addMemberForm.reset({ username: "" })
      setMembers(await workspacesApi.members(membersWsId))
      await refreshWorkspaces()
    } catch {
      toast.error("Ajout impossible (utilisateur introuvable ou déjà membre)")
    }
  }

  async function handleRemoveMember(userIdToRemove: number) {
    if (!membersWsId || !activeWs || !isCreator(activeWs)) return
    try {
      await workspacesApi.removeMember(membersWsId, userIdToRemove)
      toast.success("Membre retiré")
      setMembers(await workspacesApi.members(membersWsId))
      await refreshWorkspaces()
    } catch {
      toast.error("Retrait impossible")
    }
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_120%_90%_at_50%_-25%,hsl(var(--primary)/0.06),transparent)]">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="gap-2 text-[13px]">
              <ArrowLeft className="h-4 w-4" />
              Tableau des tâches
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Espaces de travail
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Projets d&apos;équipe : membres, rôles et tâches partagées.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvel espace
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : workspaces.length === 0 ? (
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Aucun espace</CardTitle>
              <CardDescription className="text-[13px] leading-relaxed">
                Créez un espace pour inviter votre équipe et centraliser les
                tâches.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-3">
            {workspaces.map((w) => {
              const creator = isCreator(w)
              const cardRepo = gitHubRepoHref(w.github_url)
              return (
                <Card
                  key={w.id}
                  className={
                    w.id === currentWorkspaceId
                      ? "border-primary/40 shadow-sm"
                      : "border-border/50 shadow-sm"
                  }
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="min-w-0 pr-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg font-medium">{w.name}</CardTitle>
                        {cardRepo ? (
                          <a
                            href={cardRepo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="Ouvrir le dépôt GitHub"
                          >
                            <Github className="h-4 w-4" />
                          </a>
                        ) : null}
                        {creator ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-normal"
                          >
                            Créateur
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="mt-1 line-clamp-2 whitespace-pre-wrap text-[13px] leading-relaxed">
                        {w.description || "Pas de description"}
                      </CardDescription>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {w.member_count} membre{w.member_count > 1 ? "s" : ""}{" "}
                        · rôle :{" "}
                        <span className="font-medium text-foreground/90">
                          {w.my_role}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {creator ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Actions sur l&apos;espace"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => openEdit(w)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Renommer…
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(w)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Supprimer l&apos;espace…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => openMembers(w.id)}
                      >
                        <Users className="h-4 w-4" />
                        Membres
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          w.id === currentWorkspaceId ? "secondary" : "default"
                        }
                        onClick={() => {
                          setCurrentWorkspaceId(w.id)
                          navigate("/")
                        }}
                      >
                        {w.id === currentWorkspaceId ? "Actif" : "Ouvrir"}
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
              <DialogHeader>
                <DialogTitle className="text-lg">Nouvel espace de travail</DialogTitle>
                <DialogDescription className="text-[13px] leading-relaxed">
                  Un espace = un projet ou une équipe. Vous serez créateur et
                  owner ; seul le créateur peut inviter, renommer ou supprimer
                  l&apos;espace.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du projet</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex. Refonte site web"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="githubUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dépôt GitHub (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          inputMode="url"
                          placeholder="https://github.com/org/repo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createForm.formState.isSubmitting}
                >
                  {createForm.formState.isSubmitting ? "…" : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o)
          if (!o) setEditWsId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
              <DialogHeader>
                <DialogTitle className="text-lg">Modifier l&apos;espace</DialogTitle>
                <DialogDescription className="text-[13px] leading-relaxed">
                  {editingWs?.name} — visible par tous les membres.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="githubUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dépôt GitHub (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          inputMode="url"
                          placeholder="https://github.com/org/repo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={editForm.formState.isSubmitting}
                >
                  {editForm.formState.isSubmitting ? "…" : "Enregistrer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Membres — {activeWs?.name}</DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed">
              {activeWs && isCreator(activeWs) ? (
                <>
                  En tant que <strong>créateur</strong>, vous pouvez inviter ou
                  retirer des membres.
                </>
              ) : (
                <>
                  Seul le <strong>créateur</strong> de l&apos;espace peut
                  inviter ou retirer des membres.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {activeWs && isCreator(activeWs) ? (
            <Form {...addMemberForm}>
              <form
                onSubmit={addMemberForm.handleSubmit(onAddMemberSubmit)}
                className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start"
              >
                <FormField
                  control={addMemberForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="min-w-0 flex-1">
                      <FormControl>
                        <Input
                          placeholder="Nom d'utilisateur"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={addMemberForm.formState.isSubmitting}
                  className="shrink-0"
                >
                  Ajouter
                </Button>
              </form>
            </Form>
          ) : null}
          <Separator className="bg-border/60" />
          <div className="max-h-56 space-y-2 overflow-y-auto py-2">
            {membersLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{m.user.username}</span>
                    <span className="ml-2 text-muted-foreground">
                      ({m.role})
                    </span>
                  </span>
                  {activeWs &&
                  isCreator(activeWs) &&
                  m.role !== "owner" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleRemoveMember(m.user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet espace ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} — toutes les tâches et colonnes seront
              supprimées. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLoading}
              onClick={(e) => {
                e.preventDefault()
                void confirmDeleteWorkspace()
              }}
            >
              {deleteLoading ? "…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
