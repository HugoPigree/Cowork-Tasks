import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { authApi } from "@/lib/api"
import { AuthContext, type RegisterPayload } from "./auth-context"

const STORAGE_USER = "tm_username"
const STORAGE_USER_ID = "tm_user_id"
const STORAGE_AVATAR = "tm_avatar"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_USER)
  )
  const [userId, setUserId] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_USER_ID)
    if (!raw) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    const a = localStorage.getItem(STORAGE_AVATAR)
    return a || null
  })

  useEffect(() => {
    if (!username || !localStorage.getItem("access")) return
    void authApi
      .me()
      .then((me) => {
        localStorage.setItem(STORAGE_USER_ID, String(me.id))
        setUserId(me.id)
        const av = me.avatar ?? ""
        setAvatarUrl(av || null)
        if (av) localStorage.setItem(STORAGE_AVATAR, av)
        else localStorage.removeItem(STORAGE_AVATAR)
      })
      .catch(() => {})
  }, [username])

  const login = useCallback(async (u: string, password: string) => {
    const tokens = await authApi.login(u, password)
    localStorage.setItem("access", tokens.access)
    localStorage.setItem("refresh", tokens.refresh)
    localStorage.setItem(STORAGE_USER, u)
    if (tokens.user) {
      localStorage.setItem(STORAGE_USER_ID, String(tokens.user.id))
      setUserId(tokens.user.id)
      const av = tokens.user.avatar ?? ""
      setAvatarUrl(av || null)
      if (av) localStorage.setItem(STORAGE_AVATAR, av)
      else localStorage.removeItem(STORAGE_AVATAR)
    } else {
      try {
        const me = await authApi.me()
        localStorage.setItem(STORAGE_USER_ID, String(me.id))
        setUserId(me.id)
        const av = me.avatar ?? ""
        setAvatarUrl(av || null)
        if (av) localStorage.setItem(STORAGE_AVATAR, av)
        else localStorage.removeItem(STORAGE_AVATAR)
      } catch {
        setUserId(null)
        setAvatarUrl(null)
      }
    }
    setUsername(u)
  }, [])

  const register = useCallback(async (payload: RegisterPayload | FormData) => {
    await authApi.register(payload)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("access")
    localStorage.removeItem("refresh")
    localStorage.removeItem(STORAGE_USER)
    localStorage.removeItem(STORAGE_USER_ID)
    localStorage.removeItem(STORAGE_AVATAR)
    setUsername(null)
    setUserId(null)
    setAvatarUrl(null)
  }, [])

  const isAuthenticated = Boolean(
    username && localStorage.getItem("access")
  )

  const value = useMemo(
    () => ({
      username,
      userId,
      avatarUrl,
      isAuthenticated,
      login,
      register,
      logout,
    }),
    [username, userId, avatarUrl, isAuthenticated, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
