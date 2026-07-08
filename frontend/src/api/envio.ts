import { apiClient } from './client'
import type { EnvioLogOut } from '../types'

export const downloadZip = (competencia?: string): Promise<Blob> =>
  apiClient.post('/api/envio/zip', {}, {
    responseType: 'blob',
    params: competencia ? { competencia } : {},
    timeout: 180000,
  }).then((r) => r.data)

export const enviarSftp = (indicadores: string[], competencia?: string): Promise<void> =>
  apiClient.post('/api/envio/sftp', {
    indicadores,
    confirmacao: 'enviar',
    competencia: competencia ?? null,
  }).then(() => undefined)

export const fetchHistoricoEnvios = (): Promise<EnvioLogOut[]> =>
  apiClient.get('/api/envio/historico').then((r) => r.data)
