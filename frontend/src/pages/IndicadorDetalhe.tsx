import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, CircleAlert, CircleHelp, Database, ChevronLeft, ChevronRight, Download, Filter, Maximize2, Minimize2, X, XCircle } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, PieChart, Pie, Legend, Brush,
} from 'recharts'
import toast from 'react-hot-toast'
import { Layout } from '../components/Layout'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { HeaderActions } from '../components/HeaderActions'
import { DetailSkeleton } from '../components/Skeleton'
import { fetchIndicador, fetchHistorico, downloadIndicadorExcel } from '../api/kpis'
import { useFilterStore } from '../store/filterStore'
import { useThemeStore } from '../store/themeStore'
import type { KpiDetail, KpiHistoricoItem } from '../types'

function fmtCell(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const d = String(val.getDate()).padStart(2, '0')
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const y = String(val.getFullYear()).slice(-2)
    const hh = String(val.getHours()).padStart(2, '0')
    const mm = String(val.getMinutes()).padStart(2, '0')
    const ss = String(val.getSeconds()).padStart(2, '0')
    return `${d}/${m}/${y} ${hh}:${mm}:${ss}`
  }
  if (typeof val === 'number') {
    if (!isFinite(val)) return '—'
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }

  const s = String(val)
  const dateTimeMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
  if (dateTimeMatch) {
    const [, y, m, d, hh, mm, ss] = dateTimeMatch
    return `${d}/${m}/${y.slice(-2)} ${hh}:${mm}:${ss}`
  }

  const dateMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateMatch) {
    const [, y, m, d] = dateMatch
    return `${d}/${m}/${y.slice(-2)} 00:00:00`
  }

  return s
}

const PRIMARY_BLUE = '#205DF5'
const STATUS_COLOR: Record<string, string> = {
  ok:       '#1E9640',
  alert:    '#F0A900',
  critical: '#E60975',
  pending:  '#94a3b8',
}
const DONUT_COLORS = ['#1E9640', '#205DF5', '#F0A900', '#E60975', '#94a3b8', '#475569']
const PER_PAGE = 5
const SAT_KPIS = ['09', '10', '11']
const AVAILABILITY_KPIS = ['02', '04', '05', '07', '08']
const INVENTORY_BANDWIDTH_KPIS = ['03', '06']
const RESPONSE_TIME_KPIS = ['12', '16', '20', '24', '28']
const SOLUTION_TIME_KPIS = ['13', '17', '21', '25', '29']
const EFFECTIVENESS_KPIS = ['14', '18', '22', '26', '30']
const REOPEN_KPIS = ['15', '19', '23', '27', '31']
const detailCache = new Map<string, { detail: KpiDetail; historico: KpiHistoricoItem[] }>()

interface DetailColumn {
  key: string
  label: string
}

type AvailabilityView = 'auditor' | 'real'
type EffectivenessView = 'ta' | 'tf' | 'tf_sem_ta'
type ReopenView = 'all' | 'reopened' | 'not_reopened'
type SortDirection = 'asc' | 'desc'
type SortConfig = { col: string; direction: SortDirection } | null

const KPI_DETAIL_COLUMNS: Record<string, DetailColumn[]> = {
  '01': [
    { key: 'competencia_referencia', label: 'competencia_referencia' },
    { key: 'trecho_origem', label: 'trecho_origem' },
    { key: 'trecho_destino', label: 'trecho_destino' },
    { key: 'nc', label: 'nao_conformidade' },
    { key: 'extensao_km', label: 'extensao_km' },
    { key: 'm', label: 'medicoes_trecho' },
    { key: 'dt_inicio', label: 'dt_inicio' },
    { key: 'dt_final', label: 'dt_final' },
    { key: 'usuario_email', label: 'usuario_email' },
  ],
  '03': [
    { key: 'host', label: 'host' },
    { key: 'ref_externa', label: 'ref_externa' },
    { key: 'contratado', label: 'contratado' },
    { key: 'medido', label: 'medido' },
    { key: 'status_inventario', label: 'status' },
  ],
  '06': [
    { key: 'host', label: 'host' },
    { key: 'ref_externa', label: 'ref_externa' },
    { key: 'contratado', label: 'contratado' },
    { key: 'medido', label: 'medido' },
    { key: 'status_inventario', label: 'status' },
  ],
  '09': [
    { key: 'competencia_referencia', label: 'competencia_referencia' },
    { key: 'ticket_id', label: 'ticket_id' },
    { key: 'host', label: 'host' },
    { key: 'ref_externa', label: 'ref_externa' },
    { key: 'avaliacao', label: 'avaliacao' },
    { key: 'status_satisfacao', label: 'status' },
    { key: 'dt_inicial', label: 'dt_inicial' },
    { key: 'dt_final', label: 'dt_final' },
    { key: 'duracao_em_dias', label: 'duracao_em_dias' },
  ],
  '10': [
    { key: 'competencia_referencia', label: 'competencia_referencia' },
    { key: 'ticket_id', label: 'ticket_id' },
    { key: 'host', label: 'host' },
    { key: 'ref_externa', label: 'ref_externa' },
    { key: 'avaliacao', label: 'avaliacao' },
    { key: 'status_satisfacao', label: 'status' },
    { key: 'dt_inicial', label: 'dt_inicial' },
    { key: 'dt_final', label: 'dt_final' },
    { key: 'duracao_em_dias', label: 'duracao_em_dias' },
  ],
  '11': [
    { key: 'competencia_referencia', label: 'competencia_referencia' },
    { key: 'ticket_id', label: 'ticket_id' },
    { key: 'host', label: 'host' },
    { key: 'ref_externa', label: 'ref_externa' },
    { key: 'avaliacao', label: 'avaliacao' },
    { key: 'status_satisfacao', label: 'status' },
    { key: 'dt_inicial', label: 'dt_inicial' },
    { key: 'dt_final', label: 'dt_final' },
    { key: 'duracao_em_dias', label: 'duracao_em_dias' },
  ],
  '12': [
    { key: 'competencia_referencia', label: 'competencia_referencia' },
    { key: 'ticket_id', label: 'ticket_id' },
    { key: 'host', label: 'host' },
    { key: 'ref_externa', label: 'ref_externa' },
    { key: 'dt_inicial', label: 'dt_inicial' },
    { key: 'dt_triagem', label: 'dt_triagem' },
    { key: 'medicao', label: 'medicao' },
    { key: 'duracao_em_dias', label: 'duracao_em_dias' },
  ],
  '13': [
    { key: 'ticket_id', label: 'Ticket' },
    { key: 'host', label: 'Cliente' },
    { key: 'ref_externa', label: 'Ref. Externa' },
    { key: 'horas_pendente_cliente', label: 'Pendente Cliente (h)' },
    { key: 'dt_inicial', label: 'Abertura' },
    { key: 'dt_final', label: 'Resolucao' },
    { key: 'medicao', label: 'TS Liquido (h)' },
    { key: 'duracao_em_dias', label: 'Duracao' },
  ],
  '16': [
    { key: 'competencia_referencia', label: 'competencia_referencia' },
    { key: 'ticket_id', label: 'ticket_id' },
    { key: 'host', label: 'host' },
    { key: 'ref_externa', label: 'ref_externa' },
    { key: 'dt_inicial', label: 'dt_inicial' },
    { key: 'dt_triagem', label: 'dt_triagem' },
    { key: 'medicao', label: 'medicao' },
    { key: 'duracao_em_dias', label: 'duracao_em_dias' },
  ],
  '17': [
    { key: 'ticket_id', label: 'Ticket' },
    { key: 'host', label: 'Cliente' },
    { key: 'ref_externa', label: 'Ref. Externa' },
    { key: 'horas_pendente_cliente', label: 'Pendente Cliente (h)' },
    { key: 'dt_inicial', label: 'Abertura' },
    { key: 'dt_final', label: 'Resolucao' },
    { key: 'medicao', label: 'TS Liquido (h)' },
    { key: 'duracao_em_dias', label: 'Duracao' },
  ],
  '20': [
    { key: 'competencia_referencia', label: 'competencia_referencia' },
    { key: 'ticket_id', label: 'ticket_id' },
    { key: 'host', label: 'host' },
    { key: 'ref_externa', label: 'ref_externa' },
    { key: 'dt_inicial', label: 'dt_inicial' },
    { key: 'dt_triagem', label: 'dt_triagem' },
    { key: 'medicao', label: 'medicao' },
    { key: 'duracao_em_dias', label: 'duracao_em_dias' },
  ],
  '21': [
    { key: 'ticket_id', label: 'Ticket' },
    { key: 'host', label: 'Cliente' },
    { key: 'ref_externa', label: 'Ref. Externa' },
    { key: 'horas_pendente_cliente', label: 'Pendente Cliente (h)' },
    { key: 'dt_inicial', label: 'Abertura' },
    { key: 'dt_final', label: 'Resolucao' },
    { key: 'medicao', label: 'TS Liquido (h)' },
    { key: 'duracao_em_dias', label: 'Duracao' },
  ],
  '24': [
    { key: 'competencia_referencia', label: 'competencia_referencia' },
    { key: 'ticket_id', label: 'ticket_id' },
    { key: 'host', label: 'host' },
    { key: 'ref_externa', label: 'ref_externa' },
    { key: 'dt_inicial', label: 'dt_inicial' },
    { key: 'dt_triagem', label: 'dt_triagem' },
    { key: 'medicao', label: 'medicao' },
    { key: 'duracao_em_dias', label: 'duracao_em_dias' },
  ],
  '25': [
    { key: 'ticket_id', label: 'Ticket' },
    { key: 'host', label: 'Cliente' },
    { key: 'ref_externa', label: 'Ref. Externa' },
    { key: 'horas_pendente_cliente', label: 'Pendente Cliente (h)' },
    { key: 'dt_inicial', label: 'Abertura' },
    { key: 'dt_final', label: 'Resolucao' },
    { key: 'medicao', label: 'TS Liquido (h)' },
    { key: 'duracao_em_dias', label: 'Duracao' },
  ],
  '28': [
    { key: 'competencia_referencia', label: 'competencia_referencia' },
    { key: 'ticket_id', label: 'ticket_id' },
    { key: 'host', label: 'host' },
    { key: 'ref_externa', label: 'ref_externa' },
    { key: 'dt_inicial', label: 'dt_inicial' },
    { key: 'dt_triagem', label: 'dt_triagem' },
    { key: 'medicao', label: 'medicao' },
    { key: 'duracao_em_dias', label: 'duracao_em_dias' },
  ],
  '29': [
    { key: 'ticket_id', label: 'Ticket' },
    { key: 'host', label: 'Cliente' },
    { key: 'ref_externa', label: 'Ref. Externa' },
    { key: 'horas_pendente_cliente', label: 'Pendente Cliente (h)' },
    { key: 'dt_inicial', label: 'Abertura' },
    { key: 'dt_final', label: 'Resolucao' },
    { key: 'medicao', label: 'TS Liquido (h)' },
    { key: 'duracao_em_dias', label: 'Duracao' },
  ],
}

