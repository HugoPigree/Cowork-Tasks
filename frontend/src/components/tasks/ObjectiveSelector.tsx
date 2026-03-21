import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ObjectiveSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  objectives: ObjectiveSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
}

export function ObjectiveSelector({
  open,
  onOpenChange,
  objectives,
  selectedId,
  onSelect,
  loading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(520px,90vh)] gap-0 overflow-hidden border-border/60 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/50 px-4 py-3 text-left">
          <DialogTitle className="text-sm font-semibold tracking-tight">
            Choisir un objectif
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Un objectif à la fois — les propositions UC suivront ce thème.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[min(340px,52vh)]">
            <div className="grid grid-cols-1 gap-1.5 p-2.5 sm:grid-cols-2">
              {objectives.map((o) => {
                const active = selectedId === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onSelect(o.id)}
                    className={cn(
                      "rounded-md border px-2.5 py-2 text-left transition-all duration-200",
                      active
                        ? "border-foreground/30 bg-muted/60 shadow-sm ring-1 ring-foreground/10"
                        : "border-border/50 bg-card hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <span className="block text-[13px] font-medium leading-tight text-foreground">
                      {o.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {o.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}
        <div className="flex justify-end border-t border-border/50 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
