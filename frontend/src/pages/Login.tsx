import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Eye, EyeOff, PlayCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { ThemeToggle } from '../components/ThemeToggle'
import { isDemoMode } from '../api/client'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/menu')
    } catch {
      toast.error('Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setLoading(true)
    try {
      await login('admin@example.com', 'demo')
      navigate('/menu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      <div className="fixed right-6 top-6 z-10">
        <ThemeToggle />
      </div>

      {/* left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-empresa-blue to-empresa-blue-dark p-12 text-white">
        <div className="flex items-center gap-3">
          <BarChart2 size={28} className="text-blue-300" />
          <span className="text-xl font-bold tracking-tight">Portal SMD</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Indicadores<br />de Desempenho<br />SMD
          </h2>
          <p className="text-blue-200 text-sm max-w-xs">
            Monitoramento e envio dos 31 indicadores contratuais.
          </p>
        </div>
        <p className="text-blue-300/60 text-xs">SMD v2.0</p>
      </div>

      {/* right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <BarChart2 size={22} className="text-empresa-blue" />
            <span className="text-lg font-bold text-empresa-blue">Portal SMD</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Bem-vindo</h1>
          <p className="text-sm text-gray-500 mb-8">Entre com suas credenciais para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
                autoFocus
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  required
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-2.5 text-base"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {isDemoMode && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-empresa-blue text-empresa-blue font-semibold py-2.5 text-base hover:bg-blue-50 transition-colors"
              >
                <PlayCircle size={18} />
                Entrar como Admin (Demo)
              </button>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Acesso instantâneo com dados fictícios — sem cadastro, sem backend real.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