const AVAILABILITY_COMMON_COLUMNS: DetailColumn[] = [
  { key: 'competencia_referencia', label: 'competencia_referencia' },
  { key: 'host', label: 'host' },
  { key: 'trigger_desc', label: 'trigger_desc' },
]

const AVAILABILITY_VIEW_COLUMNS: Record<AvailabilityView, DetailColumn[]> = {
  auditor: [
    { key: 'dt_inicio_auditor', label: 'dt_inicio_Auditor' },
    { key: 'dt_final_auditor', label: 'dt_final_Auditor' },
    { key: 'horas_indisp_auditor', label: 'horas_indisp_auditor' },
    { key: 'duracao_em_dias_auditor', label: 'duracao_em_dias_Auditor' },
  ],
  real: [
    { key: 'dt_inicio_real', label: 'dt_inicio_real' },
    { key: 'dt_final_real', label: 'dt_final_real' },
    { key: 'horas_indisp_real', label: 'horas_indisp_real' },
    { key: 'duracao_em_dias', label: 'duracao_em_dias_real' },
  ],
}

const AVAILABILITY_VIEW_DESCRIPTION: Record<AvailabilityView, string> = {
  auditor: 'Visão Auditor: considera somente a indisponibilidade dentro da competência de referência, usada para apuração contratual.',
  real: 'Visão Real: mostra o intervalo completo do evento, mesmo quando começa antes ou termina depois da competência.',
}

const SOLUTION_TIME_COLUMNS: DetailColumn[] = [
  { key: 'competencia_referencia', label: 'competencia_referencia' },
  { key: 'ticket_id', label: 'ticket_id' },
  { key: 'host', label: 'host' },
  { key: 'ref_externa', label: 'ref_externa' },
  { key: 'dt_inicial', label: 'dt_inicial' },
  { key: 'dt_final', label: 'dt_final' },
  { key: 'horas_pendente_cliente', label: 'horas_pendente_cliente' },
  { key: 'medicao', label: 'medicao' },
  { key: 'duracao_em_dias', label: 'duracao_em_dias' },
]

const EFFECTIVENESS_COLUMNS: DetailColumn[] = [
  { key: 'competencia_referencia', label: 'competencia_referencia' },
  { key: 'ticket_id', label: 'ticket_id' },
  { key: 'host', label: 'host' },
  { key: 'ref_externa', label: 'ref_externa' },
  { key: 'dt_inicial', label: 'dt_inicial' },
  { key: 'dt_final', label: 'dt_final' },
  { key: 'status_atendimento', label: 'status_atendimento' },
  { key: 'conta_ta', label: 'conta_ta' },
  { key: 'conta_tf', label: 'conta_tf' },
  { key: 'duracao_em_dias', label: 'duracao_em_dias' },
]

const REOPEN_COLUMNS: DetailColumn[] = [
  { key: 'competencia_referencia', label: 'competencia_referencia' },
  { key: 'ticket_id', label: 'ticket_id' },
  { key: 'host', label: 'host' },
  { key: 'ref_externa', label: 'ref_externa' },
  { key: 'dt_inicial', label: 'dt_inicial' },
  { key: 'dt_final', label: 'dt_final' },
  { key: 'reaberto', label: 'reaberto' },
  { key: 'duracao_em_dias', label: 'duracao_em_dias' },
]

const EFFECTIVENESS_VIEW_DESCRIPTION: Record<EffectivenessView, string> = {
  ta: 'Tickets abertos dentro da competência.',
  tf: 'Tickets finalizados dentro da competência.',
  tf_sem_ta: 'Tickets finalizados no mês que foram abertos em outra competência.',
}

const EFFECTIVENESS_VIEW_LABEL: Record<EffectivenessView, string> = {
  ta: 'Abertos no mês',
  tf: 'Fechados no mês',
  tf_sem_ta: 'TF sem TA',
}

const REOPEN_VIEW_LABEL: Record<ReopenView, string> = {
  all: 'Todos',
  reopened: 'Reabertos',
  not_reopened: 'Não reabertos',
}

interface IndicadorDetalheContentProps {
  cod?: string
  modal?: boolean
  onClose?: () => void
  competenciaProp?: string
  hasPrev?: boolean
  hasNext?: boolean
  position?: string
  onPrev?: () => void
  onNext?: () => void
}

function yyyyMM(offsetMonths = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function parseNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (!v) return 0
  const cleaned = String(v).trim().replace(/[^\d,.-]/g, '')
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const normalized = lastComma > -1 && lastDot > -1
    ? lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
    : cleaned.replace(',', '.')
  return parseFloat(normalized) || 0
}

function fmtTotal(val: number): string {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDurationFromHours(value: unknown): string {
  const totalMinutes = Math.round(parseNum(value) * 60)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  return `${String(days).padStart(2, '0')}d ${hours}h ${minutes}m`
}

function isAvailabilityKpi(cod: string): boolean {
  return AVAILABILITY_KPIS.includes(cod)
}

function isInventoryBandwidthKpi(cod: string): boolean {
  return INVENTORY_BANDWIDTH_KPIS.includes(cod)
}

function isSatisfactionKpi(cod: string): boolean {
  return SAT_KPIS.includes(cod)
}

function isResponseTimeKpi(cod: string): boolean {
  return RESPONSE_TIME_KPIS.includes(cod)
}

function isSolutionTimeKpi(cod: string): boolean {
  return SOLUTION_TIME_KPIS.includes(cod)
}

function isEffectivenessKpi(cod: string): boolean {
  return EFFECTIVENESS_KPIS.includes(cod)
}

function isReopenKpi(cod: string): boolean {
  return REOPEN_KPIS.includes(cod)
}

function getAvailabilityColumns(view: AvailabilityView): DetailColumn[] {
  return [...AVAILABILITY_COMMON_COLUMNS, ...AVAILABILITY_VIEW_COLUMNS[view]]
}

function hostToRefExterna(host: string): string {
  const match = host.match(/^([A-Za-z]+)(\d+)/)
  return match ? `${match[1].toUpperCase()}${match[2].padStart(4, '0')}` : host
}

function fmtMbps(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const numeric = parseNum(value)
  return numeric > 0 ? `${numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mbps` : String(value)
}

function isPositiveSatisfaction(value: unknown): boolean {
  return ['excelente', 'bom', 'positivo'].includes(String(value ?? '').trim().toLowerCase())
}

function isYes(value: unknown): boolean {
  return ['sim', 's', 'true', '1'].includes(String(value ?? '').trim().toLowerCase())
}

function isSameCompetencia(value: unknown, competencia: string): boolean {
  return String(value ?? '').slice(0, 7) === competencia
}

const DATE_FILTER_COLUMNS = [
  'dt_inicio',
  'dt_final',
  'dt_inicial',
  'dt_triagem',
  'dt_inicio_auditor',
  'dt_final_auditor',
  'dt_inicio_real',
  'dt_final_real',
]
const NUMERIC_FILTER_COLUMNS = [
  'nc',
  'extensao_km',
  'm',
  'contratado',
  'medido',
  'medicao',
  'horas_pendente_cliente',
  'horas_indisp_auditor',
  'horas_indisp_real',
]
const DURATION_SORT_COLUMNS = ['duracao_em_dias', 'duracao_em_dias_auditor']
const SELECT_FILTER_COLUMNS = [
  'avaliacao',
  'status_satisfacao',
  'status_inventario',
  'status_atendimento',
  'conta_ta',
  'conta_tf',
  'reaberto',
]

type TableFilterKind = 'text' | 'month' | 'date' | 'number' | 'select'

function getFilterKind(_cod: string, col: string): TableFilterKind {
  if (col === 'competencia_referencia') return 'month'
  if (DATE_FILTER_COLUMNS.includes(col)) return 'date'
  if (NUMERIC_FILTER_COLUMNS.includes(col)) return 'number'
  if (SELECT_FILTER_COLUMNS.includes(col)) return 'select'
  return 'text'
}

function getFilterPlaceholder(cod: string, col: string): string {
  const kind = getFilterKind(cod, col)
  if (kind === 'month') return 'mês'
  if (kind === 'date') return 'data'
  if (kind === 'number') return NUMERIC_FILTER_COLUMNS.includes(col) ? 'mín.' : 'número'
  if (kind === 'select') return 'todos'
  if (col === 'host') return 'host'
  if (col === 'trigger_desc') return 'evento'
  if (col === 'ticket_id') return 'ticket'
  if (col === 'ref_externa') return 'referência'
  return 'filtrar…'
}

function getFilterMinWidth(cod: string, col: string): number {
  const kind = getFilterKind(cod, col)
  if (kind === 'month') return 108
  if (kind === 'date') return 118
  if (kind === 'number') return 86
  if (kind === 'select') return 112
  if (isAvailabilityKpi(cod) && col === 'trigger_desc') return 220
  if (isAvailabilityKpi(cod) && col === 'host') return 130
  return 60
}

function normalizeFilterValue(value: unknown): string {
  return fmtCell(value).trim().toLowerCase()
}

function parseDateValue(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  const raw = String(value ?? '').trim()
  if (!raw) return 0

  const iso = Date.parse(raw)
  if (!Number.isNaN(iso)) return iso

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (br) {
    const [, d, m, y, hh = '00', mm = '00', ss = '00'] = br
    const fullYear = y.length === 2 ? `20${y}` : y
    return new Date(Number(fullYear), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)).getTime()
  }

  return 0
}

