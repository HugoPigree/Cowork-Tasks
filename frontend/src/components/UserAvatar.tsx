import { cn } from "@/lib/utils"
import { userInitials } from "@/lib/userDisplay"

const sizeClass = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-11 w-11 text-xs",
  lg: "h-16 w-16 text-lg",
} as const

type Props = {
  /** URL image (upload ou DiceBear). */
  src?: string | null
  /** Pour les initiales si pas d’image. */
  username: string
  firstName?: string
  size?: keyof typeof sizeClass
  className?: string
}

export function UserAvatar({
  src,
  username,
  firstName,
  size = "sm",
  className,
}: Props) {
  const initials = userInitials({
    id: 0,
    username,
    first_name: firstName,
  })

  if (src?.trim()) {
    return (
      <img
        src={src.trim()}
        alt=""
        className={cn(
          "rounded-full object-cover ring-2 ring-border/60",
          sizeClass[size],
          className
        )}
      />
    )
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ring-2 ring-border/40",
        sizeClass[size],
        className
      )}
      aria-hidden
    >
      {initials}
    </span>
  )
}
