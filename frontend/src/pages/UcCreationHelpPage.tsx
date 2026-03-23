import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckSquare2,
  Copy,
  ExternalLink,
  Loader2,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import { UserAccountMenu } from "@/components/layout/UserAccountMenu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { workspacesApi } from "@/lib/api"
import { backlogColumnId } from "@/lib/backlogColumn"
import { UC_CREATION_PROMPT } from "@/lib/ucCreationPrompt"
import { createUCs } from "@/lib/ucImportCreate"
import {
  validateImportedUcArray,
  validateImportedUcJson,
  type ImportedUc,
} from "@/lib/ucImportValidation"
import type { BoardColumn } from "@/lib/types"
import { cn } from "@/lib/utils"

type PreviewUcRow = ImportedUc & { clientKey: string }

function newClientKey(fallbackIndex: number) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `uc-${Date.now()}-${fallbackIndex}`
}

const STEPS = [
  {
    title: "1. Copier le prompt",
    detail:
      "Utilisez le bouton « Copier le prompt » pour récupérer le texte à donner à ChatGPT.",
  },
  {
    title: "2. Générer le JSON",
    detail:
      "Ouvrez ChatGPT, collez le prompt, décrivez vos besoins à la place de [DÉCRIS ICI LES UC À GÉNÉRER], puis récupérez uniquement le tableau JSON.",
  },
  {
    title: "3. Importer dans le backlog",
    detail:
      "Collez le JSON, cliquez sur « Prévisualiser et modifier », ajustez chaque UC si besoin, puis « Valider et importer ». Les tâches partent dans la colonne Backlog (ou la première colonne) de l’espace sélectionné.",
  },
]

