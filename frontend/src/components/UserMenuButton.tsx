import { useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Eye, EyeOff, Key, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { changePassword } from '../api/auth'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  readonly: 'Leitura',
  auditor: 'Auditor Externo',
}

export function UserMenuButton() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPwModal, setShowPwModal] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const userName = user?.name?.trim() || 'Usuário'
  const nameParts = useMemo(() => userName.split(/\s+/).filter(Boolean), [userName])
  const firstName = nameParts[0] ?? userName
  const secondName = nameParts[1] ?? firstName
  const shortName = firstName === secondName ? firstName : `${firstName} ${secondName}`
  const initials = (
    firstName !== secondName
      ? `${firstName[0]}${secondName[0]}`
      : userName.slice(0, 2)
  ).toUpperCase()
  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? 'Usuário'

  useEffect(() => {
    if (!showUserMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowUserMenu(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [showUserMenu])

  const handleLogout = () => {
    setShowUserMenu(false)
    logout()
    navigate('/login')
  }

  const handleOpenPassword = () => {
    setShowUserMenu(false)
    setShowPwModal(true)
  }

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) {
      toast.error('As senhas não coincidem')
      return
    }
    setPwLoading(true)
    try {
      await changePassword(pwForm.current, pwForm.next)
      toast.success('Senha alterada com sucesso')
      setShowPwModal(false)
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Erro ao alterar senha')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <>
      <div ref={userMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setShowUserMenu((open) => !open)}
          className="flex h-9 items-center rounded-full border border-slate-200 bg-white pl-1 pr-3 cursor-pointer shadow-sm transition-colors hover:border-slate-300 dark:border-[#1d2748] dark:bg-[#0f1733] dark:hover:border-[#2b3a68]"
          aria-haspopup="menu"
          aria-expanded={showUserMenu}
          title={userName}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#7c3aed] text-[10px] font-bold text-white">
            {initials}
          </span>
          <span className="ml-2 hidden max-w-[160px] truncate text-xs font-semibold text-slate-700 md:inline dark:text-[#dfe6ff]">
            {shortName}
          </span>
          <ChevronDown
            size={14}
            className={`ml-1.5 text-slate-400 transition-transform dark:text-[#7a89ad] ${showUserMenu ? 'rotate-180' : ''}`}
          />
        </button>

        {showUserMenu && (
          <div
            className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[250px] rounded-[14px] border border-slate-200 bg-white p-[10px] shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:border-[#1d2748] dark:bg-[#0c1430] dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
            role="menu"
          >
            <div className="flex items-center gap-3 px-2 py-2">
              <span className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#7c3aed] text-sm font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="break-words text-sm font-semibold leading-snug text-slate-900 dark:text-white">{userName}</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-[#7a89ad]">{roleLabel} · SMD</div>
              </div>
            </div>

            <div className="my-2 h-px bg-slate-100 dark:bg-white/[0.05]" />

            <button
              type="button"
              onClick={handleOpenPassword}
              className="flex w-full items-center gap-[11px] rounded-lg px-3 py-[10px] text-left text-sm text-slate-700 transition-colors hover:bg-blue-500/10 hover:text-slate-950 dark:text-[#cdd6ee] dark:hover:text-[#eaf0ff]"
              role="menuitem"
            >
              <Key size={16} className="text-[#5b8df6]" />
              <span>Alterar senha</span>
            </button>

            <div className="my-2 h-px bg-slate-100 dark:bg-white/[0.05]" />

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-[11px] rounded-lg px-3 py-[10px] text-left text-sm text-red-600 transition-colors hover:bg-red-500/10 dark:text-[#f08a8a] dark:hover:bg-red-300/10"
              role="menuitem"
            >
              <LogOut size={16} className="text-red-600 dark:text-[#f08a8a]" />
              <span>Sair</span>
            </button>
          </div>
        )}
      </div>

      {showPwModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Key size={17} className="text-[#205DF5]" />
                </div>
                <h2 className="font-bold text-slate-900 dark:text-white">Alterar Senha</h2>
              </div>
              <button onClick={() => setShowPwModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangePw} className="p-6 space-y-4">
              <div>
                <label className="label">Senha atual</label>
                <input type={showPw ? 'text' : 'password'} className="input" value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} required autoFocus />
              </div>
              <div>
                <label className="label">Nova senha</label>
                <input type={showPw ? 'text' : 'password'} className="input" value={pwForm.next}
                  onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} required minLength={6} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="label">Confirmar nova senha</label>
                <input type={showPw ? 'text' : 'password'} className="input" value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required />
              </div>
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                {showPw ? 'Ocultar' : 'Mostrar'} senhas
              </button>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowPwModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" disabled={pwLoading} className="btn-primary flex-1 justify-center">
                  {pwLoading ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
