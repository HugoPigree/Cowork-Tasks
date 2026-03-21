import { ListChecks } from "lucide-react"
import type { SuggestedTaskTemplate } from "@/lib/types"
import { formatUcTitle } from "@/lib/formatUcTitle"
import { cn } from "@/lib/utils"

type Props = {
  items: SuggestedTaskTemplate[]
  picked: Set<number>
  onToggle: (index: number) => void
  onPickAll: () => void
  onPickNone: () => void
}

export function SuggestedTasksList({
  items,
  picked,
  onToggle,
  onPickAll,
  onPickNone,
}: Props) {
  if (items.length === 0) return null

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-foreground">
            Propositions ({items.length})
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={onPickAll}
          >
            Tout cocher
          </button>
          <button
            type="button"
            className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={onPickNone}
          >
            Tout décocher
          </button>
        </div>
      </div>
      <ul className="max-h-[min(280px,42vh)] space-y-1.5 overflow-y-auto pr-0.5">
        {items.map((s, i) => (
          <li
            key={`${s.title}-${i}`}
            className={cn(
              "rounded-md border px-2.5 py-2 transition-colors duration-200",
              picked.has(i)
                ? "border-foreground/20 bg-muted/50"
                : "border-border/40 bg-background/90 hover:border-border/70"
            )}
          >
            <label className="flex cursor-pointer gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border"
                checked={picked.has(i)}
                onChange={() => onToggle(i)}
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-[13px] font-medium leading-snug text-foreground">
                  {formatUcTitle(i, s.title)}
                </span>
                <span className="block whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                  {s.description}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
