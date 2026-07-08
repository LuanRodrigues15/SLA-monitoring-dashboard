import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle2, CircleAlert, CircleHelp, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { Layout } from '../components/Layout'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { HeaderActions } from '../components/HeaderActions'
import { KpiGridSkeleton } from '../components/Skeleton'
import { fetchKpis } from '../api/kpis'
import { useFilterStore } from '../store/filterStore'
import { IndicadorDetalheContent } from './IndicadorDetalhe'
import type { KpiSummary } from '../types'

// Cores de status
const STATUS_COLOR: Record<string, string> = {
  ok:       '#1E9640',
  alert:    '#F0A900',
  critical: '#E60975',
  pending:  '#94a3b8',
}

const PRIMARY_BLUE = '#205DF5'

// Agrupamento por Serviço (segmentos ilustrativos A-E)
const SERVICO: Record<string, string> = {
  '01': 'Enlace de Dados', '02': 'Enlace de Dados', '03': 'Enlace de Dados', '12': 'Enlace de Dados', '13': 'Enlace de Dados', '14': 'Enlace de Dados', '15': 'Enlace de Dados',
  '04': 'Telefonia IP', '11': 'Telefonia IP', '16': 'Telefonia IP', '17': 'Telefonia IP', '18': 'Telefonia IP', '19': 'Telefonia IP',
  '05': 'Conectividade Sem Fio', '06': 'Conectividade Sem Fio', '20': 'Conectividade Sem Fio', '21': 'Conectividade Sem Fio', '22': 'Conectividade Sem Fio', '23': 'Conectividade Sem Fio',
  '07': 'Monitoramento por Vídeo', '24': 'Monitoramento por Vídeo', '25': 'Monitoramento por Vídeo', '26': 'Monitoramento por Vídeo', '27': 'Monitoramento por Vídeo',
  '08': 'Serviço Complementar', '28': 'Serviço Complementar', '29': 'Serviço Complementar', '30': 'Serviço Complementar', '31': 'Serviço Complementar',
  '09': 'Satisfação', '10': 'Satisfação',
}

// Agrupamento por Tipo
const TIPO: Record<string, string> = {
  '01': 'Qualidade',
  '02': 'Disponibilidade', '04': 'Disponibilidade', '05': 'Disponibilidade',
  '07': 'Disponibilidade', '08': 'Disponibilidade',
  '03': 'Qualidade', '06': 'Qualidade', '09': 'Qualidade', '10': 'Qualidade', '11': 'Qualidade',
  '12': 'T. Resposta', '16': 'T. Resposta', '20': 'T. Resposta', '24': 'T. Resposta', '28': 'T. Resposta',
  '13': 'T. Solução', '17': 'T. Solução', '21': 'T. Solução', '25': 'T. Solução', '29': 'T. Solução',
  '14': 'Efetividade', '18': 'Efetividade', '22': 'Efetividade', '26': 'Efetividade', '30': 'Efetividade',
  '15': 'Reabertura', '19': 'Reabertura', '23': 'Reabertura', '27': 'Reabertura', '31': 'Reabertura',
}

// Fórmulas por KPI (resumo ilustrativo)
const FORMULA: Record<string, string> = {
  '01': 'Cálculo: não conformidades por medição',
  '02': 'Cálculo: Tempo UP / Total', '04': 'Cálculo: Tempo UP / Total',
  '05': 'Cálculo: Tempo UP / Total', '07': 'Cálculo: Tempo UP / Total', '08': 'Cálculo: Tempo UP / Total',
  '03': 'Cálculo: Testes OK / Total', '06': 'Cálculo: Testes OK / Total',
  '09': 'Cálculo: (Bom+Excelente)/Total', '10': 'Cálculo: (Bom+Excelente)/Total', '11': 'Cálculo: (Bom+Excelente)/Total',
  '12': 'Cálculo: Média Horas', '16': 'Cálculo: Média Horas', '20': 'Cálculo: Média Horas',
  '24': 'Cálculo: Média Horas', '28': 'Cálculo: Média Horas',
  '13': 'Cálculo: Média Horas', '17': 'Cálculo: Média Horas', '21': 'Cálculo: Média Horas',
  '25': 'Cálculo: Média Horas', '29': 'Cálculo: Média Horas',
  '14': 'Cálculo: Finalizados / Abertos', '18': 'Cálculo: Finalizados / Abertos',
  '22': 'Cálculo: Finalizados / Abertos', '26': 'Cálculo: Finalizados / Abertos', '30': 'Cálculo: Finalizados / Abertos',
  '15': 'Cálculo: Reabertos / Finalizados', '19': 'Cálculo: Reabertos / Finalizados',
  '23': 'Cálculo: Reabertos / Finalizados', '27': 'Cálculo: Reabertos / Finalizados', '31': 'Cálculo: Reabertos / Finalizados',
}

