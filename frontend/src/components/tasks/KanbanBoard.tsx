import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { UniqueIdentifier } from "@dnd-kit/core"
import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { TaskCard } from "@/components/tasks/TaskCard"
import { Button } from "@/components/ui/button"
import type { BoardColumn, Task, TaskReorderItem } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Évite toute collision d’id entre une tâche et une colonne (même id numérique). */
const COL_PREFIX = "col:"

function columnDroppableId(columnId: number): string {
  return `${COL_PREFIX}${columnId}`
}

function isColumnDroppableId(id: UniqueIdentifier): boolean {
  return String(id).startsWith(COL_PREFIX)
}

function parseColumnDroppableId(id: UniqueIdentifier): number | null {
  const s = String(id)
  if (!s.startsWith(COL_PREFIX)) return null
  const n = Number(s.slice(COL_PREFIX.length))
  return Number.isNaN(n) ? null : n
}

function sortedColumnIds(columns: BoardColumn[]): number[] {
  return [...columns]
    .sort((a, b) => a.position - b.position || a.id - b.id)
    .map((c) => c.id)
}

function emptyBuckets(columnIds: number[]): Record<number, string[]> {
  const o: Record<number, string[]> = {}
  for (const id of columnIds) o[id] = []
  return o
}

function buildColumns(
  tasks: Task[],
  columnIds: number[]
): Record<number, string[]> {
  const next = emptyBuckets(columnIds)
  const byCol = new Map<number, Task[]>()
  for (const id of columnIds) byCol.set(id, [])
  for (const t of tasks) {
    const cid = t.board_column?.id
    if (cid != null && next[cid] !== undefined) {
      byCol.get(cid)!.push(t)
    }
  }
  for (const id of columnIds) {
    const group = byCol.get(id) ?? []
    group.sort(
      (a, b) =>
        a.position - b.position ||
        +new Date(b.created_at) - +new Date(a.created_at)
    )
    next[id] = group.map((t) => String(t.id))
  }
  return next
}

function taskContainer(
  taskId: string,
  buckets: Record<number, string[]>
): number | null {
  for (const colId of Object.keys(buckets).map(Number)) {
    if (buckets[colId]?.includes(taskId)) return colId
  }
  return null
}

function toReorderPayload(
  buckets: Record<number, string[]>,
  columnOrder: number[]
): TaskReorderItem[] {
  const out: TaskReorderItem[] = []
  for (const colId of columnOrder) {
    const ids = buckets[colId] ?? []
    ids.forEach((id, index) => {
      out.push({ id: Number(id), column_id: colId, position: index })
    })
  }
  return out
}

/** Colonne survolée (pour surbrillance), dérivée de `over.id`. */
function resolveOverColumnId(
  overId: UniqueIdentifier | undefined,
  buckets: Record<number, string[]>
): number | null {
  if (overId == null) return null
  if (isColumnDroppableId(overId)) {
    return parseColumnDroppableId(overId)
  }
  return taskContainer(String(overId), buckets)
}

function createKanbanCollisionDetection(
  columnIds: number[]
): CollisionDetection {
  return (args) => {
    const colIds = new Set(columnIds.map((id) => columnDroppableId(id)))

    const pointerHits = pointerWithin(args)
    if (pointerHits.length > 0) {
      const taskFirst = pointerHits.find((c) => !colIds.has(String(c.id)))
      if (taskFirst) return [taskFirst]
      const colFirst = pointerHits.find((c) => colIds.has(String(c.id)))
      if (colFirst) return [colFirst]
      return pointerHits
    }

    const rectHits = rectIntersection(args)
    if (rectHits.length > 0) {
      const taskFirst = rectHits.find((c) => !colIds.has(String(c.id)))
      if (taskFirst) return [taskFirst]
      return rectHits
    }

    return closestCorners(args)
  }
}

