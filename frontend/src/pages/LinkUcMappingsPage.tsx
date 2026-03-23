import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  CheckSquare2,
  Copy,
  Link2,
  Loader2,
  Settings2,
  Sparkles,
} from "lucide-react"
import { UserAccountMenu } from "@/components/layout/UserAccountMenu"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/context/WorkspaceContext"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { applyUcLinkMapping } from "@/lib/applyUcLinkMapping"
import {
  UC_LINK_MAPPING_EXAMPLE,
  validateUcLinkMappingJson,
} from "@/lib/ucLinkMapping"
import { cn } from "@/lib/utils"

function stripMarkdownCodeFence(raw: string): string {
  let t = raw.trim()
  if (!t.startsWith("```")) return t
  t = t.replace(/^```(?:json)?\s*/i, "")
  const end = t.lastIndexOf("```")
  if (end !== -1) t = t.slice(0, end)
  return t.trim()
}

export function LinkUcMappingsPage() {
  const {
    workspaces,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    loading: wsLoading,
  } = useWorkspace()

  const [jsonInput, setJsonInput] = useState("")
  const debouncedJson = useDebouncedValue(jsonInput, 400)
  const [previewFormatted, setPreviewFormatted] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [lastReport, setLastReport] = useState<string | null>(null)

  useEffect(() => {
    const stripped = stripMarkdownCodeFence(debouncedJson)
    if (!stripped.trim()) {
      setPreviewFormatted(null)
      setPreviewError(null)
      return
    }
    const r = validateUcLinkMappingJson(stripped)
    if (r.ok) {
      setPreviewError(null)
      setPreviewFormatted(JSON.stringify(r.mapping, null, 2))
    } else {
      setPreviewFormatted(null)
      setPreviewError(r.message)
    }
  }, [debouncedJson])

  const copyExample = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(UC_LINK_MAPPING_EXAMPLE, null, 2)
      )
      toast.success("Exemple copié dans le presse-papier")
    } catch {
      toast.error("Impossible de copier")
    }
  }, [])

  const handleApply = useCallback(async () => {
    if (!currentWorkspaceId) {
      toast.error("Sélectionnez un espace de travail")
      return
    }
    const stripped = stripMarkdownCodeFence(jsonInput)
    const parsed = validateUcLinkMappingJson(stripped)
    if (!parsed.ok) {
      toast.error(parsed.message)
      setPreviewError(parsed.message)
      return
    }
    setApplying(true)
    setLastReport(null)
    try {
      const { applied, failures } = await applyUcLinkMapping(
        currentWorkspaceId,
        parsed.mapping
      )
      if (failures.length === 0) {
        toast.success(`${applied} UC mise(s) à jour`)
        setLastReport(`Succès : ${applied} carte(s) UC ont reçu les dépendances. Rechargez le tableau si besoin.`)
      } else {
        toast.warning(
          `${applied} mise(s) à jour, ${failures.length} erreur(s)`
        )
        setLastReport(
          [
            applied > 0 ? `Mises à jour : ${applied}` : "Aucune mise à jour.",
            ...failures.map((f) => `• ${f.uc} : ${f.message}`),
          ].join("\n")
        )
      }
    } finally {
      setApplying(false)
    }
  }, [currentWorkspaceId, jsonInput])

  if (wsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_120%_90%_at_50%_-25%,hsl(var(--primary)/0.08),transparent)]">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/90 shadow-sm shadow-black/[0.04] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CheckSquare2 className="h-5 w-5" />
            </div>
            <span>Cowork Tasks</span>
          </Link>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
            {workspaces.length > 0 ? (
              <div className="min-w-[200px] max-w-xs flex-1 sm:flex-initial">
                <Select
                  value={String(currentWorkspaceId ?? "")}
                  onValueChange={(v) => setCurrentWorkspaceId(parseInt(v, 10))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Espace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link to="/" className="gap-1">
                <CheckSquare2 className="h-4 w-4" />
                Tableau
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/aide-creation-uc" className="gap-1">
                <Sparkles className="h-4 w-4" />
                Aide UC
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="pointer-events-none gap-1">
              <Link2 className="h-4 w-4" />
              Lier UC
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/workspaces" className="gap-1">
                <Settings2 className="h-4 w-4" />
                Espaces
              </Link>
            </Button>
            <UserAccountMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Lier les UC aux tâches (JSON)
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Collez un objet JSON qui associe chaque code UC aux codes des
              tâches déjà présentes dans l’espace (titres du type{" "}
              <code className="rounded bg-muted px-1 text-xs">UC-01: …</code>,{" "}
              <code className="rounded bg-muted px-1 text-xs">T-01: …</code>
              ). Les liens « bloquée par » sont mis à jour via l’API (équivalent
              à l’édition manuelle des dépendances).
            </p>
          </div>
        </div>

        <Card className="border-border/60 shadow-md shadow-black/[0.06]">
          <CardHeader>
            <CardTitle className="text-lg">Format attendu</CardTitle>
            <CardDescription>
              Objet JSON : clés ={" "}
              <code className="rounded bg-muted px-1 text-xs">UC-01</code>, … —
              valeurs = tableaux de{" "}
              <code className="rounded bg-muted px-1 text-xs">T-01</code>,{" "}
              <code className="rounded bg-muted px-1 text-xs">UC-02</code>, etc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
{`{
  "UC-01": ["T-01", "T-02", "T-03", "T-04"],
  "UC-02": ["T-05"]
}`}
            </pre>
            <Button type="button" variant="outline" size="sm" onClick={() => void copyExample()} className="gap-2">
              <Copy className="h-4 w-4" />
              Copier l’exemple complet (UC-01 … UC-15)
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-md shadow-black/[0.06]">
          <CardHeader>
            <CardTitle className="text-lg">Coller et appliquer</CardTitle>
            <CardDescription>
              Choisissez l’espace cible, collez le JSON, vérifiez l’aperçu puis
              appliquez. Rafraîchissez le Kanban si les cartes étaient déjà
              ouvertes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!currentWorkspaceId ? (
              <p className="text-sm text-destructive">
                Aucun espace sélectionné.
              </p>
            ) : null}
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{\n  "UC-01": ["T-01", "T-02"]\n}'
              className="min-h-[200px] font-mono text-[13px] leading-relaxed"
              aria-label="JSON des correspondances UC vers tâches"
            />

            {(previewFormatted || previewError) && (
              <div
                className={cn(
                  "rounded-xl border p-4 text-sm",
                  previewError
                    ? "border-destructive/50 bg-destructive/5 text-destructive"
                    : "border-emerald-500/40 bg-emerald-500/[0.06] text-foreground"
                )}
              >
                <p className="mb-2 font-semibold">
                  {previewError ? "Erreur" : "JSON valide"}
                </p>
                {previewError ? (
                  <p className="leading-relaxed">{previewError}</p>
                ) : (
                  <pre className="max-h-[min(280px,35vh)] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background/80 p-3 font-mono text-xs">
                    {previewFormatted}
                  </pre>
                )}
              </div>
            )}

            {lastReport ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {lastReport}
              </div>
            ) : null}

            <Button
              type="button"
              onClick={() => void handleApply()}
              disabled={applying || !currentWorkspaceId || !jsonInput.trim()}
              className="gap-2"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Appliquer les liens sur cet espace
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
