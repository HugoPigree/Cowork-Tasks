import { useCallback, useEffect, useState } from "react"
import {
  ChevronRight,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react"
import { toast } from "sonner"
import { ObjectiveSelector } from "@/components/tasks/ObjectiveSelector"
import { SuggestedTasksList } from "@/components/tasks/SuggestedTasksList"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ApiError, objectivesApi, tasksApi } from "@/lib/api"
import type { BoardColumn, ObjectiveSummary, SuggestedTaskTemplate } from "@/lib/types"
import { backlogColumnId } from "@/lib/backlogColumn"
import { formatUcTitle } from "@/lib/formatUcTitle"

type Props = {
  workspaceId: number
  columns: BoardColumn[]
  onTasksCreated: () => void | Promise<void>
}

export function BacklogObjectivePanel({
  workspaceId,
  columns,
  onTasksCreated,
}: Props) {
  const [objectives, setObjectives] = useState<ObjectiveSummary[]>([])
  const [loadingObjectives, setLoadingObjectives] = useState(true)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestedTaskTemplate[]>([])
  const [picked, setPicked] = useState<Set<number>>(() => new Set())
  const [loadingGenerate, setLoadingGenerate] = useState(false)
  const [loadingAdd, setLoadingAdd] = useState(false)

  const columnId = backlogColumnId(columns)

  const loadObjectives = useCallback(async () => {
    setLoadingObjectives(true)
    try {
      const list = await objectivesApi.list()
      setObjectives(list)
    } catch {
      toast.error("Impossible de charger les objectifs")
      setObjectives([])
    } finally {
      setLoadingObjectives(false)
    }
  }, [])

  useEffect(() => {
    void loadObjectives()
  }, [loadObjectives])

  useEffect(() => {
    setSelectedId(null)
    setSuggestions([])
    setPicked(new Set())
  }, [workspaceId])

  const selectedMeta = selectedId
    ? objectives.find((o) => o.id === selectedId)
    : null

  function togglePick(i: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function onGenerate() {
    if (!selectedId) return
    setLoadingGenerate(true)
    try {
      const res = await objectivesApi.generate(selectedId)
      setSuggestions(res.suggestions)
      setPicked(new Set(res.suggestions.map((_, i) => i)))
    } catch (err) {
      if (err instanceof ApiError) toast.error("Génération refusée")
      else toast.error("Erreur réseau")
    } finally {
      setLoadingGenerate(false)
    }
  }

  async function onAddToBacklog() {
    if (columnId == null) {
      toast.error("Aucune colonne backlog disponible.")
      return
    }
    if (picked.size === 0) {
      toast.error("Cochez au moins une proposition.")
      return
    }
    const indices = [...picked].sort((a, b) => a - b)
    setLoadingAdd(true)
    try {
      for (const i of indices) {
        const t = suggestions[i]
        await tasksApi.create({
          workspace: workspaceId,
          title: formatUcTitle(i, t.title),
          description: t.description,
          board_column_id: columnId,
        })
      }
      toast.success(
        indices.length === 1
          ? "1 tâche ajoutée au backlog"
          : `${indices.length} tâches ajoutées au backlog`
      )
      setSuggestions([])
      setPicked(new Set())
      await onTasksCreated()
    } catch (err) {
      if (err instanceof ApiError) toast.error("Création de tâche refusée")
      else toast.error("Erreur réseau")
    } finally {
      setLoadingAdd(false)
    }
  }

  return (
    <>
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="space-y-0.5 border-b border-border/40 bg-muted/10 px-4 py-3 sm:px-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Backlog
          </p>
          <h2 className="text-base font-semibold tracking-tight">
            Objectif → UC
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Choisissez un objectif, générez des UC numérotées, ajoutez-les au
            backlog.
          </p>
        </CardHeader>
        <CardContent className="space-y-2.5 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              {selectedMeta ? (
                <div className="rounded-md border border-border/60 bg-muted/25 px-2.5 py-2 transition-colors">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Objectif actif
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedMeta.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    {selectedMeta.description}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Aucun objectif — cliquez sur « Choisir un objectif ».
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 border-border/70 text-xs"
              onClick={() => setSelectorOpen(true)}
            >
              <Target className="h-3.5 w-3.5" />
              Choisir un objectif
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium"
            disabled={!selectedId || loadingGenerate}
            onClick={() => void onGenerate()}
          >
            {loadingGenerate ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Générer les UC
          </Button>

          <SuggestedTasksList
            items={suggestions}
            picked={picked}
            onToggle={togglePick}
            onPickAll={() =>
              setPicked(new Set(suggestions.map((_, i) => i)))
            }
            onPickNone={() => setPicked(new Set())}
          />

          {suggestions.length > 0 ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/30 pt-2.5">
              {columnId == null ? (
                <p className="mr-auto text-xs text-amber-800">
                  Tableau requis pour la colonne Backlog.
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                disabled={loadingAdd || picked.size === 0 || columnId == null}
                onClick={() => void onAddToBacklog()}
              >
                {loadingAdd ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Ajouter au backlog
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ObjectiveSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        objectives={objectives}
        selectedId={selectedId}
        loading={loadingObjectives}
        onSelect={(id) => {
          setSelectedId(id)
          setSuggestions([])
          setPicked(new Set())
          setSelectorOpen(false)
        }}
      />
    </>
  )
}
