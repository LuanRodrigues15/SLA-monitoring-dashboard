import type { KpiSummary } from '../types'

interface Props {
  kpi: KpiSummary
  selected: boolean
  onToggle: () => void
  onClick?: () => void
}

const statusConfig: Record<string, { accent: string; ring: string; badge: string; label: string }> = {
  ok: {
    accent: 'bg-green-600',
    ring: 'ring-green-200',
    badge: 'bg-green-50 text-green-700',
    label: 'OK',
  },
  alert: {
    accent: 'bg-amber-500',
    ring: 'ring-amber-200',
    badge: 'bg-amber-50 text-amber-700',
    label: 'Alerta',
  },
  critical: {
    accent: 'bg-red-600',
    ring: 'ring-red-200',
    badge: 'bg-red-50 text-red-700',
    label: 'Crítico',
  },
  pending: {
    accent: 'bg-gray-300',
    ring: 'ring-gray-200',
    badge: 'bg-gray-100 text-gray-500',
    label: 'Pendente',
  },
}

export function KpiCard({ kpi, selected, onToggle, onClick }: Props) {
  const sc = statusConfig[kpi.status] ?? statusConfig.pending
  const valor = kpi.valor_atual !== null
    ? kpi.valor_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'

  return (
    <div
      className={`relative bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-all cursor-pointer overflow-hidden border ${selected ? 'border-empresa-blue ring-2 ring-empresa-blue/30' : 'border-gray-100'}`}
      onClick={onClick}
    >
      {/* colored top accent bar */}
      <div className={`h-1 w-full ${sc.accent}`} />

      <div className="p-3.5 pb-4">
        {/* header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-mono">#{kpi.cod}</span>
            <span className="text-xs font-bold text-empresa-blue">{kpi.sigla}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sc.badge}`}>
              {sc.label}
            </span>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              onClick={(e) => e.stopPropagation()}
              className="cursor-pointer accent-empresa-blue w-3.5 h-3.5"
            />
          </div>
        </div>

        {/* name */}
        <p className="text-xs text-gray-600 leading-snug mb-3 line-clamp-2 min-h-[2.5em]">{kpi.nome}</p>

        {/* value row */}
        <div className="flex items-end justify-between">
          <span className={`text-xl font-bold ${kpi.valor_atual === null ? 'text-gray-300' : 'text-gray-900'}`}>
            {valor}
          </span>
          <span className="text-[11px] text-gray-400 font-medium">meta {kpi.meta}</span>
        </div>

        {kpi.competencia && (
          <p className="text-[10px] text-gray-300 mt-1.5">{kpi.competencia}</p>
        )}
      </div>
    </div>
  )
}