/** Applique un déplacement pendant le survol (aperçu fluide, une seule carte « active »). */
function applyDragOverMove(
  prev: Record<number, string[]>,
  columnIds: number[],
  activeIdStr: string,
  overId: UniqueIdentifier
): Record<number, string[]> | null {
  const activeCol = taskContainer(activeIdStr, prev)
  if (activeCol === null) return null

  let overCol: number
  let overIndexInCol: number

  if (isColumnDroppableId(overId)) {
    const parsed = parseColumnDroppableId(overId)
    if (parsed === null || !columnIds.includes(parsed)) return null
    overCol = parsed
    overIndexInCol = prev[overCol]?.length ?? 0
  } else {
    const overStr = String(overId)
    const oc = taskContainer(overStr, prev)
    if (oc === null) return null
    overCol = oc
    overIndexInCol = prev[overCol].indexOf(overStr)
    if (overIndexInCol < 0) return null
  }

  const next: Record<number, string[]> = {}
  for (const cid of columnIds) {
    next[cid] = [...(prev[cid] ?? [])]
  }

  if (activeCol === overCol) {
    const list = [...next[activeCol]]
    const oldIndex = list.indexOf(activeIdStr)
    if (oldIndex < 0) return null

    if (isColumnDroppableId(overId)) {
      const newIndex = list.length - 1
      if (oldIndex === newIndex) return null
      next[activeCol] = arrayMove(list, oldIndex, newIndex)
      return next
    }

    const newIndex = list.indexOf(String(overId))
    if (newIndex < 0 || oldIndex === newIndex) return null
    next[activeCol] = arrayMove(list, oldIndex, newIndex)
    return next
  }

  next[activeCol] = next[activeCol].filter((id) => id !== activeIdStr)
  const dest = [...next[overCol]]
  let insertAt = overIndexInCol
  if (isColumnDroppableId(overId)) {
    insertAt = dest.length
  } else {
    const idx = dest.indexOf(String(overId))
    insertAt = idx >= 0 ? idx : dest.length
  }
  insertAt = Math.min(insertAt, dest.length)
  dest.splice(insertAt, 0, activeIdStr)
  next[overCol] = dest
  return next
}

function KanbanColumn({
  column,
  items,
  children,
  onAddCard,
  isHighlighted,
}: {
  column: BoardColumn
  items: string[]
  children: React.ReactNode
  onAddCard?: (columnId: number) => void
  /** Survol actif (collision) pendant un drag */
  isHighlighted: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(column.id),
  })
  const wip = column.wip_limit
  const countLabel =
    wip != null ? `${items.length} / ${wip}` : String(items.length)
  const wipExceeded = wip != null && items.length > wip
  const showGlow = isOver || isHighlighted

  return (
    <section
      className={cn(
        "flex w-[min(100vw-2rem,300px)] shrink-0 flex-col rounded-xl transition-[box-shadow,background-color] duration-200 sm:w-[300px] lg:w-[308px]",
        showGlow && "bg-primary/[0.04] ring-2 ring-primary/35 ring-offset-2 ring-offset-background"
      )}
    >
      <header className="space-y-2 px-0.5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_2px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_2px_rgba(255,255,255,0.08)]"
                style={{ backgroundColor: column.color }}
                aria-hidden
              />
              <h3 className="text-sm font-semibold tracking-tight">
                {column.name}
              </h3>
              <span
                className={cn(
                  "rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground",
                  wipExceeded && "border-destructive/60 text-destructive"
                )}
              >
                {countLabel}
              </span>
            </div>
            {wip != null ? (
              <p className="text-xs text-muted-foreground">
                Limite WIP : {wip} carte{wip > 1 ? "s" : ""}
              </p>
            ) : null}
          </div>
          {onAddCard ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={`Ajouter une tâche dans ${column.name}`}
              onClick={() => onAddCard(column.id)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[min(320px,40vh)] max-h-[min(70vh,560px)] flex-1 flex-col overflow-hidden rounded-lg border-2 border-transparent bg-muted/30 p-2 transition-colors duration-200 dark:bg-muted/15",
          showGlow &&
            "border-primary/45 bg-primary/[0.08] dark:bg-primary/[0.12]"
        )}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-3 [scrollbar-width:thin]",
              items.length === 0 && "min-h-[120px] justify-center"
            )}
          >
            {children}
            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Aucun item — déposez une carte ou cliquez sur +.
              </p>
            ) : null}
          </div>
        </SortableContext>
      </div>
    </section>
  )
}

function DropSlotLine() {
  return (
    <div
      className="mx-0.5 h-1 shrink-0 rounded-full bg-primary/50 ring-1 ring-primary/25"
      aria-hidden
    />
  )
}

