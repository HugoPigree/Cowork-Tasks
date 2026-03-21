import { useState } from "react"
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
import { ApiError, workspacesApi } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { useWorkspace } from "@/context/WorkspaceContext"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { Workspace, WorkspaceMember } from "@/lib/types"
import { gitHubRepoHref } from "@/components/tasks/ProjectBoardToolbar"

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
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [githubUrl, setGithubUrl] = useState("")
  const [saving, setSaving] = useState(false)

  const [membersOpen, setMembersOpen] = useState(false)
  const [membersWsId, setMembersWsId] = useState<number | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [addUsername, setAddUsername] = useState("")
  const [membersLoading, setMembersLoading] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editWsId, setEditWsId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editGithubUrl, setEditGithubUrl] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const activeWs = workspaces.find((w) => w.id === membersWsId)
  const editingWs = workspaces.find((w) => w.id === editWsId)

  function isCreator(w: Workspace) {
    return userId !== null && w.created_by === userId
  }

  async function openMembers(wsId: number) {
    setMembersWsId(wsId)
    setMembersOpen(true)
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
    setEditName(w.name)
    setEditDescription(w.description ?? "")
    setEditGithubUrl(w.github_url ?? "")
    setEditOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const ws = await workspacesApi.create({ name, description })
      toast.success("Espace créé")
      setCreateOpen(false)
      setName("")
      setDescription("")
      await refreshWorkspaces()
      setCurrentWorkspaceId(ws.id)
      navigate("/")
    } catch (err) {
      if (err instanceof ApiError) toast.error("Création refusée")
      else toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editWsId) return
    const nextName = editName.trim()
    if (!nextName) {
      toast.error("Le nom est requis")
      return
    }
    setEditSaving(true)
    try {
      await workspacesApi.update(editWsId, {
        name: nextName,
        description: editDescription.trim(),
        github_url: editGithubUrl.trim(),
      })
      toast.success("Espace mis à jour")
      setEditOpen(false)
      setEditWsId(null)
      await refreshWorkspaces()
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("Erreur réseau")
    } finally {
      setEditSaving(false)
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

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!membersWsId || !activeWs || !isCreator(activeWs)) return
    try {
      await workspacesApi.addMember(membersWsId, addUsername.trim())
      toast.success("Membre ajouté")
      setAddUsername("")
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Tableau des tâches
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Espaces de travail</h1>
            <p className="text-sm text-muted-foreground">
              Projets d&apos;équipe : membres, rôles et tâches partagées.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvel espace
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : workspaces.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucun espace</CardTitle>
              <CardDescription>
                Créez un espace pour inviter votre équipe et centraliser les tâches.
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
                    w.id === currentWorkspaceId ? "border-primary/50 shadow-sm" : ""
                  }
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="min-w-0 pr-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">{w.name}</CardTitle>
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
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            Créateur
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="mt-1 line-clamp-2">
                        {w.description || "Pas de description"}
                      </CardDescription>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {w.member_count} membre{w.member_count > 1 ? "s" : ""} · rôle :{" "}
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
                        variant={w.id === currentWorkspaceId ? "secondary" : "default"}
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
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Nouvel espace de travail</DialogTitle>
              <DialogDescription>
                Un espace = un projet ou une équipe. Vous serez créateur et owner ;
                seul le créateur peut inviter des membres, renommer ou supprimer
                l&apos;espace.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="wsname">Nom du projet</Label>
                <Input
                  id="wsname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ex. Refonte site web"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wsdesc">Description</Label>
                <Textarea
                  id="wsdesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ws-gh">Dépôt GitHub (optionnel)</Label>
                <Input
                  id="ws-gh"
                  type="url"
                  inputMode="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "…" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o)
          if (!o) setEditWsId(null)
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => void handleSaveEdit(e)}>
            <DialogHeader>
              <DialogTitle>Modifier l&apos;espace</DialogTitle>
              <DialogDescription>
                {editingWs?.name} — visible par tous les membres.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-ws-name">Nom</Label>
                <Input
                  id="edit-ws-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-ws-desc">Description</Label>
                <Textarea
                  id="edit-ws-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-ws-gh">Dépôt GitHub (optionnel)</Label>
                <Input
                  id="edit-ws-gh"
                  type="url"
                  inputMode="url"
                  value={editGithubUrl}
                  onChange={(e) => setEditGithubUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? "…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Membres — {activeWs?.name}</DialogTitle>
            <DialogDescription>
              {activeWs && isCreator(activeWs) ? (
                <>
                  En tant que <strong>créateur</strong>, vous pouvez inviter ou retirer
                  des membres.
                </>
              ) : (
                <>
                  Seul le <strong>créateur</strong> de l&apos;espace peut inviter ou
                  retirer des membres. Vous pouvez consulter la liste ci-dessous.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {activeWs && isCreator(activeWs) ? (
            <form onSubmit={handleAddMember} className="flex gap-2 py-2">
              <Input
                placeholder="Nom d'utilisateur"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                required
              />
              <Button type="submit">Ajouter</Button>
            </form>
          ) : null}
          <Separator />
          <div className="max-h-56 space-y-2 overflow-y-auto py-2">
            {membersLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{m.user.username}</span>
                    <span className="ml-2 text-muted-foreground">({m.role})</span>
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
              {deleteTarget?.name} — toutes les tâches et colonnes seront supprimées.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
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
