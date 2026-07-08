import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { MenuPrincipal } from './pages/MenuPrincipal'
import { Operacao } from './pages/Operacao'
import { Gestao } from './pages/Gestao'
import { IndicadorDetalhe } from './pages/IndicadorDetalhe'
import { HistoricoEnvios } from './pages/HistoricoEnvios'
import { HistoricoKPI } from './pages/HistoricoKPI'
import { Usuarios } from './pages/Usuarios'
import { useThemeStore } from './store/themeStore'

export default function App() {
  const theme = useThemeStore((state) => state.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/menu" replace />} />

        <Route path="/menu" element={<ProtectedRoute><MenuPrincipal /></ProtectedRoute>} />
        <Route path="/operacao" element={<ProtectedRoute roles={['admin', 'gestor']}><Operacao /></ProtectedRoute>} />
        <Route path="/gestao" element={<ProtectedRoute roles={['admin', 'gestor', 'readonly', 'auditor']}><Gestao /></ProtectedRoute>} />
        <Route path="/indicador/:cod" element={<ProtectedRoute roles={['admin', 'gestor', 'readonly', 'auditor']}><IndicadorDetalhe /></ProtectedRoute>} />
        <Route path="/historico" element={<ProtectedRoute roles={['admin', 'gestor']}><HistoricoEnvios /></ProtectedRoute>} />
        <Route path="/historico-kpi" element={<ProtectedRoute roles={['admin', 'gestor', 'readonly', 'auditor']}><HistoricoKPI /></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute roles={['admin']}><Usuarios /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
    </HashRouter>
  )
}