function SortableTaskRow({
  task,
  onOpen,
  selected,
  workspaceName,
  activeDragId,
  overId,
  isFirstInColumn,
  displayColumn,
}: {
  task: Task
  onOpen: () => void
  selected?: boolean
  workspaceName?: string
  activeDragId: string | null
  overId: UniqueIdentifier | null
  isFirstInColumn: boolean
  displayColumn: { name: string; color: string }
}) {
  const idStr = String(task.id)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: idStr })

  /* Avec DragOverlay : seule la copie flottante est visible. Masquer la source (y compris après
     saut de colonne, où le nouveau nœud useSortable n’a parfois pas encore `isDragging`). */
  const hideSource = activeDragId === idStr || isDragging

  const style = {
    transform: CSS.Transform.toString(transform),
    /* Pas de transition pendant le drag : évite un court chevauchement visuel avec l’overlay. */
    transition: hideSource || isDragging ? undefined : transition,
  }

  const showLineAbove =
    activeDragId != null &&
    overId != null &&
    String(overId) === idStr &&
    activeDragId !== idStr &&
    !isColumnDroppableId(overId)

  const isDropTarget =
    activeDragId != null &&
    overId != null &&
    String(overId) === idStr &&
    activeDragId !== idStr

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        hideSource && "pointer-events-none invisible"
      )}
      aria-hidden={hideSource}
    >
      {showLineAbove ? (
        <div className={cn(!isFirstInColumn && "-mt-1 mb-1")}>
          <DropSlotLine />
        </div>
      ) : null}
      <TaskCard
        task={task}
        workspaceName={workspaceName}
        displayColumn={displayColumn}
        selected={selected}
        dragAttributes={attributes as unknown as Record<string, unknown>}
        dragListeners={listeners as unknown as Record<string, unknown>}
        isDragging={false}
        isDropTarget={isDropTarget}
        onOpen={onOpen}
      />
    </div>
  )
}

export type KanbanBoardProps = {
  workspaceId: number
  workspaceName?: string
  columns: BoardColumn[]
  tasks: Task[]
  selectedTaskId?: number | null
  onPersistOrder: (items: TaskReorderItem[]) => Promise<void>
  onOpenTask: (task: Task) => void
  onAddTask?: (columnId: number) => void
  canManageColumns?: boolean
  onRequestAddColumn?: () => void
}

/** Sans sideEffects custom : évite de ré-afficher la carte source en semi-transparent (effet « double »). */
const dropAnimation = {
  duration: 200,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
}

