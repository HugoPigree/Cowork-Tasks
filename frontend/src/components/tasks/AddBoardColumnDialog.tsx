import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { boardColumnFormSchema, type BoardColumnFormValues } from "@/lib/schemas"
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

function wipStrToLimit(wipStr: string): number | null {
  const w = wipStr.trim()
  if (w === "") return null
  const n = parseInt(w, 10)
  if (Number.isNaN(n)) return null
  return Math.min(99, Math.max(1, n))
}

export function AddBoardColumnDialog({
  open,
  onOpenChange,
  onSubmit,
}: Props) {
  const form = useForm<BoardColumnFormValues>({
    resolver: zodResolver(boardColumnFormSchema),
    defaultValues: {
      name: "",
      maps_to_status: "todo",
      wipStr: "",
      color: COLOR_PRESETS[5],
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: "",
      maps_to_status: "todo",
      wipStr: "",
      color: COLOR_PRESETS[5],
    })
  }, [open, form])

  async function onFormSubmit(values: BoardColumnFormValues) {
    try {
      await onSubmit({
        name: values.name.trim(),
        maps_to_status: values.maps_to_status,
        wip_limit: wipStrToLimit(values.wipStr),
        color: values.color,
      })
      onOpenChange(false)
    } catch {
      /* toast côté parent */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <DialogHeader>
              <DialogTitle className="text-lg">Nouvelle colonne</DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed">
                Visible par tout l’espace. Le statut associé sert aux filtres et
                à la synchro des tâches.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex. Blocked, QA…"
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
                name="maps_to_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut (filtres)</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="todo">À faire</SelectItem>
                        <SelectItem value="in_progress">En cours</SelectItem>
                        <SelectItem value="done">Terminé</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="wipStr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite WIP (optionnel)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        inputMode="numeric"
                        placeholder="Aucune limite"
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
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          title={c}
                          className={cn(
                            "h-8 w-8 rounded-full border-2 border-transparent shadow-sm ring-offset-background transition-[box-shadow,transform] hover:scale-105",
                            field.value === c &&
                              "ring-2 ring-ring ring-offset-2"
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
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "…" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
