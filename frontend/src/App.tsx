import { Routes, Route, Navigate } from 'react-router-dom'
import AuthLayout from './components/layout/AuthLayout'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ChatPage from './pages/chat/ChatPage'
import KnowledgePage from './pages/knowledge/KnowledgePage'
import ToolsPage from './pages/tools/ToolsPage'
import AdminPage from './pages/admin/AdminPage'
import { useAuthStore } from './store/authStore'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Routes>
      {/* 认证相关路由 */}
      <Route path="/auth/*" element={
        isAuthenticated ? <Navigate to="/chat" replace /> : <AuthLayout />
      }>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>

      {/* 主应用路由 */}
      <Route path="/*" element={
        isAuthenticated ? <MainLayout /> : <Navigate to="/auth/login" replace />
      }>
        <Route path="chat" element={<ChatPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route index element={<Navigate to="/chat" replace />} />
      </Route>
    </Routes>
  )
}

export default App
