import { Link } from "react-router-dom"
import { LogOut, UserRound } from "lucide-react"
import { UserAvatar } from "@/components/UserAvatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/context/AuthContext"
import { cn } from "@/lib/utils"

export function UserAccountMenu({ className }: { className?: string }) {
  const { username, avatarUrl, logout } = useAuth()
  const u = username ?? "?"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 rounded-full p-0 hover:bg-muted/80",
            className
          )}
          aria-label="Menu compte"
        >
          <UserAvatar src={avatarUrl} username={u} size="sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
          <UserAvatar src={avatarUrl} username={u} size="md" />
          <span className="truncate font-medium">{u}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/workspaces" className="flex cursor-pointer items-center gap-2">
            <UserRound className="h-4 w-4" />
            Profil & espaces
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => logout()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
