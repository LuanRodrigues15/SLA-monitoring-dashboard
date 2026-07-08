export type Role = 'admin' | 'gestor' | 'readonly' | 'auditor'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
}

export interface KpiSummary {
  cod: string
  sigla: string
  nome: string
  categoria: string
  meta: string
  valor_atual: number | null
  competencia: string | null
  status: 'ok' | 'alert' | 'critical' | 'pending'
  ultima_atualizacao: string | null
  observacao?: string | null
}

export interface KpiDetail extends KpiSummary {
  linhas: Record<string, unknown>[]
}

export interface KpiHistoricoItem {
  competencia: string
  valor: number | null
  status: 'ok' | 'alert' | 'critical' | 'pending'
}

export interface EnvioLogOut {
  id: string
  usuario_email: string
  dt_envio: string
  indicadores_enviados: string[]
  status: 'sucesso' | 'parcial' | 'falha'
  mensagem_erro: string | null
  qtd_arquivos_ok: number
}
