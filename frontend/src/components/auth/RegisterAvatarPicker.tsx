import { useId, useMemo } from "react"
import { Dices, ImagePlus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UserAvatar } from "@/components/UserAvatar"

export type RegisterAvatarChoice =
  | { kind: "none" }
  | { kind: "url"; url: string }
  | { kind: "file"; file: File; previewUrl: string }

function dicebearInitials(seed: string) {
  const s = seed.trim() || "user"
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(s)}&backgroundType=gradientLinear`
}

function dicebearRandom(seed: string) {
  return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(seed)}`
}

type Props = {
  username: string
  value: RegisterAvatarChoice
  onChange: (next: RegisterAvatarChoice) => void
}

export function RegisterAvatarPicker({ username, value, onChange }: Props) {
  const inputId = useId()

  const generatedUrl = useMemo(
    () => dicebearInitials(username),
    [username]
  )

  const previewSrc =
    value.kind === "file"
      ? value.previewUrl
      : value.kind === "url"
        ? value.url
        : null

  function pickGenerated() {
    onChange({ kind: "url", url: generatedUrl })
  }

  function pickRandom() {
    onChange({
      kind: "url",
      url: dicebearRandom(
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now())
      ),
    })
  }

  function pickNone() {
    if (value.kind === "file") URL.revokeObjectURL(value.previewUrl)
    onChange({ kind: "none" })
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/")) return
    if (value.kind === "file") URL.revokeObjectURL(value.previewUrl)
    const previewUrl = URL.createObjectURL(f)
    onChange({ kind: "file", file: f, previewUrl })
    e.target.value = ""
  }

  return (
    <div className="space-y-3">
      <Label>Photo de profil</Label>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border/70 bg-muted/40 p-1">
          <UserAvatar
            src={previewSrc}
            username={username.trim() || "?"}
            size="lg"
            className="!h-[5.5rem] !w-[5.5rem] !text-lg"
          />
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={pickGenerated}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Initiales
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={pickRandom}
            >
              <Dices className="h-3.5 w-3.5" />
              Aléatoire
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <label htmlFor={inputId} className="cursor-pointer">
                <ImagePlus className="h-3.5 w-3.5" />
                Importer
              </label>
            </Button>
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={onFileChange}
            />
            {(value.kind === "url" || value.kind === "file") && (
              <Button type="button" variant="ghost" size="sm" onClick={pickNone}>
                Aucune
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Initiales générées à partir du nom d&apos;utilisateur, avatar pixel art
            aléatoire, ou image (max. 2 Mo côté serveur).
          </p>
        </div>
      </div>
    </div>
  )
}
