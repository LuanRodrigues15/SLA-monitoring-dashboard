import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Download, FileSpreadsheet, Archive, Package, CheckCircle2, Clock,
  Loader2, TrendingUp, TrendingDown, Search, X, ExternalLink,
  Eye, EyeOff, ChevronLeft, ChevronRight, ChevronDown,
  ArrowUpDown, ArrowUp, ArrowDown, Filter,
  Pin, PinOff,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Brush,
} from 'recharts'
import toast from 'react-hot-toast'
import { Layout } from '../components/Layout'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { HeaderActions } from '../components/HeaderActions'
import { fetchMeses, fetchSeries, downloadPacote } from '../api/historico'
import { isDemoMode } from '../api/client'
import { IndicadorDetalheContent } from './IndicadorDetalhe'
import { useThemeStore } from '../store/themeStore'
import type { MesStatus, KpiSerie } from '../api/historico'

const PRIMARY_BLUE = '#205DF5'

// ── Metadata estática (espelha KPI_CATALOG do backend) ───────────────────────

interface KpiMeta {
  categoria: string
  meta: string
  meta_val: number
  meta_op: 'gte' | 'lte'
  unit: string
}

const KPI_META: Record<string, KpiMeta> = {
  '01': { categoria: 'Disponibilidade Enlace', meta: '≤5 NC/M',   meta_val: 5,   meta_op: 'lte', unit: 'NC' },
  '02': { categoria: 'Disponibilidade Enlace', meta: '≥98%',      meta_val: 98,  meta_op: 'gte', unit: '%' },
  '03': { categoria: 'Disponibilidade Enlace', meta: '',          meta_val: 0,   meta_op: 'gte', unit: 'equip.' },
  '04': { categoria: 'Disponibilidade',        meta: '≥98%',      meta_val: 98,  meta_op: 'gte', unit: '%' },
  '05': { categoria: 'Disponibilidade',        meta: '≥98%',      meta_val: 98,  meta_op: 'gte', unit: '%' },
  '06': { categoria: 'Disponibilidade',        meta: '',          meta_val: 0,   meta_op: 'gte', unit: 'equip.' },
  '07': { categoria: 'Disponibilidade',        meta: '≥98%',      meta_val: 98,  meta_op: 'gte', unit: '%' },
  '08': { categoria: 'Disponibilidade',        meta: '≥98%',      meta_val: 98,  meta_op: 'gte', unit: '%' },
  '09': { categoria: 'Satisfação',             meta: '≥85%',      meta_val: 85,  meta_op: 'gte', unit: '%' },
  '10': { categoria: 'Satisfação',             meta: '≥85%',      meta_val: 85,  meta_op: 'gte', unit: '%' },
  '11': { categoria: 'Satisfação',             meta: '≥85%',      meta_val: 85,  meta_op: 'gte', unit: '%' },
  '12': { categoria: 'Tempo Resposta',         meta: '≤3h',       meta_val: 3,   meta_op: 'lte', unit: 'h' },
  '13': { categoria: 'Tempo Solução',          meta: '≤48h',      meta_val: 48,  meta_op: 'lte', unit: 'h' },
  '14': { categoria: 'Efetividade',            meta: '≥85%',      meta_val: 85,  meta_op: 'gte', unit: '%' },
  '15': { categoria: 'Reabertura',             meta: '≤15%',      meta_val: 15,  meta_op: 'lte', unit: '%' },
  '16': { categoria: 'Tempo Resposta',         meta: '≤3h',       meta_val: 3,   meta_op: 'lte', unit: 'h' },
  '17': { categoria: 'Tempo Solução',          meta: '≤48h',      meta_val: 48,  meta_op: 'lte', unit: 'h' },
  '18': { categoria: 'Efetividade',            meta: '≥85%',      meta_val: 85,  meta_op: 'gte', unit: '%' },
  '19': { categoria: 'Reabertura',             meta: '≤15%',      meta_val: 15,  meta_op: 'lte', unit: '%' },
  '20': { categoria: 'Tempo Resposta',         meta: '≤3h',       meta_val: 3,   meta_op: 'lte', unit: 'h' },
  '21': { categoria: 'Tempo Solução',          meta: '≤48h',      meta_val: 48,  meta_op: 'lte', unit: 'h' },
  '22': { categoria: 'Efetividade',            meta: '≥85%',      meta_val: 85,  meta_op: 'gte', unit: '%' },
  '23': { categoria: 'Reabertura',             meta: '≤15%',      meta_val: 15,  meta_op: 'lte', unit: '%' },
  '24': { categoria: 'Tempo Resposta',         meta: '≤3h',       meta_val: 3,   meta_op: 'lte', unit: 'h' },
  '25': { categoria: 'Tempo Solução',          meta: '≤48h',      meta_val: 48,  meta_op: 'lte', unit: 'h' },
  '26': { categoria: 'Efetividade',            meta: '≥85%',      meta_val: 85,  meta_op: 'gte', unit: '%' },
  '27': { categoria: 'Reabertura',             meta: '≤15%',      meta_val: 15,  meta_op: 'lte', unit: '%' },
  '28': { categoria: 'Tempo Resposta',         meta: '≤3h',       meta_val: 3,   meta_op: 'lte', unit: 'h' },
  '29': { categoria: 'Tempo Solução',          meta: '≤48h',      meta_val: 48,  meta_op: 'lte', unit: 'h' },
  '30': { categoria: 'Efetividade',            meta: '≥85%',      meta_val: 85,  meta_op: 'gte', unit: '%' },
  '31': { categoria: 'Reabertura',             meta: '≤15%',      meta_val: 15,  meta_op: 'lte', unit: '%' },
}

const CATEGORIAS = ['Todas', 'Disponibilidade Enlace', 'Disponibilidade', 'Satisfação', 'Tempo Resposta', 'Tempo Solução', 'Efetividade', 'Reabertura']

