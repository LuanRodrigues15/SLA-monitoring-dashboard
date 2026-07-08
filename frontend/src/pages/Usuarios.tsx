import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Edit2, UserX, UserCheck, X, Eye, EyeOff, Loader2, Search, Info, ShieldCheck, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { Layout } from '../components/Layout'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { HeaderActions } from '../components/HeaderActions'
import { TableSkeleton } from '../components/Skeleton'
import { listUsers, createUser, updateUser, deactivateUser } from '../api/users'
import { useAuthStore } from '../store/authStore'
import type { User, Role } from '../types'

type ModalMode = 'create' | 'edit'

interface FormState {
  name: string
  email: string
  password: string
  role: Role
  active: boolean
}

const EMPTY_FORM: FormState = { name: '', email: '', password: '', role: 'readonly', active: true }

const ROLE_OPTIONS: { value: Role; label: string; badge: string; desc: string }[] = [
  { value: 'readonly', label: 'ReadOnly', badge: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300', desc: 'Gestão e Histórico de KPIs' },
  { value: 'gestor',   label: 'Gestor',   badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300', desc: 'Gestão, Histórico de KPIs e Operação (Envio p/ Auditor)' },
  { value: 'auditor',       label: 'Auditor',       badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', desc: 'Perfil externo — somente consulta (Gestão e Histórico de KPIs)' },
  { value: 'admin',    label: 'Admin',    badge: 'bg-empresa-blue/10 text-empresa-blue', desc: 'Acesso Total e Configuração de Usuários' },
]

const roleBadge = (role: Role) => {
  if (role === 'admin') return <span className="badge bg-empresa-blue/10 text-empresa-blue">Admin</span>
  if (role === 'gestor') return <span className="badge-blue">Gestor</span>
  if (role === 'auditor') return <span className="badge bg-violet-100 text-violet-700">Auditor</span>
  return <span className="badge-gray">ReadOnly</span>
}

export function Usuarios() {
  const { user: me } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: ModalMode; target?: User } | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [showRolesInfo, setShowRolesInfo] = useState(false)
  const [roleDropdown, setRoleDropdown] = useState(false)
  const roleDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!roleDropdown) return
    const handler = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node))
        setRoleDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [roleDropdown])

  const filtered = useMemo(() => users.filter(u => {
    const matchName = u.name.toLowerCase().includes(search.toLowerCase()) ||
                      u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchName && matchRole
  }), [users, search, roleFilter])

  const reload = () => {
    setLoading(true)
    listUsers()
      .then(setUsers)
      .catch(() => toast.error('Erro ao carregar usuários'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setShowPw(false)
    setModal({ mode: 'create' })
  }

  const openEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, active: u.active })
    setShowPw(false)
    setModal({ mode: 'edit', target: u })
  }

  const closeModal = () => {
    setModal(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (modal?.mode === 'create') {
        if (!form.password) { toast.error('Senha obrigatória'); return }
        await createUser({ name: form.name, email: form.email, password: form.password, role: form.role })
        toast.success('Usuário criado')
      } else if (modal?.target) {
        const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role, active: form.active }
        if (form.password) body.password = form.password
        await updateUser(modal.target.id, body)
        toast.success('Usuário atualizado')
      }
      closeModal()
      reload()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (u: User) => {
    try {
      if (u.active) {
        await deactivateUser(u.id)
        toast.success(`${u.name} desativado`)
      } else {
        await updateUser(u.id, { active: true })
        toast.success(`${u.name} reativado`)
      }
      reload()
    } catch {
      toast.error('Erro ao alterar status')
    }
  }

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-2.5 flex items-center justify-between shadow-sm">
          <Breadcrumbs items={[{ label: 'Menu Principal', to: '/menu' }, { label: 'Gerenciar Usuários' }]} />
          <HeaderActions />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden px-5 py-6">
          <div className="max-w-4xl mx-auto h-full flex flex-col gap-4">

            {/* Barra de filtros */}
            <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou e-mail…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-empresa-blue/30"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(['all', 'admin', 'gestor', 'readonly', 'auditor'] as const).map((r) => {
                  const label = r === 'all' ? 'Todos' : r === 'readonly' ? 'ReadOnly' : r === 'auditor' ? 'Auditor' : r.charAt(0).toUpperCase() + r.slice(1)
                  const active = roleFilter === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleFilter(r)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-empresa-blue text-white border-empresa-blue'
                          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-empresa-blue/50 hover:text-empresa-blue dark:hover:text-blue-400'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto whitespace-nowrap">
                {filtered.length} de {users.length} usuário{users.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Card com scroll interno */}
            <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <TableSkeleton rows={6} cols={5} />
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs text-left border-b border-slate-200 dark:border-slate-700">
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider">Nome</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider">E-mail</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider">Role</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider w-24">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                            Nenhum usuário encontrado.
                          </td>
                        </tr>
                      ) : filtered.map((u) => (
                        <tr key={u.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${!u.active ? 'opacity-50' : ''}`}>
                          <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-empresa-blue/10 flex items-center justify-center text-xs font-bold text-empresa-blue flex-shrink-0">
                                {u.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                              </div>
                              {u.name}
                              {u.id === me?.id && (
                                <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-empresa-blue px-1.5 py-0.5 rounded-full font-medium">você</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{u.email}</td>
                          <td className="px-5 py-3.5">{roleBadge(u.role)}</td>
                          <td className="px-5 py-3.5">
                            {u.active
                              ? <span className="badge-green">Ativo</span>
                              : <span className="badge-red">Inativo</span>
                            }
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEdit(u)}
                                title="Editar"
                                className="text-slate-400 hover:text-empresa-blue transition-colors"
                              >
                                <Edit2 size={15} />
                              </button>
                              {u.id !== me?.id && (
                                <button
                                  onClick={() => handleToggleActive(u)}
                                  title={u.active ? 'Desativar' : 'Reativar'}
                                  className={`transition-colors ${u.active ? 'text-slate-400 hover:text-red-500' : 'text-slate-400 hover:text-green-600'}`}
                                >
                                  {u.active ? <UserX size={15} /> : <UserCheck size={15} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Ações — inferior direito */}
            <div className="flex justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowRolesInfo(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm hover:border-empresa-blue/50 hover:text-empresa-blue dark:hover:text-blue-400 transition-colors"
              >
                <Info size={15} /> Regras de acesso
              </button>
              <button onClick={openCreate} className="btn-primary">
                <Plus size={16} /> Novo Usuário
              </button>
            </div>

          </div>
        </div>
      </div>

      {showRolesInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-empresa-blue" />
                <h2 className="font-bold text-slate-900 dark:text-white">Regras de acesso por role</h2>
              </div>
              <button onClick={() => setShowRolesInfo(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {([
                {
                  role: 'Admin',
                  badge: 'bg-empresa-blue/10 text-empresa-blue',
                  border: 'border-blue-100 dark:border-blue-900',
                  desc: 'Acesso irrestrito ao sistema.',
                  pages: [
                    { label: 'Painel de Gestão', detail: 'visualização analítica de todos os KPIs' },
                    { label: 'Central de Operação', detail: 'geração de ZIP, envio SFTP ao Auditor e controle de meses' },
                    { label: 'Histórico de KPIs', detail: 'série histórica e comparativos' },
                    { label: 'Gerenciar Usuários', detail: 'criar, editar, ativar e desativar contas' },
                  ],
                },
                {
                  role: 'Gestor',
                  badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
                  border: 'border-violet-100 dark:border-violet-900',
                  desc: 'Operacional completo, sem gestão de usuários.',
                  pages: [
                    { label: 'Painel de Gestão', detail: 'visualização analítica de todos os KPIs' },
                    { label: 'Central de Operação', detail: 'geração de ZIP e envio SFTP ao Auditor' },
                    { label: 'Histórico de KPIs', detail: 'série histórica e comparativos' },
                  ],
                },
                {
                  role: 'ReadOnly',
                  badge: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                  border: 'border-slate-100 dark:border-slate-700',
                  desc: 'Somente consulta — nenhuma ação de escrita ou envio.',
                  pages: [
                    { label: 'Painel de Gestão', detail: 'visualização analítica de todos os KPIs' },
                    { label: 'Histórico de KPIs', detail: 'série histórica e comparativos' },
                  ],
                },
                {
                  role: 'Auditor',
                  badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                  border: 'border-amber-100 dark:border-amber-900',
                  desc: 'Perfil externo (auditoria) — somente consulta.',
                  pages: [
                    { label: 'Painel de Gestão', detail: 'visualização analítica de todos os KPIs' },
                    { label: 'Histórico de KPIs', detail: 'série histórica e comparativos' },
                  ],
                },
              ] as const).map(({ role, badge, border, desc, pages }) => (
                <div key={role} className={`rounded-lg border ${border} p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badge}`}>{role}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{desc}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {pages.map(({ label, detail }) => (
                      <div key={label} className="flex items-baseline gap-1.5 text-xs">
                        <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">›</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                        <span className="text-slate-400 dark:text-slate-500">— {detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">
                {modal.mode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nome completo</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                  placeholder="Ex: João Silva"
                />
              </div>

              <div>
                <label className="label">E-mail</label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="joao@empresa.com"
                />
              </div>

              <div>
                <label className="label">
                  {modal.mode === 'create' ? 'Senha' : 'Nova senha (deixe em branco para não alterar)'}
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input pr-10"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required={modal.mode === 'create'}
                    minLength={modal.mode === 'create' ? 6 : undefined}
                    placeholder={modal.mode === 'create' ? 'Mínimo 6 caracteres' : 'Deixe em branco para manter'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Role</label>
                <div ref={roleDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setRoleDropdown(v => !v)}
                    className="input w-full flex items-center justify-between gap-2 text-left"
                  >
                    {(() => {
                      const opt = ROLE_OPTIONS.find(o => o.value === form.role)
                      return opt ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`py-0.5 rounded-full text-[11px] font-bold flex-shrink-0 w-[68px] text-center ${opt.badge}`}>{opt.label}</span>
                          <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{opt.desc}</span>
                        </div>
                      ) : null
                    })()}
                    <ChevronDown size={14} className={`flex-shrink-0 text-slate-400 transition-transform ${roleDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {roleDropdown && (
                    <div className="absolute z-[200] mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700" style={{ maxHeight: '152px' }}>
                      {ROLE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setForm({ ...form, role: opt.value }); setRoleDropdown(false) }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${form.role === opt.value ? 'bg-slate-50 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                          <span className={`py-0.5 rounded-full text-[11px] font-bold flex-shrink-0 w-[68px] text-center ${opt.badge}`}>{opt.label}</span>
                          <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">{opt.desc}</span>
                          {form.role === opt.value && <span className="text-empresa-blue font-bold text-xs flex-shrink-0">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {modal.mode === 'edit' && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="active-toggle"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="w-4 h-4 accent-empresa-blue cursor-pointer"
                  />
                  <label htmlFor="active-toggle" className="text-sm text-gray-700 cursor-pointer">
                    Conta ativa
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1 justify-center">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