/** Retire les blocs ```json ... ``` si l’utilisateur colle la réponse telle quelle. */
function stripMarkdownCodeFence(raw: string): string {
  let t = raw.trim()
  if (!t.startsWith("```")) return t
  t = t.replace(/^```(?:json)?\s*/i, "")
  const end = t.lastIndexOf("```")
  if (end !== -1) t = t.slice(0, end)
  return t.trim()
}

export function UcCreationHelpPage() {
  const {
    workspaces,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    loading: wsLoading,
  } = useWorkspace()

  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [columnsLoading, setColumnsLoading] = useState(false)
  const [jsonInput, setJsonInput] = useState("")
  const debouncedJson = useDebouncedValue(jsonInput, 400)
  const [previewFormatted, setPreviewFormatted] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importPhase, setImportPhase] = useState<"json" | "preview">("json")
  const [previewItems, setPreviewItems] = useState<PreviewUcRow[]>([])

  useEffect(() => {
    if (!currentWorkspaceId) {
      setColumns([])
      return
    }
    let cancelled = false
    setColumnsLoading(true)
    void (async () => {
      try {
        const board = await workspacesApi.board(currentWorkspaceId)
        if (!cancelled) setColumns(board.columns)
      } catch {
        if (!cancelled) setColumns([])
      } finally {
        if (!cancelled) setColumnsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    const stripped = stripMarkdownCodeFence(debouncedJson)
    if (!stripped.trim()) {
      setPreviewFormatted(null)
      setPreviewError(null)
      return
    }
    const result = validateImportedUcJson(stripped)
    if (result.ok) {
      setPreviewError(null)
      setPreviewFormatted(JSON.stringify(result.items, null, 2))
    } else {
      setPreviewFormatted(null)
      setPreviewError(result.message)
    }
  }, [debouncedJson])

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(UC_CREATION_PROMPT)
      toast.success("Prompt copié dans le presse-papier")
    } catch {
      toast.error("Impossible de copier (permission navigateur)")
    }
  }, [])

  const openChatGpt = useCallback(() => {
    window.open("https://chat.openai.com", "_blank", "noopener,noreferrer")
  }, [])

  const goToPreview = useCallback(() => {
    const stripped = stripMarkdownCodeFence(jsonInput)
    const parsed = validateImportedUcJson(stripped)
    if (!parsed.ok) {
      toast.error(parsed.message)
      setPreviewError(parsed.message)
      return
    }
    setPreviewError(null)
    setPreviewItems(
      parsed.items.map((item, i) => ({
        ...item,
        dependencies: [...item.dependencies],
        comments: [...item.comments],
        clientKey: newClientKey(i),
      }))
    )
    setImportPhase("preview")
  }, [jsonInput])

  const goBackToJson = useCallback(() => {
    setImportPhase("json")
  }, [])

  const updatePreviewItem = useCallback(
    (index: number, patch: Partial<ImportedUc>) => {
      setPreviewItems((prev) =>
        prev.map((row, i) =>
          i === index ? { ...row, ...patch, clientKey: row.clientKey } : row
        )
      )
    },
    []
  )

  const removePreviewItem = useCallback((index: number) => {
    setPreviewItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleConfirmImport = useCallback(async () => {
    if (!currentWorkspaceId) {
      toast.error("Sélectionnez un espace de travail")
      return
    }
    const colId = backlogColumnId(columns)
    if (colId == null) {
      toast.error(
        "Aucune colonne disponible sur ce tableau. Ajoutez une colonne ou rechargez la page."
      )
      return
    }

    const rowsForApi: unknown[] = previewItems.map(
      ({ clientKey: _k, ...rest }) => rest
    )
    const checked = validateImportedUcArray(rowsForApi)
    if (!checked.ok) {
      toast.error(checked.message)
      return
    }

    if (checked.items.length === 0) {
      toast.error("Ajoutez au moins une UC à importer.")
      return
    }

    setImporting(true)
    try {
      const { created, failures } = await createUCs(
        checked.items,
        currentWorkspaceId,
        colId
      )
      if (failures.length === 0) {
        toast.success(`${created} UC importées avec succès`)
        setJsonInput("")
        setPreviewFormatted(null)
        setPreviewError(null)
        setPreviewItems([])
        setImportPhase("json")
      } else {
        toast.error(
          `${created} créée(s), ${failures.length} échec(s). Voir le détail ci-dessous.`
        )
        const detail = failures
          .map((f) => `• ${f.title} : ${f.message}`)
          .join("\n")
        console.warn("[UC import]", detail)
      }
    } finally {
      setImporting(false)
    }
  }, [columns, currentWorkspaceId, previewItems])

  const backlogId = backlogColumnId(columns)
  const backlogName =
    backlogId != null
      ? columns.find((c) => c.id === backlogId)?.name ?? "Backlog"
      : null

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
            <Button variant="secondary" size="sm" className="pointer-events-none gap-1">
              <Sparkles className="h-4 w-4" />
              Aide UC
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
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Aide à la création d’UC
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Générez des cas d’utilisation avec ChatGPT, puis importez-les en une
              fois dans le backlog de votre espace.
            </p>
          </div>
        </div>

        <Card className="border-border/60 shadow-md shadow-black/[0.06]">
          <CardHeader>
            <CardTitle className="text-lg">Comment ça marche ?</CardTitle>
            <CardDescription>
              Trois étapes — le JSON doit respecter strictement le format attendu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3">
              {STEPS.map((s) => (
                <li
                  key={s.title}
                  className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3"
                >
                  <p className="font-semibold text-foreground">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {s.detail}
                  </p>
                </li>
              ))}
            </ol>
            {currentWorkspaceId ? (
              <p className="text-sm text-muted-foreground">
                {columnsLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement du tableau…
                  </span>
                ) : backlogId != null ? (
                  <>
                    Colonne cible :{" "}
                    <span className="font-medium text-foreground">
                      {backlogName}
                    </span>
                  </>
                ) : (
                  <span className="text-destructive">
                    Aucune colonne sur ce tableau — impossible d’importer pour
                    l’instant.
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-destructive">
                Aucun espace sélectionné. Créez ou choisissez un espace dans
                l’en-tête.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-md shadow-black/[0.06]">
          <CardHeader>
            <CardTitle className="text-lg">Prompt ChatGPT</CardTitle>
            <CardDescription>
              Copiez ce texte tel quel dans une nouvelle conversation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              readOnly
              value={UC_CREATION_PROMPT}
              className="min-h-[280px] cursor-default resize-none bg-muted/40 font-mono text-[13px] leading-relaxed"
              aria-label="Prompt à copier pour ChatGPT"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void copyPrompt()} className="gap-2">
                <Copy className="h-4 w-4" />
                Copier le prompt
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={openChatGpt}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Ouvrir ChatGPT
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-md shadow-black/[0.06]">
          <CardHeader>
            <CardTitle className="text-lg">
              {importPhase === "json"
                ? "Importer les UC"
                : "Prévisualisation — modifier puis valider"}
            </CardTitle>
            <CardDescription>
              {importPhase === "json" ? (
                <>
                  Collez le tableau JSON renvoyé par ChatGPT (blocs{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {"```json"}
                  </code>{" "}
                  acceptés), puis ouvrez la prévisualisation pour ajuster chaque
                  UC avant import.
                </>
              ) : (
                <>
                  Vérifiez le titre, la description et la priorité de chaque UC.
                  Retournez au JSON pour tout reprendre, ou validez pour créer
                  les tâches dans le backlog.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {importPhase === "json" ? (
              <>
                <div className="space-y-2">
                  <label
                    className="text-sm font-semibold text-foreground/90"
                    htmlFor="uc-json-input"
                  >
                    JSON
                  </label>
                  <Textarea
                    id="uc-json-input"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='[\n  { "title": "UC-01: …", "description": "…", … }\n]'
                    className="min-h-[200px] font-mono text-[13px] leading-relaxed"
                  />
                </div>

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
                      {previewError
                        ? "Aperçu / validation"
                        : "JSON valide — prêt pour la prévisualisation"}
                    </p>
                    {previewError ? (
                      <p className="leading-relaxed">{previewError}</p>
                    ) : (
                      <pre className="max-h-[min(320px,40vh)] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background/80 p-3 font-mono text-xs leading-relaxed text-foreground">
                        {previewFormatted}
                      </pre>
                    )}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={goToPreview}
                  disabled={
                    !currentWorkspaceId ||
                    backlogId == null ||
                    !jsonInput.trim()
                  }
                  className="gap-2"
                >
                  Prévisualiser et modifier
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {previewItems.length} UC à importer
                  {previewItems.length === 0
                    ? " — retournez au JSON ou annulez."
                    : "."}
                </p>
                <div className="max-h-[min(520px,60vh)] space-y-3 overflow-y-auto pr-1">
                  {previewItems.map((uc, index) => (
                    <div
                      key={uc.clientKey}
                      className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          UC #{index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {uc.status}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive"
                            aria-label="Retirer cette UC de l’import"
                            onClick={() => removePreviewItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`uc-title-${index}`}>Titre</Label>
                        <Input
                          id={`uc-title-${index}`}
                          value={uc.title}
                          onChange={(e) =>
                            updatePreviewItem(index, { title: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`uc-desc-${index}`}>Description</Label>
                        <Textarea
                          id={`uc-desc-${index}`}
                          value={uc.description}
                          onChange={(e) =>
                            updatePreviewItem(index, {
                              description: e.target.value,
                            })
                          }
                          className="min-h-[100px] text-[13px] leading-relaxed"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`uc-prio-${index}`}>Priorité</Label>
                        <Select
                          value={uc.priority}
                          onValueChange={(v) =>
                            updatePreviewItem(index, {
                              priority: v,
                            })
                          }
                        >
                          <SelectTrigger id={`uc-prio-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Haute">Haute</SelectItem>
                            <SelectItem value="Moyenne">Moyenne</SelectItem>
                            <SelectItem value="Basse">Basse</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBackToJson}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour au JSON
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleConfirmImport()}
                    disabled={
                      importing ||
                      !currentWorkspaceId ||
                      backlogId == null ||
                      previewItems.length === 0
                    }
                    className="gap-2"
                  >
                    {importing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Valider et importer
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
