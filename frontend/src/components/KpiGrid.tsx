import { useNavigate } from 'react-router-dom'
import { KpiCard } from './KpiCard'
import type { KpiSummary } from '../types'

interface Props {
  kpis: KpiSummary[]
  selected: Set<string>
  onToggle: (cod: string) => void
}

export function KpiGrid({ kpis, selected, onToggle }: Props) {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.cod}
          kpi={kpi}
          selected={selected.has(kpi.cod)}
          onToggle={() => onToggle(kpi.cod)}
          onClick={() => navigate(`/indicador/${kpi.cod}${kpi.competencia ? `?competencia=${kpi.competencia}` : ''}`)}
        />
      ))}
    </div>
  )
}