function yyyyMM(offsetMonths = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Agrupamento = 'ordem' | 'servico' | 'tipo'
type Periodo = 'anterior' | 'atual' | 'outro'

function getPeriodo(mes: string): Periodo {
  if (mes === yyyyMM(-1)) return 'anterior'
  if (mes === yyyyMM()) return 'atual'
  return 'outro'
}

function GestaoKpiCard({ kpi, onOpen }: { kpi: KpiSummary; onOpen: () => void }) {
  const [formulaOpen, setFormulaOpen] = useState(false)

  const color = STATUS_COLOR[kpi.status] ?? STATUS_COLOR.pending
  const unit = /\d+h/.test(kpi.meta) ? 'h' : kpi.meta.includes('%') ? '%' : ''
  const valor = kpi.valor_atual !== null ? kpi.valor_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + unit : null
  const formula = FORMULA[kpi.cod] ?? 'Fórmula não disponível'
  const titulo = `${parseInt(kpi.cod)}. ${kpi.nome} — ${kpi.sigla}`

  const StatusIcon = () => {
    if (kpi.status === 'ok')      return <CheckCircle2 size={28} color={color} />
    if (kpi.status === 'pending') return <CircleHelp   size={28} color={color} />
    return <CircleAlert size={28} color={color} />
  }

  return (
    <div className="flex h-full min-h-[132px] flex-col bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
      <div
        onClick={onOpen}
        className="cursor-pointer p-3 pb-1 flex-1"
      >
        <div className="flex items-center gap-3 h-full">
          <div className="flex-shrink-0 w-8 text-center">
            <StatusIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="min-h-[3.6em] text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight"
              title={titulo}
            >
              {titulo}
            </div>
            <div className="text-xl font-bold mt-1" style={{ color: valor !== null ? color : STATUS_COLOR.pending }}>
              {valor ?? (
                kpi.observacao
                  ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"><CircleAlert size={11} /> TF sem TA no período — incalculável</span>
                  : <span className="text-xs font-normal text-slate-400">Sem dados no período.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        onClick={() => setFormulaOpen((v) => !v)}
        className="h-7 flex-shrink-0 border-t border-slate-100 mt-2 flex justify-center items-center gap-1 cursor-pointer hover:bg-slate-50 rounded-b-xl"
      >
        <span className="text-xs text-slate-300">Fórmula</span>
        <ChevronDown
          size={12}
          className="text-slate-300 transition-transform"
          style={{ transform: formulaOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>

      {formulaOpen && (
        <div className="px-3 pb-2 bg-slate-50 text-[10px] text-slate-500 rounded-b-xl border-t border-slate-100">
          <span className="font-bold">Fórmula:</span> {formula}
        </div>
      )}
    </div>
  )
}

export function Gestao() {
  const { setCompetencia } = useFilterStore()
  const initialCompetencia = yyyyMM()
  const [kpis, setKpis] = useState<KpiSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('ordem')
  const [periodo, setPeriodo] = useState<Periodo>(() => getPeriodo(initialCompetencia))
  const [outroMes, setOutroMes] = useState(initialCompetencia)
  const [competenciaAtiva, setCompetenciaAtiva] = useState(initialCompetencia)
  const [selectedKpiIdx, setSelectedKpiIdx] = useState<number | null>(null)
  const dragOriginInsideRef = useRef(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'critical'>('all')

  useEffect(() => {
    if (selectedKpiIdx === null) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [selectedKpiIdx])

  const load = useCallback((mes: string) => {
    setLoading(true)
    fetchKpis(mes, 'kpi_agg_test')
      .then(setKpis)
      .catch(() => toast.error('Erro ao carregar indicadores'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setPeriodo(getPeriodo(competenciaAtiva))
    setOutroMes(competenciaAtiva)
    setCompetencia(competenciaAtiva)
    load(competenciaAtiva)
  }, [competenciaAtiva, load, setCompetencia])

  const handlePeriodo = (p: Periodo, event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.currentTarget.blur()
    setPeriodo(p)
    if (p === 'outro') return
    const mes = p === 'anterior' ? yyyyMM(-1) : yyyyMM()
    setCompetenciaAtiva(mes)
  }

  const handleOutroChange = (mes: string) => {
    setOutroMes(mes)
    setCompetenciaAtiva(mes)
  }

  // Grupos — ordenação alfabética
  type Group = { label: string; kpis: KpiSummary[] }
  let groups: Group[] = []

  const kpisFiltrados = statusFilter === 'all'
    ? kpis
    : kpis.filter(k => k.status === statusFilter)

  if (agrupamento === 'ordem') {
    groups = [{ label: '', kpis: [...kpisFiltrados].sort((a, b) => a.cod.localeCompare(b.cod)) }]
  } else if (agrupamento === 'servico') {
    const map = new Map<string, KpiSummary[]>()
    for (const k of kpisFiltrados) {
      const s = SERVICO[k.cod] ?? 'Outros'
      if (!map.has(s)) map.set(s, [])
      map.get(s)!.push(k)
    }
    for (const s of [...map.keys()].sort()) groups.push({ label: s, kpis: map.get(s)! })
  } else {
    const map = new Map<string, KpiSummary[]>()
    for (const k of kpisFiltrados) {
      const t = TIPO[k.cod] ?? 'Outros'
      if (!map.has(t)) map.set(t, [])
      map.get(t)!.push(k)
    }
    for (const t of [...map.keys()].sort()) groups.push({ label: t, kpis: map.get(t)! })
  }

  const kpisOrdenados = groups.flatMap(g => g.kpis)

  const btnGroupStyle = (active: boolean, radius?: string, overlap = false): React.CSSProperties => ({
    appearance: 'none',
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: `1px solid ${PRIMARY_BLUE}`,
    borderColor: active ? PRIMARY_BLUE : 'var(--segmented-inactive-border)',
    backgroundColor: active ? PRIMARY_BLUE : 'var(--segmented-inactive-bg)',
    color: active ? 'white' : 'var(--segmented-group-text)',
    outline: 'none',
    boxShadow: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ...(radius ? { borderRadius: radius } : {}),
    ...(overlap ? { marginLeft: '-1px' } : {}),
  })

  const btnFilterStyle = (active: boolean, radius?: string, overlap = false): React.CSSProperties => ({
    appearance: 'none',
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    border: `1px solid ${active ? PRIMARY_BLUE : 'var(--segmented-inactive-border)'}`,
    backgroundColor: active ? PRIMARY_BLUE : 'var(--segmented-inactive-bg)',
    color: active ? 'white' : 'var(--segmented-inactive-text)',
    outline: 'none',
    boxShadow: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ...(radius ? { borderRadius: radius } : {}),
    ...(overlap ? { marginLeft: '-1px' } : {}),
  })

  const segmentedButtonClass = 'focus:outline-none focus-visible:outline-none'

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-2.5 flex items-center justify-between shadow-sm">
          <Breadcrumbs items={[{ label: 'Menu Principal', to: '/menu' }, { label: 'Painel de Gestão' }]} />
          <HeaderActions />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
        {/* Filtros */}
        <div className="sticky top-0 z-10 pt-3 pb-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-[0_8px_18px_rgba(15,23,42,0.08)] dark:shadow-none px-3 py-2.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">

                {/* Agrupar por */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">Agrupar</span>
                  <div className="inline-flex shadow-sm">
                    <button className={segmentedButtonClass} onClick={() => setAgrupamento('ordem')}  style={btnGroupStyle(agrupamento === 'ordem',  '0.5rem 0 0 0.5rem')}>Ordem</button>
                    <button className={segmentedButtonClass} onClick={() => setAgrupamento('servico')} style={btnGroupStyle(agrupamento === 'servico', undefined, true)}>Serviço</button>
                    <button className={segmentedButtonClass} onClick={() => setAgrupamento('tipo')}   style={btnGroupStyle(agrupamento === 'tipo',   '0 0.5rem 0.5rem 0', true)}>Tipo</button>
                  </div>
                </div>

                <div className="hidden lg:block h-7 w-px bg-slate-200" />

                {/* Período */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">Período</span>
                  <div className="flex shadow-sm">
                    <button type="button" className={segmentedButtonClass} onMouseDown={(e) => e.preventDefault()} onClick={(e) => handlePeriodo('anterior', e)} style={btnFilterStyle(periodo === 'anterior', '0.5rem 0 0 0.5rem')}>Mês Anterior</button>
                    <button type="button" className={segmentedButtonClass} onMouseDown={(e) => e.preventDefault()} onClick={(e) => handlePeriodo('atual', e)}    style={btnFilterStyle(periodo === 'atual', undefined, true)}>Mês Atual</button>
                    <button type="button" className={segmentedButtonClass} onMouseDown={(e) => e.preventDefault()} onClick={(e) => handlePeriodo('outro', e)}    style={btnFilterStyle(periodo === 'outro',    '0 0.5rem 0.5rem 0', true)}>Outro</button>
                  </div>
                  {periodo === 'outro' && (
                    <input
                      type="month"
                      value={outroMes}
                      onChange={(e) => handleOutroChange(e.target.value)}
                      className="border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:outline-none"
                    />
                  )}
                </div>

                <div className="hidden lg:block h-7 w-px bg-slate-200" />

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">Status</span>
                  <div className="inline-flex shadow-sm">
                    <button className={segmentedButtonClass} onClick={() => setStatusFilter('all')}      style={btnFilterStyle(statusFilter === 'all',      '0.5rem 0 0 0.5rem')}>Todos</button>
                    <button className={segmentedButtonClass} onClick={() => setStatusFilter('ok')}       style={btnFilterStyle(statusFilter === 'ok',       undefined, true)}>Dentro da meta</button>
                    <button className={segmentedButtonClass} onClick={() => setStatusFilter('critical')} style={btnFilterStyle(statusFilter === 'critical', '0 0.5rem 0.5rem 0', true)}>Fora da meta</button>
                  </div>
                </div>

              </div>

              {competenciaAtiva && (
                <div className="flex items-center gap-2 border-t border-slate-100 pt-2 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Competência</span>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">{competenciaAtiva}</span>
                </div>
              )}
          </div>
        </div>

          {loading ? (
            <KpiGridSkeleton />
          ) : kpis.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-sm">
              Nenhum dado disponível para o período selecionado.
            </div>
          ) : (
            <div>
              {groups.map((g, gi) => (
                <div key={g.label || '__all__'} className={gi > 0 ? 'mt-5' : ''}>
                  {g.label && (
                    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-200">
                      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{g.label}</h2>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {g.kpis.map((k) => (
                      <GestaoKpiCard
                        key={k.cod}
                        kpi={k}
                        onOpen={() => setSelectedKpiIdx(kpisOrdenados.findIndex(x => x.cod === k.cod))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedKpiIdx !== null && kpisOrdenados[selectedKpiIdx] && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm p-4 sm:p-6"
            onMouseDown={e => { dragOriginInsideRef.current = e.target !== e.currentTarget }}
            onClick={() => { if (!dragOriginInsideRef.current) setSelectedKpiIdx(null) }}
          >
            <div
              className="relative bg-slate-100 rounded-xl border border-white/80 ring-1 ring-slate-900/10 shadow-2xl w-full max-w-7xl mx-auto h-[calc(100vh-2rem)] sm:h-[calc(100vh-3rem)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-full px-3 pb-3 pt-0 sm:px-5 sm:pb-5 sm:pt-0">
                <IndicadorDetalheContent
                  cod={kpisOrdenados[selectedKpiIdx].cod}
                  modal
                  onClose={() => setSelectedKpiIdx(null)}
                  hasPrev={selectedKpiIdx > 0}
                  hasNext={selectedKpiIdx < kpisOrdenados.length - 1}
                  position={`${selectedKpiIdx + 1} / ${kpisOrdenados.length}`}
                  onPrev={() => setSelectedKpiIdx(i => Math.max(0, (i ?? 0) - 1))}
                  onNext={() => setSelectedKpiIdx(i => Math.min(kpisOrdenados.length - 1, (i ?? 0) + 1))}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
