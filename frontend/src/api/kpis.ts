import { apiClient, isDemoMode } from './client'
import type { KpiSummary, KpiDetail, KpiHistoricoItem } from '../types'

const CACHE_TTL = 30 * 60 * 1000

const kpiCache = new Map<string, { data: KpiSummary[]; ts: number }>()
let competenciasCache: { data: string[]; ts: number } | null = null

export const fetchCompetencias = (): Promise<string[]> => {
  if (competenciasCache && Date.now() - competenciasCache.ts < CACHE_TTL) {
    return Promise.resolve(competenciasCache.data)
  }
  return apiClient.get('/api/kpis/competencias').then((r) => {
    competenciasCache = { data: r.data, ts: Date.now() }
    return r.data
  })
}

export const fetchKpis = (competencia?: string, tabela = 'kpi_agg_test'): Promise<KpiSummary[]> => {
  // Só cacheia a query sem filtro (dados mais recentes) — queries por competência específica
  // não são cacheadas para evitar mostrar dados desatualizados após recálculo.
  if (!competencia) {
    const key = `:${tabela}`
    const cached = kpiCache.get(key)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return Promise.resolve(cached.data)
    }
    return apiClient
      .get('/api/kpis', { params: { tabela } })
      .then((r) => {
        kpiCache.set(key, { data: r.data, ts: Date.now() })
        return r.data
      })
  }
  return apiClient
    .get('/api/kpis', { params: { competencia, tabela } })
    .then((r) => r.data)
}

export const fetchIndicador = (cod: string, competencia?: string, tabela = 'kpi_agg_test'): Promise<KpiDetail> =>
  apiClient.get(`/api/indicadores/${cod}`, { params: { ...(competencia ? { competencia } : {}), tabela } }).then((r) => r.data)

export const fetchHistorico = (cod: string, meses = 12): Promise<KpiHistoricoItem[]> =>
  apiClient.get(`/api/indicadores/${cod}/historico`, { params: { meses } }).then((r) => r.data)

export const downloadIndicadorExcel = async (cod: string, sigla: string, competencia?: string): Promise<void> => {
  const resp = await apiClient.get(`/api/indicadores/${cod}/excel`, {
    params: competencia ? { competencia } : {},
    responseType: 'blob',
  })
  const url = URL.createObjectURL(new Blob([resp.data]))
  const a = document.createElement('a')
  a.href = url
  const ext = isDemoMode ? 'txt' : 'xlsx'
  a.download = `KPI_${cod}_${sigla}_${competencia || 'sem_competencia'}.${ext}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