export function KanbanBoard({
  workspaceId: boardWorkspaceId,
  workspaceName,
  columns,
  tasks,
  selectedTaskId,
  onPersistOrder,
  onOpenTask,
  onAddTask,
  canManageColumns,
  onRequestAddColumn,
}: KanbanBoardProps) {
  const columnIds = useMemo(() => sortedColumnIds(columns), [columns])

  const tasksById = useMemo(() => {
    const m = new Map<string, Task>()
    for (const t of tasks) m.set(String(t.id), t)
    return m
  }, [tasks])

  const [buckets, setBuckets] = useState<Record<number, string[]>>(() =>
    buildColumns(tasks, columnIds)
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null)
  /** Évite de réécraser `buckets` avec d’anciennes `tasks` avant le refetch API. */
  const dragSessionRef = useRef(false)

  const bucketsRef = useRef(buckets)
  bucketsRef.current = buckets

  const collisionDetection = useMemo(
    () => createKanbanCollisionDetection(columnIds),
    [columnIds]
  )

  useEffect(() => {
    if (dragSessionRef.current) return
    setBuckets(buildColumns(tasks, columnIds))
  }, [tasks, columnIds])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const persist = useCallback(
    async (snapshot: Record<number, string[]>) => {
      const payload = toReorderPayload(snapshot, columnIds)
      await onPersistOrder(payload)
    },
    [onPersistOrder, columnIds]
  )

  const onDragStart = (e: DragStartEvent) => {
    dragSessionRef.current = true
    setActiveId(String(e.active.id))
    setOverId(null)
  }

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    setOverId(over?.id ?? null)
    if (!over || !active) return

    const activeStr = String(active.id)
    if (isColumnDroppableId(activeStr)) return

    setBuckets((prev) => {
      const moved = applyDragOverMove(prev, columnIds, activeStr, over.id)
      if (!moved) return prev
      let same = true
      for (const cid of columnIds) {
        const a = prev[cid] ?? []
        const b = moved[cid] ?? []
        if (a.length !== b.length) {
          same = false
          break
        }
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) {
            same = false
            break
          }
        }
        if (!same) break
      }
      return same ? prev : moved
    })
  }

  const onDragCancel = () => {
    dragSessionRef.current = false
    setActiveId(null)
    setOverId(null)
    setBuckets(buildColumns(tasks, columnIds))
  }

  const onDragEnd = async (e: DragEndEvent) => {
    const { over } = e
    setActiveId(null)
    setOverId(null)

    if (!over) {
      dragSessionRef.current = false
      setBuckets(buildColumns(tasks, columnIds))
      return
    }

    const latest = bucketsRef.current

    const doneColumnIds = new Set(
      columns
        .filter((c) => c.maps_to_status === "done")
        .map((c) => c.id)
    )
    for (const cid of columnIds) {
      if (!doneColumnIds.has(cid)) continue
      for (const tid of latest[cid] ?? []) {
        const t = tasksById.get(tid)
        if (t?.is_blocked) {
          toast.error(
            "Une tâche bloquée ne peut pas être placée en Terminé. Terminez d’abord les dépendances."
          )
          dragSessionRef.current = false
          setBuckets(buildColumns(tasks, columnIds))
          return
        }
      }
    }

    try {
      await persist(latest)
    } catch {
      setBuckets(buildColumns(tasks, columnIds))
    } finally {
      dragSessionRef.current = false
    }
  }

  const activeTask = activeId ? tasksById.get(activeId) ?? null : null

  const overlayDisplayColumn = useMemo(() => {
    if (!activeId) return undefined
    const colId = taskContainer(activeId, buckets)
    if (colId == null) return undefined
    const col = columns.find((c) => c.id === colId)
    if (!col) return undefined
    return { name: col.name, color: col.color }
  }, [activeId, buckets, columns])

  const overColumnId = useMemo(
    () => resolveOverColumnId(overId ?? undefined, buckets),
    [overId, buckets]
  )

  if (columns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        <p>Aucune colonne sur ce tableau.</p>
        {canManageColumns && onRequestAddColumn ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={onRequestAddColumn}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une colonne
          </Button>
        ) : (
          <p className="mt-2 text-xs">
            Demandez à un propriétaire ou administrateur d’ajouter des colonnes.
          </p>
        )}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={(ev) => void onDragEnd(ev)}
      onDragCancel={onDragCancel}
    >
      <div
        key={boardWorkspaceId}
        className="rounded-2xl border border-border/50 bg-muted/35 p-4 shadow-inner shadow-black/[0.03]"
      >
        <div className="flex gap-0 divide-x divide-border/60 overflow-x-auto overflow-y-visible pb-1 [scrollbar-width:thin]">
          {columns
            .slice()
            .sort((a, b) => a.position - b.position || a.id - b.id)
            .map((col, index, arr) => {
              const colItems = buckets[col.id] ?? []
              const showAddSlot = Boolean(
                canManageColumns && onRequestAddColumn
              )
              const isLastCol = index === arr.length - 1
              return (
                <div
                  key={col.id}
                  className={cn(
                    "shrink-0 pr-4 sm:pr-5",
                    index > 0 && "pl-4 sm:pl-5",
                    isLastCol && !showAddSlot && "pr-0"
                  )}
                >
                  <KanbanColumn
                    column={col}
                    items={colItems}
                    onAddCard={onAddTask}
                    isHighlighted={
                      activeId != null && overColumnId === col.id
                    }
                  >
                    {colItems.map((id, index) => {
                      const task = tasksById.get(id)
                      if (!task) return null
                      return (
                        <SortableTaskRow
                          key={id}
                          task={task}
                          workspaceName={workspaceName}
                          selected={selectedTaskId === task.id}
                          activeDragId={activeId}
                          overId={overId}
                          isFirstInColumn={index === 0}
                          displayColumn={{
                            name: col.name,
                            color: col.color,
                          }}
                          onOpen={() => onOpenTask(task)}
                        />
                      )
                    })}
                  </KanbanColumn>
                </div>
              )
            })}
          {canManageColumns && onRequestAddColumn ? (
            <div className="flex w-[min(100vw-2rem,300px)] shrink-0 flex-col pl-4 sm:w-[300px] sm:pl-5 lg:w-[308px]">
              <div className="min-h-[min(320px,40vh)] flex-1 rounded-lg border-2 border-dashed border-border/60 bg-muted/10 p-2">
                <button
                  type="button"
                  onClick={onRequestAddColumn}
                  className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <Plus className="h-6 w-6" />
                  Ajouter une colonne
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <DragOverlay
        dropAnimation={dropAnimation}
        className="pointer-events-none z-50"
      >
        {activeTask ? (
          <TaskCard
            task={activeTask}
            workspaceName={workspaceName}
            displayColumn={overlayDisplayColumn}
            isDragging
            className="w-[min(100vw-2rem,280px)] rotate-1 scale-[1.03] cursor-grabbing shadow-2xl"
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
