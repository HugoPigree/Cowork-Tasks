import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, tasksApi } from "@/lib/api"
import type { TaskComment } from "@/lib/types"
import { UserAvatar } from "@/components/UserAvatar"
import { FORMATTED_MULTILINE } from "@/lib/formattedText"
import { cn } from "@/lib/utils"

type Props = {
  taskId: number | null
  open: boolean
}

export function CommentSection({ taskId, open }: Props) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    try {
      const list = await tasksApi.listComments(taskId)
      setComments(list)
    } catch {
      toast.error("Impossible de charger les commentaires")
      setComments([])
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    if (!open || !taskId) return
    void load()
  }, [open, taskId, load])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!taskId || !body.trim()) return
    setSending(true)
    try {
      const c = await tasksApi.addComment(taskId, body.trim())
      setComments((prev) => [...prev, c])
      setBody("")
      toast.success("Commentaire ajouté")
    } catch (err) {
      if (err instanceof ApiError) toast.error("Envoi refusé")
      else toast.error("Erreur réseau")
    } finally {
      setSending(false)
    }
  }

  if (!taskId) return null

  return (
    <section className="space-y-4 pb-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Commentaires
        </h3>
        {loading ? (
          <span className="text-xs text-muted-foreground">Chargement…</span>
        ) : null}
      </div>
      <ScrollArea className="max-h-[min(200px,35vh)] rounded-md border border-border/60 bg-muted/20 dark:bg-muted/10">
        <ul className="space-y-6 p-4">
          {comments.length === 0 && !loading ? (
            <li className="text-sm leading-relaxed text-muted-foreground">
              Aucun commentaire pour l’instant — utilisez le champ ci-dessous.
            </li>
          ) : null}
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0" title={`@${c.author.username}`}>
                  <UserAvatar
                    src={c.author.avatar}
                    username={c.author.username}
                    firstName={c.author.first_name}
                  />
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <span className="text-sm font-semibold text-foreground">
                      @{c.author.username}
                    </span>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={c.created_at}
                    >
                      {new Date(c.created_at).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  <p
                    className={cn(
                      FORMATTED_MULTILINE,
                      "max-w-[65ch] text-foreground"
                    )}
                  >
                    {c.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
      <form
        onSubmit={(e) => void handleSend(e)}
        className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm"
      >
        <label
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          htmlFor="new-comment"
        >
          Nouveau commentaire
        </label>
        <Textarea
          id="new-comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Écrire un commentaire…"
          rows={4}
          className={cn(
            FORMATTED_MULTILINE,
            "min-h-[104px] resize-y"
          )}
        />
        <div className="flex justify-end pt-0.5">
          <Button type="submit" size="sm" disabled={sending || !body.trim()}>
            {sending ? "…" : "Publier"}
          </Button>
        </div>
      </form>
    </section>
  )
}
