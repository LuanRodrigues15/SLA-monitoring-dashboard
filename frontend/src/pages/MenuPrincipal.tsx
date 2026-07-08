import { useNavigate } from 'react-router-dom'
import { Send, Users, BarChart2, History, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { AppHeader } from '../components/AppHeader'

const PRIMARY_BLUE = '#205DF5'

interface CardDef {
  title: string
  description: string
  cta: string
  icon: LucideIcon
  href: string
  roles: string[] | null
}

const CARDS: CardDef[] = [
  {
    title: 'Visualizar Indicadores',
    description: 'Acompanhe o desempenho mensal, visualize tendências e consulte detalhes de auditoria.',
    cta: 'Acessar Painel →',
    icon: BarChart2,
    href: '/gestao',
    roles: ['admin', 'gestor', 'readonly', 'auditor'],
  },
  {
    title: 'Central de Envio',
    description: 'Área restrita para geração de arquivos oficiais e envio via SFTP para o auditor externo.',
    cta: 'Acessar Central →',
    icon: Send,
    href: '/operacao',
    roles: ['admin', 'gestor'],
  },
  {
    title: 'Histórico de KPIs',
    description: 'Consulte a evolução histórica dos indicadores, baixe pacotes de qualquer mês em Excel, TXTs ou ZIP completo.',
    cta: 'Ver Histórico →',
    icon: History,
    href: '/historico-kpi',
    roles: ['admin', 'gestor', 'readonly', 'auditor'],
  },
  {
    title: 'Gerenciar Usuários',
    description: 'Crie, edite e gerencie as contas e permissões de acesso ao sistema.',
    cta: 'Gerenciar →',
    icon: Users,
    href: '/usuarios',
    roles: ['admin'],
  },
]

const GRID_CLASS: Record<number, string> = {
  1: 'max-w-[250px] w-full grid grid-cols-1 gap-4',
  2: 'max-w-[520px] w-full grid grid-cols-1 sm:grid-cols-2 gap-4',
  3: 'max-w-[790px] w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
  4: 'max-w-[1060px] w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
  5: 'max-w-[1280px] w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4',
}

export function MenuPrincipal() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const visible = CARDS.filter((c) => !c.roles || (!!user && c.roles.includes(user.role)))
  const gridClass = GRID_CLASS[Math.min(visible.length, 5)] ?? GRID_CLASS[5]

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <AppHeader />
      <main className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-3 sm:p-4">
        <div className={gridClass}>
          {visible.map((card) => (
            <div
              key={card.href}
              onClick={() => navigate(card.href)}
              className="relative min-h-[175px] bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center justify-between group cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#205DF5]"
            >
              {card.roles?.length === 1 && card.roles[0] === 'admin' && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-[#205DF5] dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                  <ShieldCheck size={11} />
                  Admin
                </span>
              )}
<div className="flex flex-col items-center flex-1">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors flex-shrink-0">
                  <card.icon className="h-5 w-5" style={{ color: PRIMARY_BLUE }} />
                </div>
                <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-100 mb-2 leading-tight">{card.title}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-snug">{card.description}</p>
              </div>
              <span className="mt-3 text-xs font-semibold group-hover:underline flex-shrink-0" style={{ color: PRIMARY_BLUE }}>
                {card.cta}
              </span>
            </div>
          ))}
        </div>
      </main>
      <footer className="flex-shrink-0 text-center text-xs text-gray-400 dark:text-slate-500 py-2 border-t border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        SMD v2.0
      </footer>
    </div>
  )
}
