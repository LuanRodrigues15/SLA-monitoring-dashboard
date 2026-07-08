import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="group relative inline-flex h-9 w-[72px] flex-shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 p-1 shadow-sm transition-all hover:border-empresa-blue/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-empresa-blue/40 dark:border-slate-700 dark:bg-slate-950"
      title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      aria-pressed={isDark}
    >
      <span className="absolute left-2 text-amber-500 transition-opacity dark:opacity-45">
        <Sun size={14} />
      </span>
      <span className="absolute right-2 text-slate-500 transition-opacity dark:text-blue-200">
        <Moon size={14} />
      </span>
      <span
        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-empresa-blue shadow-sm ring-1 ring-slate-200 transition-transform duration-200 dark:bg-empresa-blue dark:text-white dark:ring-empresa-blue/60 ${
          isDark ? 'translate-x-[35px]' : 'translate-x-0'
        }`}
      >
        {isDark ? <Moon size={15} /> : <Sun size={15} />}
      </span>
    </button>
  )
}
