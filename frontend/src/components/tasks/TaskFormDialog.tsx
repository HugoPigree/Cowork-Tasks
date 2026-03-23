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
import { Textarea } from "@/components/ui/textarea"
import { FORMATTED_MULTILINE } from "@/lib/formattedText"
import { taskFormSchema, type TaskFormValues } from "@/lib/schemas"
import type { Sprint, Task, TaskPriority, WorkspaceMember } from "@/lib/types"
import { cn } from "@/lib/utils"

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function taskToDefaults(task: Task | null): TaskFormValues {
  if (!task) {
    return {
      title: "",
      description: "",
      priority: "medium",
      dueLocal: "",
      assigneeKey: "__none__",
      sprintKey: "__none__",
    }
  }
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    dueLocal: toDatetimeLocal(task.due_date),
    assigneeKey: task.assignee ? String(task.assignee.id) : "__none__",
    sprintKey: task.sprint ? String(task.sprint.id) : "__none__",
  }
}

export type TaskSavePayload = {
  title: string
  description: string
  priority: TaskPriority
  due_date: string | null
  assignee_id: number | null
  sprint_id: number | null
  board_column_id?: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  members: WorkspaceMember[]
  sprints: Sprint[]
  onSave: (data: TaskSavePayload) => Promise<void>
  defaultColumnId?: number
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  members,
  sprints,
  onSave,
  defaultColumnId,
}: Props) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: taskToDefaults(task),
  })

  useEffect(() => {
    if (!open) return
    form.reset(taskToDefaults(task))
  }, [open, task, form])

  async function onSubmit(values: TaskFormValues) {
    const assignee_id =
      values.assigneeKey === "__none__"
        ? null
        : parseInt(values.assigneeKey, 10)
    const sprint_id =
      values.sprintKey === "__none__" ? null : parseInt(values.sprintKey, 10)
    await onSave({
      title: values.title.trim(),
      description: values.description,
      priority: values.priority,
      due_date: values.dueLocal
        ? new Date(values.dueLocal).toISOString()
        : null,
      assignee_id,
      sprint_id,
      board_column_id:
        !task && defaultColumnId != null ? defaultColumnId : undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg sm:rounded-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle className="text-lg">
                {task ? "Modifier la tâche" : "Nouvelle tâche"}
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed">
                Assignez un membre et un sprint pour clarifier le périmètre.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex. Intégration API" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Contexte, critères d’acceptation…"
                        rows={6}
                        className={cn(
                          FORMATTED_MULTILINE,
                          "min-h-[148px] resize-y"
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigneeKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigné à</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Non assigné</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={String(m.user.id)}>
                            {m.user.username}
                            {m.role === "owner" ? " (owner)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sprintKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sprint</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Aucun sprint</SelectItem>
                        {sprints.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: s.color }}
                                aria-hidden
                              />
                              {s.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priorité</FormLabel>
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
                        <SelectItem value="low">Basse</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueLocal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Échéance (optionnel)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "…"
                  : task
                    ? "Enregistrer"
                    : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
