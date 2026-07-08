// Adapter customizado do axios para o modo demo (VITE_DEMO_MODE=true).
// Intercepta toda chamada feita por `apiClient` e responde com dados fictícios
// em memória, sem nenhuma requisição de rede real. Ver frontend/src/api/mock/data.ts.
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import {
  DEMO_COMPETENCIAS,
  kpiState,
  buildHistorico,
  buildLinhas,
  demoUsers,
  demoEnvios,
  demoMeses,
  demoSeries,
  findCatalogEntry,
  buildPacoteFiles,
} from './data'
import { buildZip } from './zip'
import type { User } from '../../types'

const DEMO_DELAY_MS = 250

function ok<T>(data: T, config: InternalAxiosRequestConfig): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  }
}

function fail(status: number, message: string): never {
  const err: any = new Error(message)
  err.response = { status, data: { detail: message } }
  err.isAxiosError = true
  throw err
}

function placeholderTxtBlob(): Blob {
  return new Blob(
    ['Modo demonstração: o Excel individual não é gerado neste ambiente (sem backend real).\nBaixe o pacote completo (ZIP) para ver o layout de dados por indicador.'],
    { type: 'text/plain' }
  )
}

let currentUser: User = demoUsers[0]

function matchPath(url: string, pattern: RegExp): RegExpMatchArray | null {
  return url.match(pattern)
}

export const mockAdapter: AxiosAdapter = async (config) => {
  await new Promise((r) => setTimeout(r, DEMO_DELAY_MS))

  const method = (config.method ?? 'get').toLowerCase()
  const url = (config.url ?? '').split('?')[0]
  const params = config.params ?? {}
  const body = typeof config.data === 'string' ? safeParse(config.data) : config.data ?? {}

  // ---- auth ----
  if (method === 'post' && url === '/api/auth/login') {
    currentUser = demoUsers[0]
    return ok({ access_token: 'demo-token', token_type: 'bearer', user: currentUser }, config)
  }
  if (method === 'get' && url === '/api/auth/me') {
    return ok(currentUser, config)
  }
  if (method === 'post' && url === '/api/auth/change-password') {
    return ok(undefined, config)
  }

  // ---- kpis ----
  if (method === 'get' && url === '/api/kpis/competencias') {
    return ok(DEMO_COMPETENCIAS, config)
  }
  if (method === 'get' && url === '/api/kpis') {
    const competencia = params.competencia ?? DEMO_COMPETENCIAS[0]
    return ok(kpiState[competencia] ?? kpiState[DEMO_COMPETENCIAS[0]], config)
  }

  // ---- indicadores ----
  let m = matchPath(url, /^\/api\/indicadores\/([^/]+)\/excel$/)
  if (method === 'get' && m) {
    return ok(placeholderTxtBlob(), config)
  }
  m = matchPath(url, /^\/api\/indicadores\/([^/]+)\/historico$/)
  if (method === 'get' && m) {
    const meses = Number(params.meses ?? 12)
    return ok(buildHistorico(m[1], meses), config)
  }
  m = matchPath(url, /^\/api\/indicadores\/([^/]+)$/)
  if (method === 'get' && m) {
    const cod = m[1]
    const competencia = params.competencia ?? DEMO_COMPETENCIAS[0]
    const row = (kpiState[competencia] ?? kpiState[DEMO_COMPETENCIAS[0]]).find((k) => k.cod === cod)
    if (!row) fail(404, 'Indicador não encontrado')
    const entry = findCatalogEntry(cod)!
    return ok({ ...row, linhas: buildLinhas(cod, entry.categoria) }, config)
  }

  // ---- envio ----
  if (method === 'post' && url === '/api/envio/zip') {
    const competencia = params.competencia ?? DEMO_COMPETENCIAS[0]
    return ok(buildZip(buildPacoteFiles(competencia)), config)
  }
  if (method === 'post' && url === '/api/envio/sftp') {
    demoEnvios.unshift({
      id: `envio-${Date.now()}`,
      usuario_email: currentUser.email,
      dt_envio: new Date().toISOString(),
      indicadores_enviados: body.indicadores ?? [],
      status: 'sucesso',
      mensagem_erro: null,
      qtd_arquivos_ok: (body.indicadores ?? []).length,
    })
    return ok(undefined, config)
  }
  if (method === 'get' && url === '/api/envio/historico') {
    return ok(demoEnvios, config)
  }

  // ---- historico (meses fechados / séries) ----
  if (method === 'get' && url === '/api/historico/meses') {
    return ok(demoMeses, config)
  }
  if (method === 'get' && url === '/api/historico/series') {
    return ok(demoSeries, config)
  }
  if (method === 'get' && url === '/api/historico/download') {
    const competencia = params.competencia ?? DEMO_COMPETENCIAS[0]
    if (params.tipo === 'excel') {
      return ok(placeholderTxtBlob(), config)
    }
    return ok(buildZip(buildPacoteFiles(competencia)), config)
  }
  m = matchPath(url, /^\/api\/historico\/fechar\/([^/]+)$/)
  if (m) {
    const mes = demoMeses.find((x) => x.competencia === m![1])
    if (mes) {
      mes.fechado = method === 'post'
      mes.dt_fechamento = method === 'post' ? new Date().toISOString() : null
      mes.fechado_por = method === 'post' ? currentUser.email : null
    }
    return ok(undefined, config)
  }

  // ---- users ----
  m = matchPath(url, /^\/api\/users\/([^/]+)$/)
  if (method === 'put' && m) {
    const idx = demoUsers.findIndex((x) => x.id === m![1])
    if (idx === -1) fail(404, 'Usuário não encontrado')
    demoUsers[idx] = { ...demoUsers[idx], ...body }
    return ok(demoUsers[idx], config)
  }
  if (method === 'delete' && m) {
    const idx = demoUsers.findIndex((x) => x.id === m![1])
    if (idx !== -1) demoUsers[idx].active = false
    return ok(undefined, config)
  }
  if (method === 'get' && url === '/api/users') {
    return ok(demoUsers, config)
  }
  if (method === 'post' && url === '/api/users') {
    const novo: User = {
      id: `user-demo-${Date.now()}`,
      name: body.name ?? 'Novo usuário',
      email: body.email ?? 'novo@example.com',
      role: body.role ?? 'readonly',
      active: true,
    }
    demoUsers.push(novo)
    return ok(novo, config)
  }

  if (method === 'get' && url === '/api/health') {
    return ok({ status: 'ok', trino: true }, config)
  }

  fail(404, `[demo] Rota não implementada no mock: ${method.toUpperCase()} ${url}`)
}

function safeParse(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
