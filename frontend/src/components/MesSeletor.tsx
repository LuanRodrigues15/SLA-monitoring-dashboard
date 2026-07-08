import { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'
import { fetchCompetencias } from '../api/kpis'
import { useFilterStore } from '../store/filterStore'

function getPrevMonth() {
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

interface Props {
  onChange?: (v: string) => void
}

export function MesSeletor({ onChange }: Props) {
  const { competencia, setCompetencia } = useFilterStore()
  const [opcoes, setOpcoes] = useState<string[]>([])

  useEffect(() => {
    fetchCompetencias().then((meses) => {
      setOpcoes(meses)
      const prev = getPrevMonth()
      // Usa o mês anterior se disponível, senão o mais recente da lista
      const defaultMes = meses.includes(prev) ? prev : (meses[0] || prev)
      // Mantém seleção salva somente se ela ainda constar na lista
      const initial = competencia && meses.includes(competencia) ? competencia : defaultMes
      setCompetencia(initial)
      onChange?.(initial)
    })
  }, [])

  const handleChange = (mes: string) => {
    setCompetencia(mes)
    onChange?.(mes)
  }

  if (opcoes.length === 0) return null

  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
      <Calendar size={15} className="text-empresa-blue shrink-0" />
      <select
        value={competencia}
        onChange={(e) => handleChange(e.target.value)}
        className="text-sm font-semibold text-empresa-blue bg-transparent focus:outline-none cursor-pointer"
      >
        {opcoes.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  )
}
