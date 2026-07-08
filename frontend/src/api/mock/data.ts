// Dataset fictício usado apenas em modo demo (VITE_DEMO_MODE=true).
// Nenhum valor aqui reflete dados reais — é gerado para ilustrar a interface.
import type {
  User,
  KpiSummary,
  KpiHistoricoItem,
  EnvioLogOut,
} from '../../types'
import type { MesStatus, KpiSerie } from '../historico'

type MetaOp = 'gte' | 'lte'

interface CatalogEntry {
  cod: string
  sigla: string
  nome: string
  categoria: string
  meta: string
  metaVal: number
  metaOp: MetaOp
  metaAlert: number | null
}

// Segmentos ilustrativos: A=Enlace de Dados, B=Telefonia IP, C=Conectividade Sem Fio,
// D=Monitoramento por Vídeo, E=Serviço Complementar
const CATALOG: CatalogEntry[] = [
  { cod: '01', sigla: 'MNT', nome: 'Manutenção Corretiva de Enlace', categoria: 'Disponibilidade Enlace', meta: '≤5 NC/M', metaVal: 5, metaOp: 'lte', metaAlert: 4 },
  { cod: '02', sigla: 'DMA', nome: 'Disponibilidade Mensal — Enlace de Dados', categoria: 'Disponibilidade Enlace', meta: '≥98%', metaVal: 98, metaOp: 'gte', metaAlert: 99 },
  { cod: '03', sigla: 'EBA', nome: 'Entrega de Banda — Enlace de Dados', categoria: 'Disponibilidade Enlace', meta: '50 Mbps', metaVal: 50, metaOp: 'gte', metaAlert: null },
  { cod: '04', sigla: 'DMB', nome: 'Disponibilidade Mensal — Telefonia IP', categoria: 'Disponibilidade', meta: '≥98%', metaVal: 98, metaOp: 'gte', metaAlert: 99 },
  { cod: '05', sigla: 'DMC', nome: 'Disponibilidade Mensal — Conectividade Sem Fio', categoria: 'Disponibilidade', meta: '≥98%', metaVal: 98, metaOp: 'gte', metaAlert: 99 },
  { cod: '06', sigla: 'EBC', nome: 'Entrega de Banda — Conectividade Sem Fio', categoria: 'Disponibilidade', meta: '100 Mbps', metaVal: 100, metaOp: 'gte', metaAlert: null },
  { cod: '07', sigla: 'DMD', nome: 'Disponibilidade Mensal — Monitoramento por Vídeo', categoria: 'Disponibilidade', meta: '≥98%', metaVal: 98, metaOp: 'gte', metaAlert: 99 },
  { cod: '08', sigla: 'DME', nome: 'Disponibilidade Mensal — Serviço Complementar', categoria: 'Disponibilidade', meta: '≥98%', metaVal: 98, metaOp: 'gte', metaAlert: 99 },
  { cod: '09', sigla: 'SO1', nome: 'Qualidade do Serviço de Operação', categoria: 'Satisfação', meta: '≥85%', metaVal: 85, metaOp: 'gte', metaAlert: 92 },
  { cod: '10', sigla: 'SO2', nome: 'Qualidade de Satisfação no Atendimento', categoria: 'Satisfação', meta: '≥85%', metaVal: 85, metaOp: 'gte', metaAlert: 92 },
  { cod: '11', sigla: 'SO3', nome: 'Grau de Satisfação — Telefonia IP', categoria: 'Satisfação', meta: '≥85%', metaVal: 85, metaOp: 'gte', metaAlert: 92 },
  { cod: '12', sigla: 'TRA', nome: 'Tempo de Resposta — Enlace de Dados', categoria: 'Tempo Resposta', meta: '≤3h', metaVal: 3, metaOp: 'lte', metaAlert: 2 },
  { cod: '13', sigla: 'TSA', nome: 'Tempo de Solução — Enlace de Dados', categoria: 'Tempo Solução', meta: '≤48h', metaVal: 48, metaOp: 'lte', metaAlert: 36 },
  { cod: '14', sigla: 'EFA', nome: 'Efetividade — Enlace de Dados', categoria: 'Efetividade', meta: '≥85%', metaVal: 85, metaOp: 'gte', metaAlert: 92 },
  { cod: '15', sigla: 'RBA', nome: 'Reabertura — Enlace de Dados', categoria: 'Reabertura', meta: '≤15%', metaVal: 15, metaOp: 'lte', metaAlert: 10 },
  { cod: '16', sigla: 'TRB', nome: 'Tempo de Resposta — Telefonia IP', categoria: 'Tempo Resposta', meta: '≤3h', metaVal: 3, metaOp: 'lte', metaAlert: 2 },
  { cod: '17', sigla: 'TSB', nome: 'Tempo de Solução — Telefonia IP', categoria: 'Tempo Solução', meta: '≤48h', metaVal: 48, metaOp: 'lte', metaAlert: 36 },
  { cod: '18', sigla: 'EFB', nome: 'Efetividade — Telefonia IP', categoria: 'Efetividade', meta: '≥85%', metaVal: 85, metaOp: 'gte', metaAlert: 92 },
  { cod: '19', sigla: 'RBB', nome: 'Reabertura — Telefonia IP', categoria: 'Reabertura', meta: '≤15%', metaVal: 15, metaOp: 'lte', metaAlert: 10 },
  { cod: '20', sigla: 'TRC', nome: 'Tempo de Resposta — Conectividade Sem Fio', categoria: 'Tempo Resposta', meta: '≤3h', metaVal: 3, metaOp: 'lte', metaAlert: 2 },
  { cod: '21', sigla: 'TSC', nome: 'Tempo de Solução — Conectividade Sem Fio', categoria: 'Tempo Solução', meta: '≤48h', metaVal: 48, metaOp: 'lte', metaAlert: 36 },
  { cod: '22', sigla: 'EFC', nome: 'Efetividade — Conectividade Sem Fio', categoria: 'Efetividade', meta: '≥85%', metaVal: 85, metaOp: 'gte', metaAlert: 92 },
  { cod: '23', sigla: 'RBC', nome: 'Reabertura — Conectividade Sem Fio', categoria: 'Reabertura', meta: '≤15%', metaVal: 15, metaOp: 'lte', metaAlert: 10 },
  { cod: '24', sigla: 'TRD', nome: 'Tempo de Resposta — Monitoramento por Vídeo', categoria: 'Tempo Resposta', meta: '≤3h', metaVal: 3, metaOp: 'lte', metaAlert: 2 },
  { cod: '25', sigla: 'TSD', nome: 'Tempo de Solução — Monitoramento por Vídeo', categoria: 'Tempo Solução', meta: '≤48h', metaVal: 48, metaOp: 'lte', metaAlert: 36 },
  { cod: '26', sigla: 'EFD', nome: 'Efetividade — Monitoramento por Vídeo', categoria: 'Efetividade', meta: '≥85%', metaVal: 85, metaOp: 'gte', metaAlert: 92 },
  { cod: '27', sigla: 'RBD', nome: 'Reabertura — Monitoramento por Vídeo', categoria: 'Reabertura', meta: '≤15%', metaVal: 15, metaOp: 'lte', metaAlert: 10 },
  { cod: '28', sigla: 'TRE', nome: 'Tempo de Resposta — Serviço Complementar', categoria: 'Tempo Resposta', meta: '≤3h', metaVal: 3, metaOp: 'lte', metaAlert: 2 },
  { cod: '29', sigla: 'TSE', nome: 'Tempo de Solução — Serviço Complementar', categoria: 'Tempo Solução', meta: '≤48h', metaVal: 48, metaOp: 'lte', metaAlert: 36 },
  { cod: '30', sigla: 'EFE', nome: 'Efetividade — Serviço Complementar', categoria: 'Efetividade', meta: '≥85%', metaVal: 85, metaOp: 'gte', metaAlert: 92 },
  { cod: '31', sigla: 'RBE', nome: 'Reabertura — Serviço Complementar', categoria: 'Reabertura', meta: '≤15%', metaVal: 15, metaOp: 'lte', metaAlert: 10 },
]