// Segmentos ilustrativos: A=Enlace de Dados, B=Telefonia IP, C=Conectividade Sem Fio,
// D=Monitoramento por Vídeo, E=Serviço Complementar
const SERVICO: Record<string, string> = {
  '01': 'Enlace de Dados', '02': 'Enlace de Dados', '03': 'Enlace de Dados', '12': 'Enlace de Dados', '13': 'Enlace de Dados', '14': 'Enlace de Dados', '15': 'Enlace de Dados',
  '04': 'Telefonia IP',    '11': 'Telefonia IP',    '16': 'Telefonia IP',    '17': 'Telefonia IP',    '18': 'Telefonia IP',    '19': 'Telefonia IP',
  '05': 'Conectividade Sem Fio', '06': 'Conectividade Sem Fio', '20': 'Conectividade Sem Fio', '21': 'Conectividade Sem Fio', '22': 'Conectividade Sem Fio', '23': 'Conectividade Sem Fio',
  '07': 'Monitoramento por Vídeo', '24': 'Monitoramento por Vídeo', '25': 'Monitoramento por Vídeo', '26': 'Monitoramento por Vídeo', '27': 'Monitoramento por Vídeo',
  '08': 'Serviço Complementar', '28': 'Serviço Complementar', '29': 'Serviço Complementar', '30': 'Serviço Complementar', '31': 'Serviço Complementar',
  '09': 'Satisfação',  '10': 'Satisfação',
}
const SERVICOS = ['Todos', 'Enlace de Dados', 'Telefonia IP', 'Conectividade Sem Fio', 'Monitoramento por Vídeo', 'Serviço Complementar', 'Satisfação']

// ── Status ────────────────────────────────────────────────────────────────────

type Status = 'ok' | 'critical' | 'none'

