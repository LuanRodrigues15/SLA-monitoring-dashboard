import { apiClient } from './client'

export interface MesStatus {
  competencia: string
  fechado: boolean
  dt_fechamento: string | null
  fechado_por: string | null
  corrente: boolean
}

export interface KpiSerie {
  cod: string
  sigla: string
  nome: string
  serie: { competencia: string; valor: number | null }[]
}

export const fetchMeses = (): Promise<MesStatus[]> =>
  apiClient.get('/api/historico/meses').then((r) => r.data)

export const fetchSeries = (): Promise<KpiSerie[]> =>
  apiClient.get('/api/historico/series').then((r) => r.data)

export const downloadPacote = (competencia: string, tipo: 'full' | 'excel' | 'txts'): Promise<Blob> =>
  apiClient.get('/api/historico/download', {
    params: { competencia, tipo },
    responseType: 'blob',
  }).then((r) => r.data)

export const fecharMes = (competencia: string): Promise<void> =>
  apiClient.post(`/api/historico/fechar/${competencia}`).then(() => undefined)

export const reabrirMes = (competencia: string): Promise<void> =>
  apiClient.delete(`/api/historico/fechar/${competencia}`).then(() => undefined)
