import { isDemoMode } from '../api/client'

interface Props {
  children: React.ReactNode
}

export function Layout({ children }: Props) {
  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {isDemoMode && (
        <div className="flex-shrink-0 text-center text-xs font-semibold text-amber-900 bg-amber-300 py-1">
          Modo demonstração — dados fictícios, sem conexão com sistemas reais
        </div>
      )}
      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
      <footer className="flex-shrink-0 text-center text-xs text-gray-400 dark:text-slate-500 py-2 border-t border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        SMD v2.0
      </footer>
    </div>
  )
}