const STATUS_STYLE: Record<Status, { border: string; badge: string }> = {
  ok:       { border: '#22c55e', badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400' },
  critical: { border: '#ef4444', badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400' },
  none:     { border: '#cbd5e1', badge: 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-500' },
}

function getStatus(valor: number | null, meta_val: number, meta_op: 'gte' | 'lte'): Status {
  if (valor === null) return 'none'
  return meta_op === 'gte' ? (valor >= meta_val ? 'ok' : 'critical') : (valor <= meta_val ? 'ok' : 'critical')
}

// ── Formatação ────────────────────────────────────────────────────────────────

function fmtComp(comp: string): string {
  const [y, m] = comp.split('-')
  return `${m}/${y}`
}

function fmtDt(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtVal(val: number | null, unit: string): string {
  if (val === null) return '—'
  const minDec = (unit === '%' || unit === 'h') ? 2 : 0
  const n = val.toLocaleString('pt-BR', { minimumFractionDigits: minDec, maximumFractionDigits: 2 })
  if (unit === '%') return `${n}%`
  if (unit === 'h') return `${n}h`
  if (unit === 'NC') return `${n} NC`
  return `${n} ${unit}`
}

// ── Regressão linear ─────────────────────────────────────────────────────────

interface ChartPoint {
  comp: string
  valor: number | null
  trend: number | null
}

interface ChartData {
  points: ChartPoint[]
  slope: number
}

function buildChartData(serie: { competencia: string; valor: number | null }[]): ChartData {
  const validPts = serie
    .map((s, i) => s.valor !== null ? { x: i, y: s.valor } : null)
    .filter(Boolean) as { x: number; y: number }[]

  let slope = 0
  let intercept = 0
  let hasReg = false

  if (validPts.length >= 2) {
    const n    = validPts.length
    const sumX  = validPts.reduce((a, p) => a + p.x, 0)
    const sumY  = validPts.reduce((a, p) => a + p.y, 0)
    const sumXY = validPts.reduce((a, p) => a + p.x * p.y, 0)
    const sumX2 = validPts.reduce((a, p) => a + p.x * p.x, 0)
    const denom = n * sumX2 - sumX * sumX
    if (denom !== 0) {
      slope     = (n * sumXY - sumX * sumY) / denom
      intercept = (sumY - slope * sumX) / n
      hasReg    = true
    }
  }

  const points: ChartPoint[] = serie.map((s, i) => ({
    comp:  fmtComp(s.competencia),
    valor: s.valor !== null ? Math.round(s.valor * 1000) / 1000 : null,
    trend: hasReg ? Math.round((slope * i + intercept) * 1000) / 1000 : null,
  }))

  return { points, slope }
}

function computeAvg(serie: { valor: number | null }[]): number | null {
  const vals = serie.filter(s => s.valor !== null).map(s => s.valor as number)
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Modal expandido ───────────────────────────────────────────────────────────

interface KpiModalProps {
  kpi: KpiSerie
  isDark: boolean
  showTrend: boolean
  onClose: () => void
  hasPrev: boolean
  hasNext: boolean
  position: string
  onPrev: () => void
  onNext: () => void
}

function KpiModal({ kpi, isDark, showTrend, onClose, hasPrev, hasNext, position, onPrev, onNext }: KpiModalProps) {
  const meta              = KPI_META[kpi.cod]
  const { points } = useMemo(() => buildChartData(kpi.serie), [kpi.cod])
  const lastValid   = [...kpi.serie].reverse().find(s => s.valor !== null)
  const avg         = computeAvg(kpi.serie)
  const status      = meta?.meta_val ? getStatus(lastValid?.valor ?? null, meta.meta_val, meta.meta_op) : 'none'
  const style       = STATUS_STYLE[status]

  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'critical'>('all')
  const [deltaFilter,  setDeltaFilter]  = useState<'all' | 'up' | 'down'>('all')
  const [sortCol,      setSortCol]      = useState<'comp' | 'valor' | 'delta'>('comp')
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc')
  const [openFilter,     setOpenFilter]     = useState<'status' | 'delta' | null>(null)
  const statusFilterBtnRef = useRef<HTMLButtonElement>(null)
  const [statusFilterPos, setStatusFilterPos] = useState<{ top: number; right: number } | null>(null)
  const deltaFilterBtnRef = useRef<HTMLButtonElement>(null)
  const [deltaFilterPos, setDeltaFilterPos] = useState<{ top: number; right: number } | null>(null)
  const [localShowTrend, setLocalShowTrend] = useState(showTrend)
  const [detalheComp,    setDetalheComp]    = useState<string | null>(null)
  const defaultStart  = Math.max(0, points.length - 12)
  const defaultEnd    = Math.max(0, points.length - 1)
  const brushPosRef   = useRef({ start: defaultStart, end: defaultEnd })
  const prevCodRef    = useRef(kpi.cod)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [brushRange,  setBrushRange] = useState({ start: defaultStart, end: defaultEnd })
  const [liveRange,   setLiveRange]  = useState({ start: defaultStart, end: defaultEnd })

  // Resetar refs sincronamente (antes do render do Brush) ao trocar de KPI
  if (prevCodRef.current !== kpi.cod) {
    prevCodRef.current = kpi.cod
    brushPosRef.current = { start: defaultStart, end: defaultEnd }
  }

  useEffect(() => {
    const s = Math.max(0, points.length - 12)
    const e = Math.max(0, points.length - 1)
    brushPosRef.current = { start: s, end: e }
    setBrushRange({ start: s, end: e })
    setLiveRange({ start: s, end: e })
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [kpi.cod])

  const liveMonths = kpi.serie.slice(liveRange.start, liveRange.end + 1).filter(s => s.valor !== null).length

  const selectedSerie = useMemo(
    () => kpi.serie.slice(brushRange.start, brushRange.end + 1),
    [kpi.serie, brushRange.start, brushRange.end],
  )
  const { slope } = useMemo(() => buildChartData(selectedSerie), [selectedSerie])
  const trendGood = meta?.meta_val ? (meta.meta_op === 'gte' ? slope >= 0 : slope <= 0) : null

  const toggleSort = (col: 'comp' | 'valor' | 'delta') => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }: { col: 'comp' | 'valor' | 'delta' }) => {
    if (sortCol !== col) return <ArrowUpDown size={11} className="opacity-40" />
    return sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
  }

  const textColor     = isDark ? '#94a3b8' : '#64748b'
  const gridColor     = isDark ? '#334155' : '#f1f5f9'
  const tooltipBg     = isDark ? '#1e293b' : '#ffffff'
  const tooltipBorder = isDark ? '#475569' : '#e2e8f0'

  const tableRows = kpi.serie.map((s, i) => ({
    ...s,
    delta: s.valor !== null && kpi.serie[i - 1]?.valor != null
      ? s.valor - (kpi.serie[i - 1].valor as number)
      : null,
  }))

  const filteredRows = [...tableRows].reverse().filter(row => {
    if (statusFilter !== 'all') {
      const rs = meta?.meta_val ? getStatus(row.valor, meta.meta_val, meta.meta_op) : 'none'
      if (rs !== statusFilter) return false
    }
    if (deltaFilter !== 'all') {
      if (row.delta === null) return false
      if (deltaFilter === 'up'   && row.delta <= 0) return false
      if (deltaFilter === 'down' && row.delta >= 0) return false
    }
    return true
  })

  const sortedRows = [...filteredRows].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortCol === 'comp')  return a.competencia.localeCompare(b.competencia) * dir
    if (sortCol === 'valor') {
      if (a.valor === null) return 1
      if (b.valor === null) return -1
      return (a.valor - b.valor) * dir
    }
    if (sortCol === 'delta') {
      if (a.delta === null) return 1
      if (b.delta === null) return -1
      return (a.delta - b.delta) * dir
    }
    return 0
  })

  const handleVerDetalhe = (competencia: string) => {
    setDetalheComp(competencia)
  }

  const dragOriginInsideRef = useRef(false)

  if (detalheComp !== null) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
        <div className="relative bg-slate-100 dark:bg-slate-900 rounded-xl border border-white/80 ring-1 ring-slate-900/10 shadow-2xl w-full max-w-7xl mx-auto h-[calc(100vh-2rem)] sm:h-[calc(100vh-3rem)] overflow-hidden">
          <div className="h-full px-3 pb-3 pt-0 sm:px-5 sm:pb-5 sm:pt-0">
            <IndicadorDetalheContent
              cod={kpi.cod}
              modal={true}
              competenciaProp={detalheComp}
              onClose={() => setDetalheComp(null)}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onMouseDown={e => { dragOriginInsideRef.current = e.target !== e.currentTarget }}
      onClick={() => { if (!dragOriginInsideRef.current) onClose() }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                style={{ backgroundColor: `${style.border}20`, color: style.border }}
              >
                KPI {kpi.cod}
              </span>
              <span className="text-base font-bold text-slate-800 dark:text-slate-100">{kpi.sigla}</span>
              {meta?.meta_val ? (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${style.badge}`}>
                  Meta: {meta.meta}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-4 mt-0.5 flex-wrap">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{kpi.nome}</p>
              {avg !== null && (
                <p className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                  Média histórica: <span className="font-semibold text-slate-600 dark:text-slate-300">{fmtVal(avg, meta?.unit ?? '')}</span>
                </p>
              )}
              {trendGood !== null && Math.abs(slope) >= 0.001 && (
                <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${trendGood ? 'text-green-500' : 'text-red-400'}`}>
                  {trendGood ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  {trendGood ? 'Positiva' : 'Negativa'}
                  <span className="font-normal text-slate-400 dark:text-slate-500 text-xs">
                    ({liveMonths} {liveMonths === 1 ? 'mês' : 'meses'})
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Navegação + fechar */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setLocalShowTrend(v => !v)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors border ${
                localShowTrend
                  ? 'border-orange-300 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950'
                  : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={localShowTrend ? 'Ocultar linha de tendência' : 'Mostrar linha de tendência'}
            >
              <span>Tendência</span>
              <span className="opacity-40">|</span>
              <span>{localShowTrend ? 'Ocultar linha' : 'Mostrar linha'}</span>
              {localShowTrend ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500"
              title="Indicador anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono w-12 text-center">{position}</span>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500"
              title="Próximo indicador"
            >
              <ChevronRight size={18} />
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-700"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Gráfico */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0">
          {kpi.serie.every(s => s.valor === null) ? (
            <div className="h-44 flex items-center justify-center text-slate-400 text-sm">
              Sem dados históricos disponíveis para este indicador.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-5 mb-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: PRIMARY_BLUE }} />
                  Valor mensal
                </span>
                {localShowTrend && (
                  <span className="flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
                    <span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: '#f59e0b' }} />
                    Tendência (regressão linear)
                  </span>
                )}
                {meta?.meta_val ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-6 border-t border-dashed" style={{ borderColor: '#22c55e' }} />
                    Meta ({meta.meta})
                  </span>
                ) : null}
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={points} margin={{ top: 8, right: points.length > 12 ? 55 : 20, left: -5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="comp" tick={{ fontSize: 11, fill: textColor }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: textColor }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={v => meta ? fmtVal(v, meta.unit) : String(v)}
                  />
                  <Tooltip
                    content={(props: any) => {
                      if (!props.active || !props.payload?.length) return null
                      return (
                        <div style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, padding: '6px 10px' }}>
                          <p style={{ color: textColor, marginBottom: 4, fontWeight: 600 }}>{props.label}</p>
                          {props.payload.map((entry: any) => (
                            <p key={entry.dataKey} style={{ color: entry.dataKey === 'trend' ? '#f59e0b' : PRIMARY_BLUE, marginBottom: 2 }}>
                              {entry.dataKey === 'trend' ? 'Tendência' : kpi.sigla}:{' '}
                              {meta ? fmtVal(entry.value, meta.unit) : entry.value?.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                            </p>
                          ))}
                          {meta?.meta_val ? (
                            <p style={{ color: '#22c55e', borderTop: `1px solid ${tooltipBorder}`, marginTop: 4, paddingTop: 4 }}>
                              Meta: {meta.meta}
                            </p>
                          ) : null}
                        </div>
                      )
                    }}
                  />
                  {meta?.meta_val ? (
                    <ReferenceLine
                      y={meta.meta_val}
                      stroke="#22c55e"
                      strokeDasharray="6 3"
                      strokeWidth={2}
                      label={{ value: `Meta ${meta.meta}`, position: 'insideTopRight', fontSize: 10, fill: '#22c55e' }}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="valor"
                    name={kpi.sigla}
                    stroke={PRIMARY_BLUE}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: PRIMARY_BLUE, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                  {localShowTrend && (
                    <Line type="linear" dataKey="trend" name="trend" stroke="#f59e0b" strokeWidth={2} strokeDasharray="7 3" dot={false} />
                  )}
                  {points.length > 12 && (
                    <Brush
                      dataKey="comp"
                      height={28}
                      startIndex={brushPosRef.current.start}
                      endIndex={brushPosRef.current.end}
                      stroke={PRIMARY_BLUE}
                      fill={isDark ? '#1e293b' : '#f8fafc'}
                      travellerWidth={8}
                      alwaysShowText
                      tickFormatter={(v: string) => { const [m, y] = v.split('/'); return `${m}/${y?.slice(2) ?? y}` }}
                      onChange={(range: any) => {
                        if (range?.startIndex === undefined || range?.endIndex === undefined) return
                        const s = range.startIndex as number
                        const e = range.endIndex as number
                        brushPosRef.current = { start: s, end: e }
                        setLiveRange({ start: s, end: e })
                        if (debounceRef.current) clearTimeout(debounceRef.current)
                        debounceRef.current = setTimeout(() => {
                          setBrushRange({ start: s, end: e })
                          debounceRef.current = null
                        }, 2000)
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Tabela histórica com scroll próprio e filtros */}
        {kpi.serie.some(s => s.valor !== null) && (
          <div className="px-5 pb-5 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Histórico de valores
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <ExternalLink size={10} />
                "Ver" abre o detalhamento
              </p>
            </div>
            {openFilter && (
              <div className="fixed inset-0 z-10" onClick={() => setOpenFilter(null)} />
            )}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                    <tr>
                      <th className="px-3 py-2">
                        <button onClick={() => toggleSort('comp')} className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                          Competência <SortIcon col="comp" />
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button onClick={() => toggleSort('valor')} className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-auto">
                          Valor <SortIcon col="valor" />
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right relative">
                        <div className="inline-flex items-center gap-2 ml-auto">
                          <button onClick={() => toggleSort('delta')} className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                            Variação Mês <SortIcon col="delta" />
                          </button>
                          <button
                            ref={deltaFilterBtnRef}
                            onClick={(e) => {
                              e.stopPropagation()
                              const rect = deltaFilterBtnRef.current?.getBoundingClientRect()
                              if (rect) setDeltaFilterPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                              setOpenFilter(v => v === 'delta' ? null : 'delta')
                            }}
                            className={`p-0.5 rounded transition-colors ${deltaFilter !== 'all' ? 'text-blue-500' : 'opacity-40 hover:opacity-100'}`}
                          >
                            <Filter size={10} />
                          </button>
                        </div>
                        {openFilter === 'delta' && deltaFilterPos && (
                          <div
                            style={{ position: 'fixed', top: deltaFilterPos.top, right: deltaFilterPos.right }}
                            className="z-[200] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg p-1 min-w-[130px]"
                          >
                            {(['all', 'up', 'down'] as const).map(val => {
                              const labels = { all: 'Toda variação', up: 'Subiu', down: 'Caiu' }
                              return (
                                <button key={val} onClick={() => { setDeltaFilter(val); setOpenFilter(null) }}
                                  className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${deltaFilter === val ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}
                                >
                                  {labels[val]}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </th>
                      <th className="px-3 py-2 text-center relative">
                        <div className="inline-flex items-center gap-1 justify-center">
                          <span>Status</span>
                          <button
                            ref={statusFilterBtnRef}
                            onClick={(e) => {
                              e.stopPropagation()
                              const rect = statusFilterBtnRef.current?.getBoundingClientRect()
                              if (rect) setStatusFilterPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                              setOpenFilter(v => v === 'status' ? null : 'status')
                            }}
                            className={`p-0.5 rounded transition-colors ${statusFilter !== 'all' ? 'text-blue-500' : 'opacity-40 hover:opacity-100'}`}
                          >
                            <Filter size={10} />
                          </button>
                        </div>
                        {openFilter === 'status' && statusFilterPos && (
                          <div
                            style={{ position: 'fixed', top: statusFilterPos.top, right: statusFilterPos.right }}
                            className="z-[200] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg p-1 min-w-[150px]"
                          >
                            {(['all', 'ok', 'critical'] as const).map(val => {
                              const labels = { all: 'Todos', ok: 'Dentro da meta', critical: 'Fora da meta' }
                              return (
                                <button key={val} onClick={() => { setStatusFilter(val); setOpenFilter(null) }}
                                  className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${statusFilter === val ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}
                                >
                                  {labels[val]}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </th>
                      <th className="px-3 py-2 text-center">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {sortedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-400">
                          Nenhum mês corresponde aos filtros selecionados.
                        </td>
                      </tr>
                    ) : sortedRows.map(row => {
                      const rowStatus = meta?.meta_val ? getStatus(row.valor, meta.meta_val, meta.meta_op) : 'none'
                      const rowStyle  = STATUS_STYLE[rowStatus]
                      const deltaPos  = (row.delta ?? 0) > 0
                      return (
                        <tr key={row.competencia} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">{fmtComp(row.competencia)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                            {meta ? fmtVal(row.valor, meta.unit) : (row.valor?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) ?? '—')}
                          </td>
                          <td className="px-3 py-2 text-right text-xs">
                            {row.delta !== null ? (
                              <span className={deltaPos ? 'text-blue-500' : 'text-orange-500'}>
                                {deltaPos ? '+' : ''}
                                {row.delta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                {meta?.unit === '%' ? '%' : meta?.unit === 'h' ? 'h' : ''}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.valor !== null && rowStatus !== 'none' ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${rowStyle.badge}`}>
                                {rowStatus === 'ok' ? 'Dentro da meta' : 'Fora da meta'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleVerDetalhe(row.competencia)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                            >
                              <ExternalLink size={11} />
                              Ver
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card de KPI ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  kpi: KpiSerie
  isDark: boolean
  showTrend: boolean
  yearFilter: string
  onClick: () => void
}

function KpiCard({ kpi, isDark, showTrend, yearFilter, onClick }: KpiCardProps) {
  const meta      = KPI_META[kpi.cod]

  // Filtra a série pelo ano selecionado para os cálculos e o gráfico do card
  const cardSerie = yearFilter === 'Todos'
    ? kpi.serie
    : kpi.serie.filter(s => s.competencia.startsWith(yearFilter))

  const { points } = buildChartData(cardSerie)
  const displayPoints = points.slice(-3)
  // slope calculado apenas sobre os 3 últimos meses visíveis para consistência com o gráfico
  const { slope } = buildChartData(cardSerie.slice(-3))
  const validVals  = cardSerie.filter(s => s.valor !== null).map(s => s.valor as number)
  const avg        = validVals.length > 0 ? validVals.reduce((a, b) => a + b, 0) / validVals.length : null
  const hasData    = validVals.length > 0
  const lastValid  = [...cardSerie].reverse().find(s => s.valor !== null)
  const status     = meta?.meta_val ? getStatus(lastValid?.valor ?? null, meta.meta_val, meta.meta_op) : 'none'
  const style      = STATUS_STYLE[status]
  const trendGood  = meta?.meta_val ? (meta.meta_op === 'gte' ? slope >= 0 : slope <= 0) : null

  const textColor     = isDark ? '#94a3b8' : '#64748b'
  const gridColor     = isDark ? '#334155' : '#f1f5f9'
  const tooltipBg     = isDark ? '#1e293b' : '#ffffff'
  const tooltipBorder = isDark ? '#475569' : '#e2e8f0'

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer overflow-hidden flex flex-col"
      style={{ borderLeftWidth: 3, borderLeftColor: style.border }}
      onClick={onClick}
    >
      {/* Cabeçalho */}
      <div className="pl-3 pr-4 pt-3 pb-1">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0">{kpi.cod}</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{kpi.sigla}</span>
          </div>
          {meta?.meta_val ? (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border shrink-0 ${style.badge}`}>
              {meta.meta}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 truncate leading-tight">{kpi.nome}</p>
      </div>

      {/* Gráfico */}
      <div className="flex-1">
        {!hasData ? (
          <div className="h-24 flex items-center justify-center text-xs text-slate-300 dark:text-slate-600">
            {yearFilter !== 'Todos' ? `Sem dados em ${yearFilter}` : 'Sem dados'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={displayPoints} margin={{ top: 4, right: 36, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.6} />
              <XAxis
                dataKey="comp"
                tick={{ fontSize: 8, fill: textColor }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 8, fill: textColor }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={v => meta?.unit === '%' ? `${v}%` : String(v)}
              />
              <Tooltip
                content={(props: any) => {
                  if (!props.active || !props.payload?.length) return null
                  return (
                    <div style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 6, fontSize: 10, padding: '4px 8px' }}>
                      <p style={{ color: textColor, marginBottom: 3, fontWeight: 600 }}>{props.label}</p>
                      {props.payload.map((entry: any) => (
                        <p key={entry.dataKey} style={{ color: entry.dataKey === 'trend' ? '#f59e0b' : PRIMARY_BLUE, marginBottom: 2 }}>
                          {entry.dataKey === 'trend' ? 'Tendência' : kpi.sigla}:{' '}
                          {meta ? fmtVal(entry.value, meta.unit) : entry.value?.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        </p>
                      ))}
                      {meta?.meta_val ? (
                        <p style={{ color: '#22c55e', borderTop: `1px solid ${tooltipBorder}`, marginTop: 3, paddingTop: 3 }}>
                          Meta: {meta.meta}
                        </p>
                      ) : null}
                    </div>
                  )
                }}
              />
              {meta?.meta_val ? (
                <ReferenceLine
                  y={meta.meta_val}
                  stroke="#22c55e"
                  strokeDasharray="4 2"
                  strokeWidth={1.5}
                  strokeOpacity={0.9}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="valor"
                stroke={PRIMARY_BLUE}
                strokeWidth={2}
                dot={{ r: 2.5, fill: PRIMARY_BLUE, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
              {showTrend && (
                <Line
                  type="linear"
                  dataKey="trend"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Rodapé: último valor + média */}
      <div className="pl-3 pr-4 pb-3 flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-bold leading-none" style={{ color: style.border }}>
              {meta ? fmtVal(lastValid?.valor ?? null, meta.unit) : (lastValid?.valor?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) ?? '—')}
            </span>
            {lastValid && (
              <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                {fmtComp(lastValid.competencia)}
              </span>
            )}
          </div>
          {hasData && trendGood !== null && Math.abs(slope) >= 0.001 && (
            <span className={`flex items-center gap-1 shrink-0 font-semibold ${trendGood ? 'text-green-500' : 'text-red-400'}`}>
              {trendGood ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              <span className="font-normal text-slate-400 dark:text-slate-500 text-xs">3 meses</span>
            </span>
          )}
        </div>
        {avg !== null && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {yearFilter === 'Todos' ? 'Média histórica' : `Média ${yearFilter}`}
            {': '}
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              {fmtVal(avg, meta?.unit ?? '')}
            </span>
          </p>
        )}
        <button
          onClick={onClick}
          className="mt-1.5 w-full text-[11px] font-semibold py-1 rounded border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          Ver detalhes
        </button>
      </div>
    </div>
  )
}

// ── Linha de mês (Pacotes) ────────────────────────────────────────────────────

function MesRow({ mes }: { mes: MesStatus }) {
  const [loading, setLoading] = useState<'full' | 'excel' | 'txts' | null>(null)

  const handleDownload = async (tipo: 'full' | 'excel' | 'txts') => {
    setLoading(tipo)
    const tid = toast.loading(
      `Gerando ${tipo === 'excel' ? 'Excel' : tipo === 'txts' ? 'ZIP TXTs' : 'ZIP completo'}…`
    )
    try {
      const blob = await downloadPacote(mes.competencia, tipo)
      const ext   = tipo === 'excel' ? (isDemoMode ? 'txt' : 'xlsx') : 'zip'
      const label = tipo === 'excel' ? 'Indicadores' : tipo === 'txts' ? 'TXTs' : 'Pacote'
      triggerDownload(blob, `${label}_SMD_${mes.competencia}.${ext}`)
      toast.success('Download iniciado', { id: tid })
    } catch {
      toast.error('Erro ao gerar pacote', { id: tid })
    } finally {
      setLoading(null)
    }
  }

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3 font-mono font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
        {fmtComp(mes.competencia)}
        {mes.corrente && (
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400">
            <Clock size={11} /> Em andamento
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {mes.fechado ? (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border bg-green-50 border-green-200 text-green-700">
              <CheckCircle2 size={11} /> Fechado
            </span>
            {mes.dt_fechamento && (
              <span className="text-xs text-slate-400">{fmtDt(mes.dt_fechamento)}</span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border bg-slate-50 border-slate-200 text-slate-500">
            <Clock size={11} /> Aberto
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownload('excel')}
            disabled={loading !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-transparent bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading === 'excel' ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
            Excel
          </button>
          <button
            onClick={() => handleDownload('txts')}
            disabled={loading !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading === 'txts' ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
            TXTs
          </button>
          <button
            onClick={() => handleDownload('full')}
            disabled={loading !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-transparent text-white disabled:opacity-50 transition-colors shadow-sm"
            style={{ backgroundColor: PRIMARY_BLUE }}
          >
            {loading === 'full' ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
            ZIP Completo
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function HistoricoKPI() {
  const [meses,         setMeses]         = useState<MesStatus[]>([])
  const [series,        setSeries]        = useState<KpiSerie[]>([])
  const [loadingMeses,  setLoadingMeses]  = useState(true)
  const [loadingSeries, setLoadingSeries] = useState(true)
  const [activeTab,     setActiveTab]     = useState<'graficos' | 'pacotes'>('graficos')
  const [catFilter,        setCatFilter]        = useState('Todas')
  const [yearFilter,       setYearFilter]       = useState('Todos')
  const [search,           setSearch]           = useState('')
  const [showTrend,        setShowTrend]        = useState(true)
  const [selectedKpiIdx,   setSelectedKpiIdx]   = useState<number | null>(null)
  const [statusCardFilter, setStatusCardFilter] = useState<'all' | 'ok' | 'critical'>('all')
  const [trendCardFilter,  setTrendCardFilter]  = useState<'all' | 'melhora' | 'piora'>('all')
  const [servicoFilter,    setServicoFilter]    = useState('Todos')
  const [showGroupFilter,  setShowGroupFilter]  = useState(false)
  const [pinFilters,       setPinFilters]       = useState(false)
  const [mesSearch,        setMesSearch]        = useState('')
  const [mesStatusFilter,  setMesStatusFilter]  = useState<'all' | 'fechado' | 'aberto'>('all')
  const [mesSortCol,       setMesSortCol]       = useState<'comp' | 'status'>('comp')
  const [mesSortDir,       setMesSortDir]       = useState<'asc' | 'desc'>('desc')

  const { theme } = useThemeStore()
  const isDark    = theme === 'dark'

  useEffect(() => {
    setLoadingMeses(true)
    fetchMeses()
      .then(setMeses)
      .catch(() => toast.error('Erro ao carregar meses'))
      .finally(() => setLoadingMeses(false))

    fetchSeries()
      .then(setSeries)
      .catch(() => toast.error('Erro ao carregar séries'))
      .finally(() => setLoadingSeries(false))
  }, [])

  // Anos disponíveis extraídos do histórico completo
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    series.forEach(kpi => kpi.serie.forEach(s => years.add(s.competencia.slice(0, 4))))
    return ['Todos', ...Array.from(years).sort().reverse()]
  }, [series])

  const MONTH_NAMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

  const filteredMeses = useMemo(() => {
    const filtered = meses.filter(mes => {
      if (mesSearch) {
        const q = mesSearch.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        const compFmt = fmtComp(mes.competencia).toLowerCase()
        const [year, monthNum] = mes.competencia.split('-')
        const monthIdx = parseInt(monthNum, 10) - 1
        const monthName = MONTH_NAMES[monthIdx] ?? ''
        const monthNameNorm = monthName.normalize('NFD').replace(/[̀-ͯ]/g, '')
        const searchable = `${compFmt} ${monthName} ${monthNameNorm} ${year}`
        if (!searchable.includes(q)) return false
      }
      if (mesStatusFilter === 'fechado' && !mes.fechado) return false
      if (mesStatusFilter === 'aberto'  &&  mes.fechado) return false
      return true
    })
    filtered.sort((a, b) => {
      let cmp = 0
      if (mesSortCol === 'comp') {
        cmp = a.competencia.localeCompare(b.competencia)
      } else {
        const rank = (m: typeof a) => m.fechado ? 1 : m.corrente ? 0 : 2
        cmp = rank(a) - rank(b)
      }
      return mesSortDir === 'asc' ? cmp : -cmp
    })
    return filtered
  }, [meses, mesSearch, mesStatusFilter, mesSortCol, mesSortDir])

  // Filtra por categoria, busca, status e tendência (filtro de ano é aplicado dentro do KpiCard)
  const filteredSeries = useMemo(() => {
    return series.filter(kpi => {
      const meta = KPI_META[kpi.cod]
      if (catFilter !== 'Todas' && meta?.categoria !== catFilter) return false
      if (servicoFilter !== 'Todos' && SERVICO[kpi.cod] !== servicoFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!kpi.sigla.toLowerCase().includes(q) && !kpi.nome.toLowerCase().includes(q) && !kpi.cod.includes(q))
          return false
      }
      if (statusCardFilter !== 'all') {
        const lastValid = [...kpi.serie].reverse().find(s => s.valor !== null)
        const st = meta?.meta_val ? getStatus(lastValid?.valor ?? null, meta.meta_val, meta.meta_op) : 'none'
        if (st !== statusCardFilter) return false
      }
      if (trendCardFilter !== 'all') {
        if (!meta?.meta_val) return false
        const last3 = kpi.serie.slice(-3)
        const { slope } = buildChartData(last3)
        if (Math.abs(slope) < 0.001) return false
        const trendGood = meta.meta_op === 'gte' ? slope >= 0 : slope <= 0
        if (trendCardFilter === 'melhora' && !trendGood) return false
        if (trendCardFilter === 'piora'   &&  trendGood) return false
      }
      return true
    })
  }, [series, catFilter, servicoFilter, search, statusCardFilter, trendCardFilter])

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Topbar */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-2.5 flex items-center justify-between shadow-sm">
          <Breadcrumbs items={[{ label: 'Menu Principal', to: '/menu' }, { label: 'Histórico de KPIs' }]} />
          <HeaderActions />
        </div>

        {/* Abas */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5">
          <div className="flex">
            {(['graficos', 'pacotes'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {tab === 'graficos' ? 'Evolução dos Indicadores' : 'Pacotes de Indicadores'}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className={pinFilters ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'flex-1 min-h-0 overflow-y-auto'}>

            {/* ── Aba Gráficos ── */}
            {activeTab === 'graficos' && (
              <>
                {/* Toolbar fixo */}
                <div className={pinFilters ? 'flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 pt-3 pb-2' : 'px-5 pt-3 pb-2'}>
                <div className="max-w-[1400px] mx-auto">
                {/* Linha de controles — Período, busca, status, tendência + toggle de grupo */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {availableYears.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Período:</span>
                      <div className="relative">
                        <select
                          value={yearFilter}
                          onChange={e => setYearFilter(e.target.value)}
                          className="appearance-none text-xs border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 pr-7 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          {availableYears.map(y => (
                            <option key={y} value={y}>{y === 'Todos' ? 'Todo o período' : y}</option>
                          ))}
                        </select>
                        <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar KPI…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-7 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-500 rounded-lg shadow-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
                    />
                  </div>

                  <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1 shrink-0" />

                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">Tendência:</span>
                  <button
                    onClick={() => setShowTrend(v => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border shadow-sm transition-colors shrink-0 ${
                      showTrend
                        ? 'border-orange-300 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950'
                        : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {showTrend ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showTrend ? 'Ocultar linha' : 'Mostrar linha'}
                  </button>

                  {([['melhora', 'Positiva', '#22c55e'], ['piora', 'Negativa', '#f87171']] as const).map(([val, label, color]) => (
                    <button
                      key={val}
                      onClick={() => setTrendCardFilter(v => v === val ? 'all' : val)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border shadow-sm transition-colors ${
                        trendCardFilter === val
                          ? 'text-white border-transparent shadow-none'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400'
                      }`}
                      style={trendCardFilter === val ? { backgroundColor: color, borderColor: color } : {}}
                    >
                      {label}
                    </button>
                  ))}

                  <button
                    onClick={() => setShowGroupFilter(v => !v)}
                    className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border shadow-sm transition-colors shrink-0 ${
                      showGroupFilter || catFilter !== 'Todas' || servicoFilter !== 'Todos'
                        ? 'text-white border-transparent'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                    style={showGroupFilter || catFilter !== 'Todas' || servicoFilter !== 'Todos' ? { backgroundColor: PRIMARY_BLUE, borderColor: PRIMARY_BLUE } : {}}
                  >
                    Categorias e Serviços
                    <ChevronDown
                      size={13}
                      className="transition-transform duration-200"
                      style={{ transform: showGroupFilter ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>

                  {(statusCardFilter !== 'all' || trendCardFilter !== 'all' || catFilter !== 'Todas' || servicoFilter !== 'Todos' || search || yearFilter !== 'Todos') && (
                    <button
                      onClick={() => { setStatusCardFilter('all'); setTrendCardFilter('all'); setCatFilter('Todas'); setServicoFilter('Todos'); setSearch(''); setYearFilter('Todos') }}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors shrink-0"
                    >
                      <X size={11} />
                      Limpar filtros
                    </button>
                  )}
                </div>

                {/* Painel expansível — Grupo e Serviço */}
                <div className={`grid transition-all duration-200 ease-in-out ${showGroupFilter ? 'grid-rows-[1fr] mb-2' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                    <div className="flex flex-col gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                      {/* Grupo */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide shrink-0 w-16">Grupo</span>
                        {CATEGORIAS.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setCatFilter(cat)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border shadow-sm transition-colors ${
                              catFilter === cat
                                ? 'text-white border-transparent shadow-none'
                                : 'bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                            }`}
                            style={catFilter === cat ? { backgroundColor: PRIMARY_BLUE, borderColor: PRIMARY_BLUE } : {}}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                      {/* Serviço */}
                      <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 dark:border-slate-700 pt-3">
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide shrink-0 w-16">Serviço</span>
                        {SERVICOS.map(srv => (
                          <button
                            key={srv}
                            onClick={() => setServicoFilter(srv)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border shadow-sm transition-colors ${
                              servicoFilter === srv
                                ? 'text-white border-transparent shadow-none'
                                : 'bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                            }`}
                            style={servicoFilter === srv ? { backgroundColor: PRIMARY_BLUE, borderColor: PRIMARY_BLUE } : {}}
                          >
                            {srv}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contagem + Pin */}
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {filteredSeries.length} de {series.length} indicadores
                    {yearFilter !== 'Todos' && (
                      <span className="ml-2 text-slate-600 dark:text-slate-300 font-semibold">· {yearFilter}</span>
                    )}
                  </p>
                  <button
                    onClick={() => setPinFilters(v => !v)}
                    title={pinFilters ? 'Desfixar filtros' : 'Fixar filtros no topo'}
                    className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm transition-colors shrink-0 ${
                      pinFilters
                        ? 'text-white border-transparent'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-500 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                    style={pinFilters ? { backgroundColor: PRIMARY_BLUE, borderColor: PRIMARY_BLUE } : {}}
                  >
                    {pinFilters ? <Pin size={13} /> : <PinOff size={13} />}
                    {pinFilters ? 'Desfixar' : 'Fixar'}
                  </button>
                </div>
                </div>
                </div>

                {/* Cards scrolláveis */}
                <div className={pinFilters ? 'flex-1 min-h-0 overflow-y-auto' : ''}>
                <div className="max-w-[1400px] mx-auto px-5 py-3">

                {/* Grid de cards */}
                {loadingSeries ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="bg-slate-100 dark:bg-slate-700 rounded-xl h-56 animate-pulse" />
                    ))}
                  </div>
                ) : filteredSeries.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
                    Nenhum indicador encontrado.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredSeries.map((kpi, idx) => (
                      <KpiCard
                        key={kpi.cod}
                        kpi={kpi}
                        isDark={isDark}
                        showTrend={showTrend}
                        yearFilter={yearFilter}
                        onClick={() => setSelectedKpiIdx(idx)}
                      />
                    ))}
                  </div>
                )}
                </div>
                </div>
              </>
            )}

            {/* ── Aba Pacotes ── */}
            {activeTab === 'pacotes' && (
              <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-[1400px] mx-auto px-5 py-4">
              <section>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Package size={16} style={{ color: PRIMARY_BLUE }} />
                  Pacotes de Indicadores
                </h2>

                {/* Toolbar: busca + filtro de status */}
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      value={mesSearch}
                      onChange={e => setMesSearch(e.target.value)}
                      placeholder="Buscar competência…"
                      className="pl-7 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                    />
                  </div>
                  {(['all', 'fechado', 'aberto'] as const).map(val => {
                    const labels = { all: 'Todos', fechado: 'Fechados', aberto: 'Abertos' }
                    const active = mesStatusFilter === val
                    return (
                      <button
                        key={val}
                        onClick={() => setMesStatusFilter(val)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {labels[val]}
                      </button>
                    )
                  })}
                  {(mesSearch || mesStatusFilter !== 'all') && (
                    <button
                      onClick={() => { setMesSearch(''); setMesStatusFilter('all') }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      <X size={11} /> Limpar
                    </button>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs">
                      <tr>
                        <th className="px-4 py-3">
                          <button
                            onClick={() => { if (mesSortCol === 'comp') setMesSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setMesSortCol('comp'); setMesSortDir('desc') } }}
                            className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                          >
                            Competência
                            {mesSortCol === 'comp' ? (mesSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
                          </button>
                        </th>
                        <th className="px-4 py-3">
                          <button
                            onClick={() => { if (mesSortCol === 'status') setMesSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setMesSortCol('status'); setMesSortDir('asc') } }}
                            className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                          >
                            Status
                            {mesSortCol === 'status' ? (mesSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
                          </button>
                        </th>
                        <th className="px-4 py-3">Downloads</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {loadingMeses ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-400">
                            Carregando…
                          </td>
                        </tr>
                      ) : filteredMeses.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-400">
                            {meses.length === 0 ? 'Nenhum mês disponível a partir de 12/2025.' : 'Nenhum resultado para os filtros aplicados.'}
                          </td>
                        </tr>
                      ) : filteredMeses.map(mes => (
                        <MesRow key={mes.competencia} mes={mes} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                  <Download size={11} />
                  Gera o pacote em tempo real a partir dos dados mais recentes do banco.
                </p>
              </section>
            </div>
          </div>
            )}

        </div>
      </div>

      {/* Modal de detalhe — usa histórico completo, sem filtro de ano */}
      {selectedKpiIdx !== null && filteredSeries[selectedKpiIdx] && (
        <KpiModal
          kpi={filteredSeries[selectedKpiIdx]}
          isDark={isDark}
          showTrend={showTrend}
          onClose={() => setSelectedKpiIdx(null)}
          hasPrev={selectedKpiIdx > 0}
          hasNext={selectedKpiIdx < filteredSeries.length - 1}
          position={`${selectedKpiIdx + 1} / ${filteredSeries.length}`}
          onPrev={() => setSelectedKpiIdx(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setSelectedKpiIdx(i => Math.min(filteredSeries.length - 1, (i ?? 0) + 1))}
        />
      )}
    </Layout>
  )
}