function parseDurationValue(value: unknown): number {
  const raw = String(value ?? '').toLowerCase()
  const days = Number(raw.match(/(\d+(?:[.,]\d+)?)\s*d/)?.[1]?.replace(',', '.') ?? 0)
  const hours = Number(raw.match(/(\d+(?:[.,]\d+)?)\s*h/)?.[1]?.replace(',', '.') ?? 0)
  const minutes = Number(raw.match(/(\d+(?:[.,]\d+)?)\s*m/)?.[1]?.replace(',', '.') ?? 0)
  const total = days * 1440 + hours * 60 + minutes
  return total > 0 ? total : parseNum(value)
}

function getSortComparable(value: unknown, col: string, cod: string): string | number {
  const kind = getFilterKind(cod, col)
  if (kind === 'number') return parseNum(value)
  if (kind === 'date') return parseDateValue(value)
  if (kind === 'month') return parseDateValue(`${String(value ?? '').slice(0, 7)}-01`)
  if (DURATION_SORT_COLUMNS.includes(col)) return parseDurationValue(value)
  return fmtCell(value).trim().toLowerCase()
}

function compareDetailValues(a: unknown, b: unknown, col: string, cod: string): number {
  const left = getSortComparable(a, col, cod)
  const right = getSortComparable(b, col, cod)

  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), 'pt-BR', { numeric: true, sensitivity: 'base' })
}

function getSelectFilterOptions(
  rows: Record<string, unknown>[],
  col: string,
  cod: string,
  competencia: string,
): string[] {
  const baseOptions: Record<string, string[]> = {
    status_inventario: ['Aprovado', 'Não aprovado'],
    status_satisfacao: ['Positivo', 'Negativo'],
    conta_ta: ['Sim', 'Não'],
    conta_tf: ['Sim', 'Não'],
    reaberto: ['Sim', 'Não'],
  }

  const found = new Map<string, string>()
  for (const row of rows) {
    const value = fmtCell(getDetailCellValue(row, col, cod, competencia)).trim()
    if (!value || value === '—') continue
    const key = value.toLowerCase()
    if (!found.has(key)) found.set(key, value)
  }

  const options = [...(baseOptions[col] ?? []), ...found.values()]
  return [...new Map(options.map((option) => [option.toLowerCase(), option])).values()]
}