// PRNG determinístico (sem dependência externa) — mesmos valores a cada carga da página.
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function computeStatus(valor: number, entry: CatalogEntry): KpiSummary['status'] {
  const { metaOp, metaVal, metaAlert } = entry
  if (metaOp === 'gte') {
    if (metaAlert !== null && valor >= metaAlert) return 'ok'
    if (valor >= metaVal) return 'alert'
    return 'critical'
  }
  if (metaAlert !== null && valor <= metaAlert) return 'ok'
  if (valor <= metaVal) return 'alert'
  return 'critical'
}

function currentCompetencia(offset = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function genValor(entry: CatalogEntry, rnd: () => number): number {
  const { metaOp, metaVal } = entry
  if (metaOp === 'gte') {
    // a maioria fica perto/acima da meta, uma minoria abaixo
    const base = metaVal - 3 + rnd() * 4.5
    return Math.round(Math.min(100, Math.max(0, base)) * 100) / 100
  }
  const base = metaVal * (0.4 + rnd() * 0.9)
  return Math.round(base * 100) / 100
}

export function buildKpiSummaries(competencia: string): KpiSummary[] {
  const [ano, mes] = competencia.split('-').map(Number)
  const rnd = seededRandom(ano * 12 + mes)
  return CATALOG.map((entry) => {
    const valor = genValor(entry, rnd)
    return {
      cod: entry.cod,
      sigla: entry.sigla,
      nome: entry.nome,
      categoria: entry.categoria,
      meta: entry.meta,
      valor_atual: valor,
      competencia,
      status: computeStatus(valor, entry),
      ultima_atualizacao: new Date().toISOString(),
      observacao: null,
    }
  })
}

export const DEMO_COMPETENCIAS: string[] = Array.from({ length: 12 }, (_, i) => currentCompetencia(i))

export const kpiState: Record<string, KpiSummary[]> = Object.fromEntries(
  DEMO_COMPETENCIAS.map((c) => [c, buildKpiSummaries(c)])
)

export function buildHistorico(cod: string, meses: number): KpiHistoricoItem[] {
  return DEMO_COMPETENCIAS.slice(0, meses)
    .slice()
    .reverse()
    .map((competencia) => {
      const rows = kpiState[competencia]
      const row = rows.find((r) => r.cod === cod)!
      return { competencia, valor: row.valor_atual, status: row.status }
    })
}

export function buildLinhas(cod: string, categoria: string): Record<string, unknown>[] {
  if (categoria.startsWith('Tempo') || categoria === 'Satisfação' || categoria === 'Efetividade' || categoria === 'Reabertura') {
    return Array.from({ length: 6 }, (_, i) => ({
      ticket_id: `DEMO-${cod}-${1000 + i}`,
      dt_abertura: `2026-0${(i % 9) + 1}-${String(10 + i).padStart(2, '0')}T08:${String(10 + i).padStart(2, '0')}:00`,
      dt_resolvido: `2026-0${(i % 9) + 1}-${String(11 + i).padStart(2, '0')}T09:00:00`,
      tr: (0.5 + i * 0.3).toFixed(2),
      ts: (4 + i * 2).toFixed(2),
      qsos: i % 2 === 0 ? 'Excelente' : 'Bom',
      houve_reabertura: i % 4 === 0 ? 'Sim' : 'Não',
    }))
  }
  return Array.from({ length: 5 }, (_, i) => ({
    host: `host-demo-${i + 1}`,
    dt_inicio_real: `2026-0${(i % 9) + 1}-0${i + 1}T00:00:00`,
    dt_final_real: `2026-0${(i % 9) + 1}-0${i + 1}T02:00:00`,
    horas_indisp_real: (0.5 + i * 0.4).toFixed(2),
    dt_inicio_auditor: `2026-0${(i % 9) + 1}-0${i + 1}T00:00:00`,
    dt_final_auditor: `2026-0${(i % 9) + 1}-0${i + 1}T01:30:00`,
    horas_indisp_auditor: (0.3 + i * 0.3).toFixed(2),
  }))
}

export const demoUsers: User[] = [
  { id: 'demo-admin', name: 'Admin Demo', email: 'admin@example.com', role: 'admin', active: true },
  { id: 'demo-gestor', name: 'Gestor Demo', email: 'gestor@example.com', role: 'gestor', active: true },
  { id: 'demo-readonly', name: 'Leitura Demo', email: 'readonly@example.com', role: 'readonly', active: true },
  { id: 'demo-auditor', name: 'Auditor Demo', email: 'auditor@example.com', role: 'auditor', active: true },
]

export const demoEnvios: EnvioLogOut[] = DEMO_COMPETENCIAS.slice(1, 5).map((competencia, i) => ({
  id: `envio-${i}`,
  usuario_email: 'admin@example.com',
  dt_envio: `${competencia}-28T18:00:00`,
  indicadores_enviados: CATALOG.map((k) => k.cod),
  status: i === 0 ? 'sucesso' : (['sucesso', 'parcial', 'sucesso'] as const)[i - 1],
  mensagem_erro: null,
  qtd_arquivos_ok: 31,
}))

export const demoMeses: MesStatus[] = DEMO_COMPETENCIAS.map((competencia, i) => ({
  competencia,
  fechado: i !== 0,
  dt_fechamento: i !== 0 ? `${competencia}-28T18:05:00` : null,
  fechado_por: i !== 0 ? 'admin@example.com' : null,
  corrente: i === 0,
}))

export const demoSeries: KpiSerie[] = CATALOG.map((entry) => ({
  cod: entry.cod,
  sigla: entry.sigla,
  nome: entry.nome,
  serie: buildHistorico(entry.cod, 12).map((h) => ({ competencia: h.competencia, valor: h.valor })),
}))

export function findCatalogEntry(cod: string): CatalogEntry | undefined {
  return CATALOG.find((k) => k.cod === cod)
}

// Layout de 14 colunas ilustrativo do pacote real (ID_arquivo, Codigo, Categoria,
// Detalhamento, Texto_01..05, DT_inicial, DT_final, Medicao, HoraArquivo, Competencia).
function linhaToTxt(row: Record<string, unknown>): string[] {
  if ('ticket_id' in row) {
    return [
      String(row.ticket_id ?? ''),
      'Cliente Demo',
      '',
      '',
      '',
      String(row.dt_abertura ?? ''),
      String(row.dt_resolvido ?? ''),
      String(row.tr ?? row.ts ?? row.qsos ?? ''),
    ]
  }
  return [
    String(row.host ?? ''),
    '',
    '',
    '',
    '',
    String(row.dt_inicio_real ?? ''),
    String(row.dt_final_real ?? ''),
    String(row.horas_indisp_real ?? ''),
  ]
}

export function buildTxtContent(entry: CatalogEntry, competencia: string): string {
  const header = 'ID_arquivo|Codigo|Categoria|Detalhamento|Texto_01|Texto_02|Texto_03|Texto_04|Texto_05|DT_inicial|DT_final|Medicao|HoraArquivo|Competencia'
  const hora = new Date().toLocaleString('pt-BR')
  const linhas = buildLinhas(entry.cod, entry.categoria)
  const rows = linhas.map((linha, i) => {
    const [det, t1, t2, t3, t4, dtIni, dtFim, medicao] = linhaToTxt(linha)
    return [String(i + 1), entry.cod, entry.categoria, det, t1, t2, t3, t4, '', dtIni, dtFim, medicao, hora, competencia].join('|')
  })
  return [header, ...rows].join('\n')
}

export function buildPacoteFiles(competencia: string): { name: string; content: string }[] {
  return CATALOG.map((entry) => ({
    name: `${entry.cod} (${entry.sigla}).txt`,
    content: buildTxtContent(entry, competencia),
  }))
}
