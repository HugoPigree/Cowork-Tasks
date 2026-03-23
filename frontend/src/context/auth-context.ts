import { createContext } from "react"

export type RegisterPayload = {
  username: string
  email: string
  password: string
  password_confirm: string
  avatar_url?: string
}

export type AuthContextValue = {
  username: string | null
  userId: number | null
  avatarUrl: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  register: (payload: RegisterPayload | FormData) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
