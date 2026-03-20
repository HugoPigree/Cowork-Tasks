import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2, Users } from "lucide-react"
import { ApiError, workspacesApi } from "@/lib/api"
import { useWorkspace } from "@/context/WorkspaceContext"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { WorkspaceMember } from "@/lib/types"

export function WorkspacesPage() {
  const navigate = useNavigate()
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
  const [saving, setSaving] = useState(false)

  const [membersOpen, setMembersOpen] = useState(false)
  const [membersWsId, setMembersWsId] = useState<number | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [addUsername, setAddUsername] = useState("")
  const [membersLoading, setMembersLoading] = useState(false)

  const activeWs = workspaces.find((w) => w.id === membersWsId)

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

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!membersWsId) return
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

  async function handleRemoveMember(userId: number) {
    if (!membersWsId) return
    try {
      await workspacesApi.removeMember(membersWsId, userId)
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
            {workspaces.map((w) => (
              <Card
                key={w.id}
                className={
                  w.id === currentWorkspaceId ? "border-primary/50 shadow-sm" : ""
                }
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-lg">{w.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {w.description || "Pas de description"}
                    </CardDescription>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {w.member_count} membre{w.member_count > 1 ? "s" : ""} · vous
                      êtes <span className="font-medium">{w.my_role}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
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
            ))}
          </div>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Nouvel espace de travail</DialogTitle>
              <DialogDescription>
                Un espace = un projet ou une équipe. Vous serez owner et pourrez inviter des comptes existants par leur nom d&apos;utilisateur.
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

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Membres — {activeWs?.name}</DialogTitle>
            <DialogDescription>
              Seul un <strong>owner</strong> peut ajouter ou retirer des membres (les owners ne peuvent pas être retirés ici).
            </DialogDescription>
          </DialogHeader>
          {activeWs?.my_role === "owner" ? (
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
                  {activeWs?.my_role === "owner" && m.role !== "owner" ? (
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
    </div>
  )
}
