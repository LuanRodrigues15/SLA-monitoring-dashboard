import { useNavigate } from 'react-router-dom'
import { BarChart2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { ThemeToggle } from './ThemeToggle'
import { UserMenuButton } from './UserMenuButton'

const PRIMARY_BLUE = '#205DF5'

export function AppHeader() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  if (!user) return null

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 py-3 px-6 shadow-sm flex items-center justify-between flex-shrink-0">
      <div
        className="flex items-center gap-3 cursor-pointer select-none"
        onClick={() => navigate('/menu')}
        title="Menu Principal"
      >
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: PRIMARY_BLUE }}
        >
          <BarChart2 size={20} />
        </span>
        <div className="flex gap-2">
          <span className="font-extrabold text-3xl leading-none" style={{ color: PRIMARY_BLUE }}>SMD</span>
          <span className="text-slate-400 dark:text-slate-500 font-normal text-sm mt-[10px]">Gestão e Monitoramento dos Indicadores</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <UserMenuButton />
      </div>
    </header>
  )
}