function matchesColumnFilter(value: unknown, filter: string, col: string, cod: string): boolean {
  const normalizedFilter = filter.trim().toLowerCase()
  if (!normalizedFilter) return true

  const kind = getFilterKind(cod, col)

  if (kind === 'month') {
    return String(value ?? '').slice(0, 7) === normalizedFilter
  }

  if (kind === 'date') {
    const raw = String(value ?? '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedFilter)) return raw.slice(0, 10) === normalizedFilter
  }

  if (kind === 'number') {
    return parseNum(value) >= parseNum(normalizedFilter)
  }

  if (kind === 'select') {
    return normalizeFilterValue(value) === normalizedFilter
  }

  const raw = String(value ?? '').toLowerCase()
  const displayed = fmtCell(value).toLowerCase()
  return raw.includes(normalizedFilter) || displayed.includes(normalizedFilter)
}

function getDetailCellValue(row: Record<string, unknown>, key: string, cod: string, competencia: string): unknown {
  if (isInventoryBandwidthKpi(cod)) {
    const host = String(row.host ?? row.Host ?? row.Detalhamento ?? '')
    const contratado = row.contratado ?? row.mbps_comprometido ?? (cod === '03' ? 30 : 45)
    const medido = row.medido ?? row.Medicao ?? (cod === '03' ? 30 : row.mbps_comprometido ?? 45)

    switch (key) {
      case 'host':
        return host
      case 'ref_externa':
        return row.Ref_Externa ?? row.ref_externa ?? row.Texto_05 ?? hostToRefExterna(host)
      case 'contratado':
        return fmtMbps(contratado)
      case 'medido':
        return fmtMbps(medido)
      case 'status_inventario':
        return parseNum(contratado) === parseNum(medido) ? 'Aprovado' : 'Não aprovado'
      default:
        return row[key]
    }
  }

  if (isSatisfactionKpi(cod)) {
    const avaliacao = row.Avaliacao ?? row.avaliacao
    switch (key) {
      case 'competencia_referencia':
        return row.competencia_referencia ?? competencia
      case 'ticket_id':
        return row.Ticket_ID ?? row.ticket_id
      case 'host':
        return row.Cliente ?? row.host
      case 'ref_externa':
        return row.Ref_Externa ?? row.ref_externa ?? row.cod_ref_externa
      case 'avaliacao':
        return avaliacao
      case 'status_satisfacao':
        return row.Status ?? row.status ?? (isPositiveSatisfaction(avaliacao) ? 'Positivo' : 'Negativo')
      case 'dt_inicial':
        return row.DT_Abertura ?? row.dt_abertura
      case 'dt_final':
        return row.DT_Resolvido ?? row.dt_resolvido
      case 'duracao_em_dias':
        return row.Duracao_em_Dias ?? row.duracao_em_dias
      default:
        return row[key]
    }
  }

  if (isResponseTimeKpi(cod)) {
    switch (key) {
      case 'competencia_referencia':
        return row.competencia_referencia ?? competencia
      case 'ticket_id':
        return row.Ticket_ID ?? row.ticket_id
      case 'host':
        return row.Cliente ?? row.host
      case 'ref_externa':
        return row.Ref_Externa ?? row.ref_externa ?? row.cod_ref_externa
      case 'dt_inicial':
        return row.DT_Abertura ?? row.dt_abertura
      case 'dt_triagem':
        return row.DT_Triagem ?? row.dt_triagem
      case 'medicao':
        return row.Medicao ?? row.medicao
      case 'duracao_em_dias':
        return row.Duracao_em_Dias ?? row.duracao_em_dias
      default:
        return row[key]
    }
  }

  if (isSolutionTimeKpi(cod)) {
    const medicao = row.Medicao ?? row.medicao
    const horasPendente = row.Horas_Pendente_Cliente ?? row.horas_pendente_cliente
    switch (key) {
      case 'competencia_referencia':
        return row.competencia_referencia ?? competencia
      case 'ticket_id':
        return row.Ticket_ID ?? row.ticket_id
      case 'host':
        return row.Cliente ?? row.host
      case 'ref_externa':
        return row.Ref_Externa ?? row.ref_externa ?? row.cod_ref_externa
      case 'dt_inicial':
        return row.DT_Abertura ?? row.dt_abertura
      case 'dt_final':
        return row.DT_Resolvido ?? row.dt_resolvido
      case 'medicao':
        return fmtTotal(parseNum(medicao))
      case 'horas_pendente_cliente':
        return fmtTotal(parseNum(horasPendente))
      case 'duracao_em_dias':
        return row.Duracao_em_Dias ?? row.duracao_em_dias
      default:
        return row[key]
    }
  }

  if (isEffectivenessKpi(cod)) {
    const dtAbertura = row.DT_Abertura ?? row.dt_abertura
    const dtResolvido = row.DT_Resolvido ?? row.dt_resolvido
    switch (key) {
      case 'competencia_referencia':
        return row.competencia_referencia ?? competencia
      case 'ticket_id':
        return row.Ticket_ID ?? row.ticket_id
      case 'host':
        return row.Cliente ?? row.host
      case 'ref_externa':
        return row.Ref_Externa ?? row.ref_externa ?? row.cod_ref_externa
      case 'dt_inicial':
        return dtAbertura
      case 'dt_final':
        return dtResolvido
      case 'status_atendimento':
        return row.Status ?? row.status
      case 'conta_ta':
        return isSameCompetencia(dtAbertura, competencia) ? 'Sim' : 'Não'
      case 'conta_tf':
        return isSameCompetencia(dtResolvido, competencia) ? 'Sim' : 'Não'
      case 'duracao_em_dias':
        return row.Duracao_em_Dias ?? row.duracao_em_dias
      default:
        return row[key]
    }
  }

  if (isReopenKpi(cod)) {
    switch (key) {
      case 'competencia_referencia':
        return row.competencia_referencia ?? competencia
      case 'ticket_id':
        return row.Ticket_ID ?? row.ticket_id
      case 'host':
        return row.Cliente ?? row.host
      case 'ref_externa':
        return row.Ref_Externa ?? row.ref_externa ?? row.cod_ref_externa
      case 'dt_inicial':
        return row.DT_Abertura ?? row.dt_abertura
      case 'dt_final':
        return row.DT_Resolvido ?? row.dt_resolvido
      case 'reaberto':
        return isYes(row.Reaberto ?? row.houve_reabertura ?? row.reaberto) ? 'Sim' : 'Não'
      case 'duracao_em_dias':
        return row.Duracao_em_Dias ?? row.duracao_em_dias
      default:
        return row[key]
    }
  }

  if (!isAvailabilityKpi(cod)) return row[key]

  const horasReal = row.Horas_Indisp_Real ?? row.horas_indisp_real ?? row.horas_indisponivel
  const horasAuditor = row.Horas_Indisp_Auditor ?? row.horas_indisp_auditor ?? row.horas_indisponivel

  switch (key) {
    case 'competencia_referencia':
      return row.competencia_referencia ?? competencia
    case 'host':
      return row.Detalhamento ?? row.Host ?? row.host
    case 'trigger_desc':
      return row.Texto_01 ?? row.Evento ?? row.trigger_desc
    case 'dt_inicio_real':
      return row.DT_inicial_real ?? row.Inicio_Real ?? row.DT_inicial
    case 'dt_final_real':
      return row.DT_final_real ?? row.Fim_Real ?? row.DT_final
    case 'horas_indisp_real':
      return horasReal
    case 'duracao_em_dias':
      return fmtDurationFromHours(horasReal)
    case 'dt_inicio_auditor':
      return row.DT_inicial_Auditor ?? row.Inicio_Auditor ?? row.DT_inicial
    case 'dt_final_auditor':
      return row.DT_final_Auditor ?? row.Fim_Auditor ?? row.DT_final
    case 'horas_indisp_auditor':
      return horasAuditor
    case 'duracao_em_dias_auditor':
      return fmtDurationFromHours(horasAuditor)
    default:
      return row[key]
  }
}

const OFFENDERS_LIMIT = 5

function computeTopOffenders(linhas: Record<string, unknown>[], cod: string, competencia: string): { data: { name: string; value: number }[]; groupKey: string | null } {
  if (linhas.length === 0) return { data: [], groupKey: null }

  if (isSatisfactionKpi(cod)) {
    const offenders = new Map<string, number>()
    for (const row of linhas) {
      if (isPositiveSatisfaction(getDetailCellValue(row, 'avaliacao', cod, competencia))) continue
      const host = String(getDetailCellValue(row, 'host', cod, competencia) ?? 'N/A')
      offenders.set(host, (offenders.get(host) ?? 0) + 1)
    }

    return {
      groupKey: 'host',
      data: [...offenders.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, OFFENDERS_LIMIT),
    }
  }

  if (isAvailabilityKpi(cod)) {
    const byHost = new Map<string, number>()
    for (const row of linhas) {
      const host = String(getDetailCellValue(row, 'host', cod, competencia) ?? 'N/A')
      const horasAuditor = parseNum(getDetailCellValue(row, 'horas_indisp_auditor', cod, competencia))
      byHost.set(host, (byHost.get(host) ?? 0) + horasAuditor)
    }

    return {
      groupKey: 'host',
      data: [...byHost.entries()]
        .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, OFFENDERS_LIMIT),
    }
  }

  if (isSolutionTimeKpi(cod)) {
    const byHost = new Map<string, Record<string, unknown>[]>()
    for (const row of linhas) {
      const host = String(getDetailCellValue(row, 'host', cod, competencia) ?? 'N/A')
      if (!byHost.has(host)) byHost.set(host, [])
      byHost.get(host)!.push(row)
    }

    return {
      groupKey: 'host',
      data: [...byHost.entries()]
        .map(([name, rows]) => ({
          name,
          value: parseFloat((rows.reduce((s, r) => s + parseNum(getDetailCellValue(r, 'medicao', cod, competencia)), 0) / rows.length).toFixed(2)),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, OFFENDERS_LIMIT),
    }
  }

  if (isEffectivenessKpi(cod)) {
    const byHost = new Map<string, number>()
    for (const row of linhas) {
      const host = String(getDetailCellValue(row, 'host', cod, competencia) ?? 'N/A')
      byHost.set(host, (byHost.get(host) ?? 0) + 1)
    }

    return {
      groupKey: 'host',
      data: [...byHost.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, OFFENDERS_LIMIT),
    }
  }

  if (isReopenKpi(cod)) {
    const byHost = new Map<string, number>()
    for (const row of linhas) {
      if (!isYes(getDetailCellValue(row, 'reaberto', cod, competencia))) continue
      const host = String(getDetailCellValue(row, 'host', cod, competencia) ?? 'N/A')
      byHost.set(host, (byHost.get(host) ?? 0) + 1)
    }

    return {
      groupKey: 'host',
      data: [...byHost.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, OFFENDERS_LIMIT),
    }
  }

  const row0 = linhas[0]
  const groupKey = 'Texto_01' in row0
    ? 'Texto_01'
    : 'Host' in row0 ? 'Host'
    : 'Cliente' in row0 ? 'Cliente'
    : 'host' in row0 ? 'host'
    : null
  if (!groupKey) return { data: [], groupKey: null }

  const n = parseInt(cod)
  type AggFn = (rows: Record<string, unknown>[]) => number
  let aggFn: AggFn
  let label = 'Contagem'

  if ([12, 16, 20, 24, 28].includes(n)) {
    aggFn = rows => rows.reduce((s, r) => s + parseNum(r['Medicao']), 0) / rows.length
    label = 'TR Médio (h)'
  } else if ([13, 17, 21, 25, 29].includes(n)) {
    aggFn = rows => rows.reduce((s, r) => s + parseNum(r['Medicao']), 0) / rows.length
    label = 'TS Médio (h)'
  } else if ([9, 10, 11].includes(n)) {
    aggFn = rows => {
      const bad = rows.filter(r => !['Excelente', 'Bom'].includes(String(r['Avaliacao'] ?? '')))
      return rows.length > 0 ? (bad.length / rows.length) * 100 : 0
    }
    label = '% Insatisfeitos'
  } else if ([4, 5, 7, 8].includes(n)) {
    aggFn = rows => rows.reduce((s, r) => s + parseNum(r['Horas_Indisp_Auditor']), 0)
    label = 'Horas Indisp. (h)'
  } else {
    aggFn = rows => rows.length
    label = 'Registros'
  }

  const map = new Map<string, Record<string, unknown>[]>()
  for (const r of linhas) {
    const k = String(r[groupKey] || 'N/A')
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }

  void label
  return {
    groupKey,
    data: [...map.entries()]
      .map(([name, rows]) => ({ name, value: parseFloat(aggFn(rows).toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, OFFENDERS_LIMIT),
  }
}

function computeDonut(linhas: Record<string, unknown>[]): { name: string; value: number }[] {
  const map = new Map<string, number>()
  for (const r of linhas) {
    const k = String(r['Avaliacao'] || 'Sem avaliação')
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

function renderStatusBadge(value: unknown, positiveLabels: string[]) {
  const normalized = String(value ?? '').trim().toLowerCase()
  const positive = positiveLabels.includes(normalized)
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
        positive
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
      }`}
    >
      {String(value)}
    </span>
  )
}

function renderDetailCell(value: unknown, colKey: string) {
  if (colKey === 'status_inventario') return renderStatusBadge(value, ['aprovado'])
  if (colKey === 'status_satisfacao') return renderStatusBadge(value, ['positivo'])
  if (colKey === 'status_atendimento') return renderStatusBadge(value, ['finalizado'])
  if (['conta_ta', 'conta_tf', 'reaberto'].includes(colKey)) return renderStatusBadge(value, ['sim'])
  return fmtCell(value)
}

export function IndicadorDetalheContent({ cod: codProp, modal = false, onClose, competenciaProp, hasPrev, hasNext, position, onPrev, onNext }: IndicadorDetalheContentProps) {
  const params = useParams<{ cod: string }>()
  const cod = codProp ?? params.cod
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryCompetencia = searchParams.get('competencia') ?? undefined
  const { competencia: competenciaStore, setCompetencia } = useFilterStore()
  const isDark = useThemeStore((state) => state.theme === 'dark')
  const competencia = competenciaProp ?? queryCompetencia ?? (competenciaStore || yyyyMM())

  const [detail, setDetail] = useState<KpiDetail | null>(null)
  const [historico, setHistorico] = useState<KpiHistoricoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [chartFilter, setChartFilter] = useState<{ source: 'topOffenders' | 'donut'; col: string; val: string } | null>(null)
  const [availabilityView, setAvailabilityView] = useState<AvailabilityView>('auditor')
  const [effectivenessView, setEffectivenessView] = useState<EffectivenessView>('ta')
  const [reopenView, setReopenView] = useState<ReopenView>('all')
  const [outroMes, setOutroMes] = useState(competencia)
  const [showOutro, setShowOutro] = useState(false)
  const [tableFullscreen, setTableFullscreen] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const brushHistPosRef = useRef({ start: 0, end: 0 })
  const [brushHistKey, setBrushHistKey] = useState(0)

  useEffect(() => {
    const s = Math.max(0, historico.length - 12)
    const e = Math.max(0, historico.length - 1)
    brushHistPosRef.current = { start: s, end: e }
    setBrushHistKey(k => k + 1)
  }, [historico.length])

  useEffect(() => {
    setOutroMes(competencia)
  }, [competencia])

  useEffect(() => {
    if (!cod) return
    const cacheKey = `${cod}|${competencia}|kpi_agg_test`
    const cached = detailCache.get(cacheKey)

    setCompetencia(competencia)
    setPage(1)
    setFilters({})
    setSortConfig(null)
    setChartFilter(null)
    setEffectivenessView('ta')
    setReopenView('all')
    setTableFullscreen(false)

    if (cached) {
      setDetail(cached.detail)
      setHistorico(cached.historico)
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([fetchIndicador(cod, competencia), fetchHistorico(cod, 24)])
      .then(([d, h]) => {
        const historicoReverso = [...h].reverse()
        detailCache.set(cacheKey, { detail: d, historico: historicoReverso })
        setDetail(d)
        setHistorico(historicoReverso)
      })
      .catch(() => toast.error('Erro ao carregar indicador'))
      .finally(() => setLoading(false))
  }, [cod, competencia, setCompetencia])

  const tableCols = useMemo<DetailColumn[]>(() => {
    if (!detail || detail.linhas.length === 0) return []
    if (isAvailabilityKpi(detail.cod)) return getAvailabilityColumns(availabilityView)
    if (isSolutionTimeKpi(detail.cod)) return SOLUTION_TIME_COLUMNS
    if (isEffectivenessKpi(detail.cod)) return EFFECTIVENESS_COLUMNS
    if (isReopenKpi(detail.cod)) return REOPEN_COLUMNS
    return KPI_DETAIL_COLUMNS[detail.cod] ?? Object.keys(detail.linhas[0]).map((key) => ({ key, label: key }))
  }, [detail, availabilityView])
  const cols = useMemo(() => tableCols.map((col) => col.key), [tableCols])

  const viewRows = useMemo(() => {
    if (!detail) return []
    if (isReopenKpi(detail.cod)) {
      return detail.linhas.filter(row => {
        const reopened = isYes(getDetailCellValue(row, 'reaberto', detail.cod, competencia))
        if (reopenView === 'reopened') return reopened
        if (reopenView === 'not_reopened') return !reopened
        return true
      })
    }
    if (!isEffectivenessKpi(detail.cod)) return detail.linhas

    return detail.linhas.filter(row => {
      const isTa = isSameCompetencia(getDetailCellValue(row, 'dt_inicial', detail.cod, competencia), competencia)
      const isTf = isSameCompetencia(getDetailCellValue(row, 'dt_final', detail.cod, competencia), competencia)

      if (effectivenessView === 'ta') return isTa
      if (effectivenessView === 'tf_sem_ta') return isTf && !isTa
      return isTf
    })
  }, [detail, competencia, effectivenessView, reopenView])

  const effectivenessCounts = useMemo(() => {
    if (!detail || !isEffectivenessKpi(detail.cod)) return null
    return detail.linhas.reduce<{ ta: number; tf: number; tfSemTa: number }>(
      (acc, row) => {
        const isTa = isSameCompetencia(getDetailCellValue(row, 'dt_inicial', detail.cod, competencia), competencia)
        const isTf = isSameCompetencia(getDetailCellValue(row, 'dt_final', detail.cod, competencia), competencia)

        if (isTa) acc.ta += 1
        if (isTf) acc.tf += 1
        if (isTf && !isTa) acc.tfSemTa += 1
        return acc
      },
      { ta: 0, tf: 0, tfSemTa: 0 },
    )
  }, [detail, competencia])

  const reopenCounts = useMemo(() => {
    if (!detail || !isReopenKpi(detail.cod)) return null
    return detail.linhas.reduce<{ total: number; reopened: number; notReopened: number }>(
      (acc, row) => {
        const reopened = isYes(getDetailCellValue(row, 'reaberto', detail.cod, competencia))
        acc.total += 1
        if (reopened) acc.reopened += 1
        else acc.notReopened += 1
        return acc
      },
      { total: 0, reopened: 0, notReopened: 0 },
    )
  }, [detail, competencia])


  const filtered = useMemo(() => {
    if (!detail) return []
    return viewRows.filter(row => {
      const passesText = cols.every(col => {
        const f = filters[col]
        return matchesColumnFilter(getDetailCellValue(row, col, detail.cod, competencia), f ?? '', col, detail.cod)
      })
      if (!passesText) return false
      if (chartFilter) return String(getDetailCellValue(row, chartFilter.col, detail.cod, competencia) ?? '') === chartFilter.val
      return true
    })
  }, [detail, viewRows, filters, cols, chartFilter, competencia])

  const selectFilterOptions = useMemo(() => {
    if (!detail) return {}
    return Object.fromEntries(
      tableCols
        .filter((col) => getFilterKind(detail.cod, col.key) === 'select')
        .map((col) => [col.key, getSelectFilterOptions(viewRows, col.key, detail.cod, competencia)])
    ) as Record<string, string[]>
  }, [detail, tableCols, viewRows, competencia])

  const sortedRows = useMemo(() => {
    if (!detail || !sortConfig) return filtered
    const direction = sortConfig.direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const left = getDetailCellValue(a, sortConfig.col, detail.cod, competencia)
      const right = getDetailCellValue(b, sortConfig.col, detail.cod, competencia)
      return compareDetailValues(left, right, sortConfig.col, detail.cod) * direction
    })
  }, [detail, filtered, sortConfig, competencia])

  const { data: topOffenders, groupKey: topOffendersGroupKey } = useMemo(
    () => detail ? computeTopOffenders(viewRows, detail.cod, competencia) : { data: [], groupKey: null },
    [detail, viewRows, competencia]
  )
  const donutData = useMemo(() =>
    detail && SAT_KPIS.includes(detail.cod) ? computeDonut(detail.linhas) : [],
    [detail]
  )
  const satField = detail && SAT_KPIS.includes(detail.cod) ? 'Avaliacao' : null

  const rowsPerPage = tableFullscreen ? 20 : PER_PAGE
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const pageRows = sortedRows.slice((page - 1) * rowsPerPage, page * rowsPerPage)
  const hasActiveFilter = Object.values(filters).some(v => v.length > 0) || chartFilter !== null
  const tableTotals = useMemo<Record<string, string> | null>(() => {
    if (detail?.cod === '01') {
      const extensaoKm = filtered.reduce((sum, row) => sum + parseNum(row.extensao_km), 0)
      const naoConformidade = filtered.reduce((sum, row) => sum + parseNum(row.nc), 0)

      const totals: Record<string, string> = {
        extensao_km: fmtTotal(extensaoKm),
        m: fmtTotal(Math.ceil(extensaoKm / 10)),
        nc: fmtTotal(naoConformidade),
      }
      return totals
    }

    if (detail && isAvailabilityKpi(detail.cod)) {
      const totalKey = availabilityView === 'auditor' ? 'horas_indisp_auditor' : 'horas_indisp_real'
      const horas = filtered.reduce((sum, row) => sum + parseNum(getDetailCellValue(row, totalKey, detail.cod, competencia)), 0)

      const totals: Record<string, string> = {
        [totalKey]: fmtTotal(horas),
      }
      return totals
    }

    if (detail && isInventoryBandwidthKpi(detail.cod)) {
      const approved = filtered.filter((row) =>
        getDetailCellValue(row, 'status_inventario', detail.cod, competencia) === 'Aprovado'
      ).length
      const rejected = filtered.length - approved

      return {
        host: `${filtered.length.toLocaleString('pt-BR')} host${filtered.length === 1 ? '' : 's'}`,
        status_inventario: `${approved.toLocaleString('pt-BR')} aprovado${approved === 1 ? '' : 's'} · ${rejected.toLocaleString('pt-BR')} não aprovado${rejected === 1 ? '' : 's'}`,
      }
    }

    if (detail && isSatisfactionKpi(detail.cod)) {
      const positivos = filtered.filter((row) =>
        isPositiveSatisfaction(getDetailCellValue(row, 'avaliacao', detail.cod, competencia))
      ).length
      const negativos = filtered.length - positivos

      return {
        ticket_id: `${filtered.length.toLocaleString('pt-BR')} ticket${filtered.length === 1 ? '' : 's'}`,
        status_satisfacao: `${positivos.toLocaleString('pt-BR')} positivo${positivos === 1 ? '' : 's'} · ${negativos.toLocaleString('pt-BR')} negativo${negativos === 1 ? '' : 's'}`,
      }
    }

    if (detail && isResponseTimeKpi(detail.cod)) {
      const medicao = filtered.reduce((sum, row) => sum + parseNum(getDetailCellValue(row, 'medicao', detail.cod, competencia)), 0)

      return {
        ticket_id: `${filtered.length.toLocaleString('pt-BR')} ticket${filtered.length === 1 ? '' : 's'}`,
        medicao: fmtTotal(medicao),
      }
    }

    if (detail && isSolutionTimeKpi(detail.cod)) {
      const medicao = filtered.reduce((sum, row) => sum + parseNum(getDetailCellValue(row, 'medicao', detail.cod, competencia)), 0)
      const horasPendente = filtered.reduce((sum, row) => sum + parseNum(getDetailCellValue(row, 'horas_pendente_cliente', detail.cod, competencia)), 0)
      const media = filtered.length > 0 ? medicao / filtered.length : 0

      return {
        ticket_id: `${filtered.length.toLocaleString('pt-BR')} ticket${filtered.length === 1 ? '' : 's'}`,
        medicao: `Média: ${fmtTotal(media)}`,
        horas_pendente_cliente: fmtTotal(horasPendente),
      }
    }

    if (detail && isEffectivenessKpi(detail.cod)) {
      const ta = filtered.filter((row) =>
        isSameCompetencia(getDetailCellValue(row, 'dt_inicial', detail.cod, competencia), competencia)
      ).length
      const tf = filtered.filter((row) =>
        isSameCompetencia(getDetailCellValue(row, 'dt_final', detail.cod, competencia), competencia)
      ).length

      return {
        ticket_id: `${filtered.length.toLocaleString('pt-BR')} ticket${filtered.length === 1 ? '' : 's'}`,
        conta_ta: `${ta.toLocaleString('pt-BR')} TA`,
        conta_tf: `${tf.toLocaleString('pt-BR')} TF`,
      }
    }

    if (detail && isReopenKpi(detail.cod)) {
      const reopened = filtered.filter((row) =>
        isYes(getDetailCellValue(row, 'reaberto', detail.cod, competencia))
      ).length

      return {
        ticket_id: `${filtered.length.toLocaleString('pt-BR')} ticket${filtered.length === 1 ? '' : 's'}`,
        reaberto: `${reopened.toLocaleString('pt-BR')} reaberto${reopened === 1 ? '' : 's'}`,
      }
    }

    return null
  }, [detail, filtered, competencia, availabilityView])

  const setFilter = (col: string, val: string) => {
    setFilters(prev => ({ ...prev, [col]: val }))
    setPage(1)
  }
  const handleSort = (col: string) => {
    setSortConfig(prev => {
      if (prev?.col !== col) return { col, direction: 'asc' }
      if (prev.direction === 'asc') return { col, direction: 'desc' }
      return null
    })
    setPage(1)
  }
  const clearFilters = () => { setFilters({}); setChartFilter(null); setPage(1) }

  const goTo = (comp: string) => {
    setCompetencia(comp)
    if (modal) return
    navigate(`/indicador/${cod}?competencia=${comp}`)
  }

  if (loading) {
    return <DetailSkeleton />
  }

  if (!detail) {
    return <p className="text-red-600 p-4">Indicador não encontrado.</p>
  }

  const statusColor = STATUS_COLOR[detail.status] ?? STATUS_COLOR.pending
  const unit = /\d+h/.test(detail.meta) ? 'h' : detail.meta.includes('%') ? '%' : ''
  const metaNum = parseFloat(detail.meta.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0
  const valorDisplayNum = detail.valor_atual !== null && unit === '%'
    ? Math.floor(detail.valor_atual * 100) / 100
    : detail.valor_atual
  const valorDisplay = valorDisplayNum !== null ? valorDisplayNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + unit : '--'
  const titulo = `${parseInt(detail.cod)}. ${detail.nome} — ${detail.sigla}`
  const isEffectiveness = isEffectivenessKpi(detail.cod)
  const isReopen = isReopenKpi(detail.cod)
  const eaZeroTA =
    isEffectiveness &&
    detail.valor_atual === null &&
    effectivenessCounts !== null &&
    effectivenessCounts.ta === 0 &&
    effectivenessCounts.tf > 0
  const totalRegistros = isReopen || isEffectiveness ? viewRows.length : detail.linhas.length
  const totalRegistrosFiltro = isReopen || isEffectivenessKpi(detail.cod) ? viewRows.length : detail.linhas.length

  const higherIsBetter = detail.meta.startsWith('≥') || detail.meta.startsWith('>')
  const barWidth = detail.valor_atual !== null
    ? higherIsBetter
      ? Math.min(detail.valor_atual, 100)
      : metaNum > 0 ? Math.min((detail.valor_atual / metaNum) * 100, 100) : 50
    : 0

  const StatusIcon = () => {
    if (detail.status === 'ok')      return <CheckCircle2 size={28} color={statusColor} />
    if (detail.status === 'pending') return <CircleHelp   size={28} color={statusColor} />
    return <CircleAlert size={28} color={statusColor} />
  }

  const btnDateStyle = (active: boolean, r?: string, overlap = false): React.CSSProperties => ({
    appearance: 'none',
    padding: '5px 12px',
    fontSize: '11px',
    fontWeight: 600,
    border: `1px solid ${active ? PRIMARY_BLUE : 'var(--segmented-inactive-border)'}`,
    background: active ? PRIMARY_BLUE : 'var(--segmented-inactive-bg)',
    color: active ? 'white' : 'var(--segmented-inactive-text)',
    outline: 'none',
    boxShadow: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ...(r ? { borderRadius: r } : {}),
    ...(overlap ? { marginLeft: '-1px' } : {}),
  })

  const yAxisWidth = topOffenders.length > 0
    ? Math.min(Math.max(...topOffenders.map(d => d.name.length)) * 6, 155)
    : 90

  const currentMes = yyyyMM()
  const anteriorMes = yyyyMM(-1)
  const periodoAtual = competencia === anteriorMes ? 'anterior'
    : !competencia || competencia === currentMes ? 'atual'
    : 'outro'
  const surfaceBg = isDark ? '#111827' : 'white'
  const tableHeaderBg = isDark ? '#0f172a' : '#f1f5f9'
  const tableFilterBg = isDark ? '#111827' : 'white'
  const tableRowEvenBg = isDark ? '#111827' : 'white'
  const tableRowOddBg = isDark ? '#0f172a' : '#fafafa'
  const tableRowHoverBg = isDark ? '#172033' : '#f0f9ff'
  const tableBorder = isDark ? '#334155' : '#e2e8f0'
  const tableStrongBorder = isDark ? '#475569' : '#cbd5e1'
  const tableText = isDark ? '#cbd5e1' : '#334155'
  const tableHeadText = isDark ? '#e2e8f0' : '#475569'
  const chartTick = isDark ? '#94a3b8' : '#64748b'
  const chartText = isDark ? '#e2e8f0' : '#334155'
  const tooltipStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#0f172a' : 'white',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: 8,
    color: chartText,
    fontSize: 11,
    boxShadow: isDark ? '0 14px 30px rgba(0,0,0,.35)' : '0 10px 24px rgba(15,23,42,.12)',
  }
  const tableMaxHeight = isAvailabilityKpi(detail.cod)
    ? 'max(260px, calc(100vh - 360px))'
    : isEffectivenessKpi(detail.cod)
      ? 'calc(100vh - 390px)'
      : 'calc(100vh - 360px)'
  const tableMinWidth = isEffectivenessKpi(detail.cod) ? 1120 : undefined
  const tableEffectiveMinWidth = tableMinWidth
  const tableCellWhiteSpace = 'nowrap'
  const tableWordBreak = 'normal'

  const dateControls = (
    <>
      <div className="flex rounded shadow-sm">
        <button type="button" className="focus:outline-none focus-visible:outline-none" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.currentTarget.blur(); setShowOutro(false); goTo(anteriorMes) }} style={btnDateStyle(periodoAtual === 'anterior' && !showOutro, '4px 0 0 4px')}>Mês Anterior</button>
        <button type="button" className="focus:outline-none focus-visible:outline-none" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.currentTarget.blur(); setShowOutro(false); goTo(currentMes) }}  style={btnDateStyle(periodoAtual === 'atual' && !showOutro, undefined, true)}>Mês Atual</button>
        <button type="button" className="focus:outline-none focus-visible:outline-none" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.currentTarget.blur(); setShowOutro(v => !v) }} style={btnDateStyle(periodoAtual === 'outro' || showOutro, '0 4px 4px 0', true)}>Outro</button>
      </div>
      {(showOutro || periodoAtual === 'outro') && (
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-600">
          <input
            type="month"
            value={outroMes}
            onChange={e => { setOutroMes(e.target.value); goTo(e.target.value) }}
            className="text-[11px] border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none"
          />
        </div>
      )}
    </>
  )

  const header = modal ? (
    <div className="rounded-t-xl border-b border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900 px-5 py-2.5 flex-shrink-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight truncate" style={{ color: PRIMARY_BLUE }} title={titulo}>{titulo}</h1>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Detalhamento</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {dateControls}
          {(onPrev || onNext) && (
            <>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500"
                title="Indicador anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono w-14 text-center">{position}</span>
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500"
                title="Próximo indicador"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
          {onClose && (
            <>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-2.5 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <Breadcrumbs items={[{ label: 'Menu Principal', to: '/menu' }, { label: titulo }]} />
        <div className="flex items-center gap-3 flex-wrap">
          {dateControls}
          <HeaderActions />
        </div>
      </div>
    </div>
  )

  const body = (
    <>
      {/* Summary row — 3 cards (grid-cols-12) */}
      <div className="grid grid-cols-12 gap-4 mb-6">

        {/* Card 1: Resultado */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 relative overflow-hidden col-span-12 ${hasActiveFilter ? 'md:col-span-5' : 'md:col-span-7'}`}
             style={{ borderLeftColor: PRIMARY_BLUE }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Resultado</p>
              <h2 className="text-3xl font-bold text-slate-700 mt-2" style={{ color: statusColor }}>
                {valorDisplay}
              </h2>
            </div>
            <div className="text-3xl opacity-80"><StatusIcon /></div>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-1000 rounded-full"
              style={{ width: `${barWidth}%`, backgroundColor: statusColor }}
            />
          </div>
          <p className="text-[10px] text-right text-slate-400 mt-1 font-mono">
            Meta: <span>{detail.meta}</span>
          </p>
          {eaZeroTA && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 dark:border-amber-700 dark:bg-amber-900/30">
              <span className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-300"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
              <p className="text-[10px] leading-snug font-medium text-amber-700 dark:text-amber-300">
                {detail.observacao ?? 'Nenhum chamado aberto no período (TA = 0) — percentual não calculável.'}
              </p>
            </div>
          )}
          {modal && isEffectiveness && effectivenessCounts && (
            <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-700">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">TA</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{effectivenessCounts.ta.toLocaleString('pt-BR')}</p>
                </div>
                <p className="mt-0.5 truncate text-[9px] font-medium text-slate-400">Abertos no mês</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">TF</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{effectivenessCounts.tf.toLocaleString('pt-BR')}</p>
                </div>
                <p className="mt-0.5 truncate text-[9px] font-medium text-slate-400">Fechados no mês</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 dark:border-amber-700 dark:bg-amber-900/30">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">Dif.</p>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-200">{effectivenessCounts.tfSemTa.toLocaleString('pt-BR')}</p>
                </div>
                <p className="mt-0.5 truncate text-[9px] font-medium text-amber-600 dark:text-amber-300">TF sem TA</p>
              </div>
            </div>
          )}
          {modal && isReopenKpi(detail.cod) && reopenCounts && (
            <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-700">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Total</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{reopenCounts.total.toLocaleString('pt-BR')}</p>
                </div>
                <p className="mt-0.5 truncate text-[9px] font-medium text-slate-400">Tickets base</p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 dark:border-red-800 dark:bg-red-900/30">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-red-600 dark:text-red-300">Sim</p>
                  <p className="text-sm font-bold text-red-700 dark:text-red-200">{reopenCounts.reopened.toLocaleString('pt-BR')}</p>
                </div>
                <p className="mt-0.5 truncate text-[9px] font-medium text-red-600 dark:text-red-300">Reabertos</p>
              </div>
              <div className="rounded-md border border-green-200 bg-green-50 px-2 py-1.5 dark:border-green-800 dark:bg-green-900/30">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-green-600 dark:text-green-300">Não</p>
                  <p className="text-sm font-bold text-green-700 dark:text-green-200">{reopenCounts.notReopened.toLocaleString('pt-BR')}</p>
                </div>
                <p className="mt-0.5 truncate text-[9px] font-medium text-green-600 dark:text-green-300">Sem reabertura</p>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Total Registros */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-slate-200 col-span-12 ${hasActiveFilter ? 'md:col-span-3' : 'md:col-span-5'}`}>
          <div className="flex justify-between items-center h-full">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                {isEffectiveness || isReopen ? 'Registros da visão' : 'Total Registros'}
              </p>
              <h2 className="text-3xl font-bold text-slate-700 mt-2">{totalRegistros.toLocaleString('pt-BR')}</h2>
              {isEffectiveness && (
                <p className="mt-1 text-[10px] font-semibold text-slate-400">{effectivenessView.toUpperCase()} · {EFFECTIVENESS_VIEW_LABEL[effectivenessView]}</p>
              )}
              {isReopen && (
                <p className="mt-1 text-[10px] font-semibold text-slate-400">{REOPEN_VIEW_LABEL[reopenView]}</p>
              )}
            </div>
            <Database size={40} className="text-slate-100" />
          </div>
        </div>

        {/* Card 3: Filtro ativo (visível apenas quando há filtro) */}
        {hasActiveFilter && (
          <div
            className="bg-blue-50 dark:bg-blue-950/70 rounded-xl border border-blue-200 dark:border-blue-500/70 shadow-sm dark:shadow-blue-950/40 p-4 border-l-4 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/80 transition col-span-12 md:col-span-4"
            style={{ borderLeftColor: PRIMARY_BLUE }}
            onClick={clearFilters}
          >
            <div className="flex justify-between items-start h-full gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-blue-700 dark:text-blue-200 font-bold uppercase flex items-center gap-2">
                  <Filter size={10} /> {chartFilter ? (chartFilter.source === 'topOffenders' ? 'Top 5' : 'Composição') : 'Filtro Ativo'}
                </p>
                {chartFilter && (
                  <p className="text-xs font-bold text-blue-900 dark:text-white mt-1 truncate" title={chartFilter.val}>
                    {chartFilter.val}
                  </p>
                )}
                <p className="text-sm font-bold text-blue-800 dark:text-blue-100 mt-1">
                  {filtered.length} de {totalRegistrosFiltro} registros
                </p>
                <p className="text-[9px] text-blue-600 dark:text-blue-300 mt-1 font-semibold underline">Clique para limpar</p>
              </div>
              <XCircle size={22} className="text-blue-400 dark:text-blue-200 flex-shrink-0 mt-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Tabela + Donut (donut apenas para KPIs 09/10/11) */}
      <div className={`grid gap-4 mb-4 ${SAT_KPIS.includes(detail.cod) ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1'}`}>

        {/* Donut (satisfação) */}
        {SAT_KPIS.includes(detail.cod) && donutData.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-1 flex flex-col" style={{ minHeight: 280 }}>
            <h3 className="font-bold text-slate-600 text-sm border-b border-slate-100 pb-2 mb-2">Composição</h3>
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    style={{ cursor: satField ? 'pointer' : 'default' }}
                    onClick={(entry: { name: string }) => {
                      if (!satField) return
                      setChartFilter(prev =>
                        prev?.col === satField && prev.val === entry.name
                          ? null
                          : { source: 'donut', col: satField, val: entry.name }
                      )
                      setPage(1)
                    }}
                  >
                    {donutData.map((entry, i) => {
                      const isSelected = chartFilter?.col === satField && chartFilter.val === entry.name
                      const isFiltering = chartFilter?.source === 'donut'
                      return (
                        <Cell
                          key={i}
                          fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                          opacity={isFiltering && !isSelected ? 0.3 : 1}
                          stroke={isSelected ? (isDark ? '#f8fafc' : '#1e293b') : 'none'}
                          strokeWidth={isSelected ? 2 : 0}
                        />
                      )
                    })}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: chartText }} />
                  <Tooltip
                    formatter={(v: number) => [`${v} registros`]}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: chartText }}
                    itemStyle={{ color: chartText }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tabela paginada */}
        <div
          className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col ${
            tableFullscreen
              ? 'fixed inset-3 z-[70] sm:inset-5 shadow-2xl'
              : SAT_KPIS.includes(detail.cod) ? 'lg:col-span-4' : ''
          }`}
        >
          <div className="flex justify-between items-center mb-2 flex-shrink-0">
            <h3 className="font-bold text-slate-600 text-sm flex items-center gap-2">
              Registros
              <span
                className="px-2 py-0.5 rounded-full text-xs border font-bold"
                style={{ background: '#EFF6FF', color: PRIMARY_BLUE, borderColor: '#bfdbfe' }}
              >
                {filtered.length}
              </span>
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={downloadingExcel}
                onClick={async () => {
                  const tid = toast.loading('Gerando Excel… aguarde')
                  setDownloadingExcel(true)
                  try {
                    await downloadIndicadorExcel(detail.cod, detail.sigla, competencia)
                    toast.success('Download iniciado', { id: tid })
                  } catch {
                    toast.error('Erro ao gerar Excel', { id: tid })
                  } finally {
                    setDownloadingExcel(false)
                  }
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-blue-950 dark:hover:text-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={13} />
                Baixar relatório em Excel
              </button>
              <button
                type="button"
                onClick={() => setTableFullscreen(v => !v)}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-blue-950 dark:hover:text-blue-200"
                title={tableFullscreen ? 'Sair da tela cheia' : 'Ver tabela em tela cheia'}
              >
                {tableFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {isAvailabilityKpi(detail.cod) && (
            <div className="mb-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-600 dark:text-slate-200">Visão do período de indisponibilidade</div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setAvailabilityView('auditor')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${availabilityView === 'auditor' ? 'bg-empresa-blue text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    Auditor
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityView('real')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${availabilityView === 'real' ? 'bg-empresa-blue text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    Real
                  </button>
                </div>
              </div>
              <p className="leading-snug">{AVAILABILITY_VIEW_DESCRIPTION[availabilityView]}</p>
            </div>
          )}

          {isEffectivenessKpi(detail.cod) && (
            <div className="mb-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-600 dark:text-slate-200">Visão da efetividade</div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => { setEffectivenessView('ta'); setPage(1) }}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${effectivenessView === 'ta' ? 'bg-empresa-blue text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    TA · {effectivenessCounts?.ta.toLocaleString('pt-BR') ?? 0}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEffectivenessView('tf'); setPage(1) }}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${effectivenessView === 'tf' ? 'bg-empresa-blue text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    TF · {effectivenessCounts?.tf.toLocaleString('pt-BR') ?? 0}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEffectivenessView('tf_sem_ta'); setPage(1) }}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${effectivenessView === 'tf_sem_ta' ? 'bg-amber-500 text-white' : 'text-amber-600 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/30'}`}
                  >
                    TF sem TA · {effectivenessCounts?.tfSemTa.toLocaleString('pt-BR') ?? 0}
                  </button>
                </div>
              </div>
              <p className="leading-snug">
                {EFFECTIVENESS_VIEW_LABEL[effectivenessView]}: {EFFECTIVENESS_VIEW_DESCRIPTION[effectivenessView]}
              </p>
            </div>
          )}

          {isReopenKpi(detail.cod) && reopenCounts && (
            <div className="mb-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-600 dark:text-slate-200">Visão de reabertura</div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => { setReopenView('all'); setPage(1) }}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${reopenView === 'all' ? 'bg-empresa-blue text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    Todos · {reopenCounts.total.toLocaleString('pt-BR')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReopenView('reopened'); setPage(1) }}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${reopenView === 'reopened' ? 'bg-red-500 text-white' : 'text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30'}`}
                  >
                    Reabertos · {reopenCounts.reopened.toLocaleString('pt-BR')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReopenView('not_reopened'); setPage(1) }}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${reopenView === 'not_reopened' ? 'bg-green-600 text-white' : 'text-green-600 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/30'}`}
                  >
                    Não reabertos · {reopenCounts.notReopened.toLocaleString('pt-BR')}
                  </button>
                </div>
              </div>
              <p className="leading-snug">{REOPEN_VIEW_LABEL[reopenView]} na base do período.</p>
            </div>
          )}

          <div
            className="overflow-auto border border-slate-300 bg-white"
            style={{
              backgroundColor: surfaceBg,
              borderColor: tableStrongBorder,
              maxHeight: tableFullscreen ? 'calc(100vh - 150px)' : tableMaxHeight,
              overflowX: 'auto',
              overflowY: 'auto',
            }}
          >
            {tableCols.length === 0 ? (
              <p className="text-sm text-slate-400 p-4 text-center">Sem dados disponíveis.</p>
            ) : (
              <table style={{ width: '100%', minWidth: tableEffectiveMinWidth, borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: tableHeaderBg }}>
                    {tableCols.map(col => {
                      const isSorted = sortConfig?.col === col.key
                      const SortIcon = isSorted
                        ? sortConfig.direction === 'asc'
                          ? ArrowUp
                          : ArrowDown
                        : ArrowUpDown

                      return (
                        <th key={col.key} style={{ color: tableHeadText, fontWeight: 700, textAlign: 'left', border: `1px solid ${tableStrongBorder}`, padding: 0, position: 'sticky', top: 0, background: tableHeaderBg, zIndex: 10, whiteSpace: tableCellWhiteSpace, wordBreak: tableWordBreak }}>
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            style={{
                              width: '100%',
                              minWidth: getFilterMinWidth(detail.cod, col.key),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 6,
                              padding: '4px 8px',
                              color: isSorted ? PRIMARY_BLUE : tableHeadText,
                              background: 'transparent',
                              border: 0,
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 700,
                              textAlign: 'left',
                            }}
                            title={`Ordenar por ${col.label}`}
                          >
                            <span>{col.label}</span>
                            <SortIcon size={12} style={{ flexShrink: 0, opacity: isSorted ? 1 : 0.45 }} />
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                  <tr>
                    {tableCols.map(col => {
                      const filterKind = getFilterKind(detail.cod, col.key)
                      const filterStyle: React.CSSProperties = {
                        width: '100%',
                        minWidth: getFilterMinWidth(detail.cod, col.key),
                        border: `1px solid ${tableStrongBorder}`,
                        borderRadius: 2,
                        padding: '2px 4px',
                        fontSize: 10,
                        outline: 'none',
                        fontWeight: 'normal',
                        background: isDark ? '#0f172a' : 'white',
                        color: tableText,
                      }

                      return (
                        <th key={col.key} style={{ border: `1px solid ${tableBorder}`, padding: '2px 4px', background: tableFilterBg, position: 'sticky', top: 29, zIndex: 9 }}>
                          {filterKind === 'select' ? (
                            <select
                              value={filters[col.key] ?? ''}
                              onChange={e => setFilter(col.key, e.target.value)}
                              style={filterStyle}
                            >
                              <option value="">Todos</option>
                              {(selectFilterOptions[col.key] ?? []).map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={filterKind}
                              placeholder={getFilterPlaceholder(detail.cod, col.key)}
                              min={filterKind === 'number' ? 0 : undefined}
                              step={filterKind === 'number' ? 0.01 : undefined}
                              value={filters[col.key] ?? ''}
                              onChange={e => setFilter(col.key, e.target.value)}
                              style={filterStyle}
                            />
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={tableCols.length} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  ) : pageRows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? tableRowEvenBg : tableRowOddBg }}
                        onMouseEnter={e => (e.currentTarget.style.background = tableRowHoverBg)}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? tableRowEvenBg : tableRowOddBg)}>
                      {tableCols.map(col => (
                        <td key={col.key} style={{ border: `1px solid ${tableBorder}`, padding: '2px 8px', color: tableText, whiteSpace: tableCellWhiteSpace, wordBreak: tableWordBreak, height: 28 }}>
                          {renderDetailCell(getDetailCellValue(row, col.key, detail.cod, competencia), col.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {tableTotals && (
                  <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 8 }}>
                    <tr style={{ background: isDark ? '#172033' : '#f8fafc' }}>
                      {tableCols.map((col, index) => {
                        const totalValue = tableTotals[col.key]
                        const isEmptyTotalCell = index > 0 && !totalValue
                        return (
                          <td
                            key={col.key}
                            style={{
                              border: `1px solid ${tableStrongBorder}`,
                              padding: '5px 8px',
                              color: tableHeadText,
                              fontWeight: 700,
                              position: 'sticky',
                              bottom: 0,
                              zIndex: 8,
                              background: isDark ? '#172033' : '#f8fafc',
                              whiteSpace: tableCellWhiteSpace,
                              wordBreak: tableWordBreak,
                            }}
                          >
                            <span style={{ opacity: isEmptyTotalCell ? 0.35 : 1 }}>
                              {index === 0 ? (totalValue ? `Total: ${totalValue}` : 'Total') : totalValue ?? '—'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-200 flex justify-end flex-shrink-0">
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded border border-slate-200">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-xs disabled:opacity-30"
                title="Página anterior"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="text-[10px] font-mono text-slate-500 w-16 text-center">{page}/{totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-xs disabled:opacity-30"
                title="Próxima página"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Charts inferiores: Histórico + Top 5 */}
      <div className={`grid grid-cols-1 gap-4 ${detail.cod === '01' || isInventoryBandwidthKpi(detail.cod) ? '' : 'lg:grid-cols-3'}`}>

        {/* Histórico mensal (esquerda) */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 ${detail.cod === '01' || isInventoryBandwidthKpi(detail.cod) ? '' : 'lg:col-span-2'}`} style={{ minHeight: 220 }}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 gap-3">
            <h3 className="font-bold text-slate-600 text-sm">Histórico Mensal</h3>
          </div>
          {historico.length > 0 ? (() => {
            const allValores = historico
              .map(item => item.valor)
              .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
            const sMax = Math.max(metaNum, ...allValores, 0)
            const sMin = Math.min(metaNum || sMax, ...allValores)
            const sSpan = Math.max(1, sMax - sMin)
            const sPad = Math.max(sSpan * 0.2, metaNum >= 90 ? 10 : Math.max(metaNum * 0.15, 2))
            const sDomain: [number, number] = [Math.max(0, Math.floor(sMin - sPad)), Math.ceil(sMax + sPad)]
            return (
              <ResponsiveContainer width="100%" height={215}>
                <LineChart data={historico} margin={{ top: 12, right: 62, bottom: 5, left: 0 }}>
                  <XAxis dataKey="competencia" tick={{ fontSize: 10, fill: chartTick }} axisLine={{ stroke: tableBorder }} tickLine={{ stroke: tableBorder }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: chartTick }}
                    width={45}
                    domain={sDomain}
                    axisLine={{ stroke: tableBorder }}
                    tickLine={{ stroke: tableBorder }}
                  />
                  <Tooltip
                    formatter={(v: number) => [v.toFixed(2), 'Valor']}
                    labelStyle={{ fontSize: 11, color: chartText }}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: chartText }}
                  />
                  {metaNum > 0 && !isInventoryBandwidthKpi(detail.cod) && (
                    <ReferenceLine
                      y={metaNum}
                      stroke="#22c55e"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      ifOverflow="extendDomain"
                      label={{
                        value: `Meta: ${detail.meta}`,
                        position: 'insideTopRight',
                        fill: '#22c55e',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    />
                  )}
                  <Line type="monotone" dataKey="valor" stroke={PRIMARY_BLUE} strokeWidth={2}
                    dot={{ r: 3, fill: PRIMARY_BLUE }} activeDot={{ r: 5 }} />
                  {historico.length > 12 && (
                    <Brush
                      key={brushHistKey}
                      dataKey="competencia"
                      height={28}
                      startIndex={brushHistPosRef.current.start}
                      endIndex={brushHistPosRef.current.end}
                      stroke={PRIMARY_BLUE}
                      fill={isDark ? '#1e293b' : '#f8fafc'}
                      travellerWidth={8}
                      alwaysShowText
                      tickFormatter={(v: string) => { const [y, m] = v.split('-'); return `${m}/${y.slice(2)}` }}
                      onChange={(range: any) => {
                        if (range?.startIndex !== undefined && range?.endIndex !== undefined) {
                          brushHistPosRef.current = { start: range.startIndex, end: range.endIndex }
                        }
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )
          })() : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <p className="text-sm">Sem histórico disponível</p>
            </div>
          )}
        </div>

        {detail.cod !== '01' && !isInventoryBandwidthKpi(detail.cod) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-1" style={{ minHeight: 220 }}>
            <h3 className="font-bold text-slate-600 text-sm border-b border-slate-100 pb-2 mb-2">Top 5 Ofensores</h3>
            {topOffenders.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(190, topOffenders.length * 22 + 10)}>
                <BarChart data={topOffenders} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9, fill: chartTick }} axisLine={{ stroke: tableBorder }} tickLine={{ stroke: tableBorder }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={yAxisWidth}
                    tick={(props: { x: number; y: number; payload: { value: string } }) => {
                      const { x, y, payload } = props
                      const maxChars = Math.floor((yAxisWidth - 6) / 5.5)
                      const label = payload.value.length > maxChars
                        ? payload.value.slice(0, maxChars - 1) + '…'
                        : payload.value
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <title>{payload.value}</title>
                          <text x={0} y={0} dy={4} textAnchor="end" fill={chartTick} fontSize={9}>{label}</text>
                        </g>
                      )
                    }}
                  />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: chartText }} itemStyle={{ color: chartText }} />
                  <Bar
                    dataKey="value"
                    radius={[0, 3, 3, 0]}
                    style={{ cursor: topOffendersGroupKey ? 'pointer' : 'default' }}
                    onClick={(data: { name: string }) => {
                      if (!topOffendersGroupKey) return
                      setChartFilter(prev =>
                        prev?.col === topOffendersGroupKey && prev.val === data.name
                          ? null
                          : { source: 'topOffenders', col: topOffendersGroupKey, val: data.name }
                      )
                      setPage(1)
                    }}
                  >
                    {topOffenders.map((entry, i) => {
                      const isSelected = chartFilter?.col === topOffendersGroupKey && chartFilter.val === entry.name
                      const isFiltering = chartFilter?.source === 'topOffenders'
                      const base = i === 0 ? STATUS_COLOR.critical : i < 3 ? STATUS_COLOR.alert : PRIMARY_BLUE
                      return (
                        <Cell
                          key={i}
                          fill={isFiltering && !isSelected ? '#cbd5e1' : base}
                          opacity={isFiltering && !isSelected ? 0.6 : 1}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <p className="text-sm">
                {topOffendersGroupKey ? 'Não houve ofensores no período.' : 'Sem dados para ranking.'}
              </p>
            </div>
          )}
          </div>
        )}
      </div>
    </>
  )

  if (modal) {
    return (
      <div className="-mx-3 -mb-3 sm:-mx-5 sm:-mb-5 h-full flex flex-col">
        {header}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-4 sm:px-5 sm:pb-5">
          {body}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {header}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {body}
      </div>
    </div>
  )
}

export function IndicadorDetalhe() {
  return (
    <Layout>
      <IndicadorDetalheContent />
    </Layout>
  )
}
