import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import { WorkspaceProvider } from "@/context/WorkspaceContext"
import { LoginPage } from "@/pages/LoginPage"
import { RegisterPage } from "@/pages/RegisterPage"
import { TasksPage } from "@/pages/TasksPage"
import { WorkspacesPage } from "@/pages/WorkspacesPage"
import { useAuth } from "@/context/AuthContext"

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function WorkspaceLayout() {
  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        }
      />
      <Route
        element={
          <Protected>
            <WorkspaceLayout />
          </Protected>
        }
      >
        <Route path="/" element={<TasksPage />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
