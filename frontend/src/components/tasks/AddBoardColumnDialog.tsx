import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TaskStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const COLOR_PRESETS = [
  "#22c55e",
  "#3b82f6",
  "#ca8a04",
  "#9333ea",
  "#ea580c",
  "#6b7280",
] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    name: string
    maps_to_status: TaskStatus
    wip_limit: number | null
    color: string
  }) => Promise<void>
}

export function AddBoardColumnDialog({
  open,
  onOpenChange,
  onSubmit,
}: Props) {
  const [name, setName] = useState("")
  const [mapsTo, setMapsTo] = useState<TaskStatus>("todo")
  const [wipStr, setWipStr] = useState("")
  const [color, setColor] = useState<string>(COLOR_PRESETS[5])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setName("")
    setMapsTo("todo")
    setWipStr("")
    setColor(COLOR_PRESETS[5])
  }, [open])

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    const w = wipStr.trim()
    const n = parseInt(w, 10)
    const wip_limit =
      w === "" || Number.isNaN(n) ? null : Math.min(99, Math.max(1, n))
    setLoading(true)
    try {
      await onSubmit({
        name: name.trim(),
        maps_to_status: mapsTo,
        wip_limit,
        color,
      })
      onOpenChange(false)
    } catch {
      /* toast côté parent */
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(ev) => void handleFormSubmit(ev)}>
          <DialogHeader>
            <DialogTitle>Nouvelle colonne</DialogTitle>
            <DialogDescription>
              Visible par tout l’espace. Le statut associé sert aux filtres et à
              la synchro des tâches.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="col-name">Nom</Label>
              <Input
                id="col-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Blocked, QA…"
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label>Statut (filtres)</Label>
              <Select
                value={mapsTo}
                onValueChange={(v) => setMapsTo(v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="col-wip">Limite WIP (optionnel)</Label>
              <Input
                id="col-wip"
                type="number"
                min={1}
                max={99}
                inputMode="numeric"
                placeholder="Aucune limite"
                value={wipStr}
                onChange={(e) => setWipStr(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 border-transparent shadow-sm ring-offset-background transition-[box-shadow,transform] hover:scale-105",
                      color === c && "ring-2 ring-ring ring-offset-2"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
