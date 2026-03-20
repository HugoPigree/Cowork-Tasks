import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { authApi } from "@/lib/api"

type AuthContextValue = {
  username: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  register: (payload: {
    username: string
    email: string
    password: string
    password_confirm: string
  }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_USER = "tm_username"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_USER)
  )

  const login = useCallback(async (u: string, password: string) => {
    const tokens = await authApi.login(u, password)
    localStorage.setItem("access", tokens.access)
    localStorage.setItem("refresh", tokens.refresh)
    localStorage.setItem(STORAGE_USER, u)
    setUsername(u)
  }, [])

  const register = useCallback(
    async (payload: {
      username: string
      email: string
      password: string
      password_confirm: string
    }) => {
      await authApi.register(payload)
    },
    []
  )

  const logout = useCallback(() => {
    localStorage.removeItem("access")
    localStorage.removeItem("refresh")
    localStorage.removeItem(STORAGE_USER)
    setUsername(null)
  }, [])

  const isAuthenticated = Boolean(
    username && localStorage.getItem("access")
  )

  const value = useMemo(
    () => ({
      username,
      isAuthenticated,
      login,
      register,
      logout,
    }),
    [username, isAuthenticated, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
