import { useState, useEffect, useRef } from 'react'
import { Download, Send, Loader2, RefreshCw, CheckCircle2, CircleAlert, User, Lock, LockOpen, Clock, Calendar, ChevronDown, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { Layout } from '../components/Layout'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { HeaderActions } from '../components/HeaderActions'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ListSkeleton, TableSkeleton } from '../components/Skeleton'
import { fetchKpis, fetchCompetencias } from '../api/kpis'
import { downloadZip, enviarSftp, fetchHistoricoEnvios } from '../api/envio'
import { fetchMeses, fecharMes, reabrirMes } from '../api/historico'
import type { KpiSummary, EnvioLogOut } from '../types'
import type { MesStatus } from '../api/historico'

const PRIMARY_BLUE = '#205DF5'

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function getMesLabel(competencia: string): string {
  if (!competencia) return ''
  const [y, m] = competencia.split('-')
  return `${MESES_PT[parseInt(m) - 1]} de ${y}`
}

function getMesNome(competencia: string): string {
  if (!competencia) return ''
  const [, m] = competencia.split('-')
  return MESES_PT[parseInt(m) - 1] ?? ''
}

function getPrevMonth() {
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function statusBadge(kpi: KpiSummary) {
  const unit = /\d+h/.test(kpi.meta) ? 'h' : kpi.meta.includes('%') ? '%' : ''

  if (kpi.valor_atual === null && kpi.observacao) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs rounded-full font-medium whitespace-nowrap">
        <CircleAlert size={11} /> TF sem TA no período — incalculável
      </span>
    )
  }

  if (kpi.status === 'pending' || kpi.valor_atual === null) {
    return (
      <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-400 text-xs rounded-full border border-slate-200 dark:border-slate-600 font-medium">
        Sem registro
      </span>
    )
  }

  const valorFmt = unit === '%'
    ? Math.floor(kpi.valor_atual * 100) / 100
    : kpi.valor_atual
  const valor = valorFmt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + unit

  if (kpi.status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-xs rounded-full font-bold whitespace-nowrap">
        <CheckCircle2 size={11} /> {valor}
      </span>
    )
  }

  if (kpi.status === 'alert') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-xs rounded-full font-bold whitespace-nowrap">
        <CheckCircle2 size={11} /> {valor}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs rounded-full font-bold whitespace-nowrap">
      <CircleAlert size={11} /> {valor}
    </span>
  )
}

function logStatusBadge(status: EnvioLogOut['status'], qtd: number) {
  const label = status === 'sucesso' ? 'Sucesso' : status === 'parcial' ? 'Parcial' : 'Falha'
  const cls =
    status === 'sucesso'
      ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
      : status === 'parcial'
      ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
      : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
  const Icon = status === 'sucesso' ? CheckCircle2 : CircleAlert

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${cls}`}>
        <Icon size={11} /> {label}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
        {qtd} arquivo{qtd !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

export function Operacao() {

  const [mesEnvio, setMesEnvio] = useState('')
  const [opcoesMes, setOpcoesMes] = useState<string[]>([])
  const [kpis, setKpis] = useState<KpiSummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [confirmSftp, setConfirmSftp] = useState(false)
  const [sendingSftp, setSendingSftp] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [logs, setLogs] = useState<EnvioLogOut[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [mesesStatus, setMesesStatus] = useState<MesStatus[]>([])
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'dentro' | 'fora'>('todos')
  const [filtroOpen, setFiltroOpen] = useState(false)
  const [filtroPos, setFiltroPos] = useState<{ top: number; right: number } | null>(null)
  const filtroBtnRef = useRef<HTMLButtonElement>(null)

  const mesInfo = mesesStatus.find((m) => m.competencia === mesEnvio) ?? null

  const loadLogs = () => {
    setLogsLoading(true)
    fetchHistoricoEnvios()
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLogsLoading(false))
  }

  useEffect(() => {
    const prev = getPrevMonth()
    setMesEnvio(prev)

    loadLogs()
    fetchMeses().then(setMesesStatus).catch(() => {})
    loadKpis(prev)

    fetchCompetencias()
      .then((meses) => {
        setOpcoesMes(meses)
        if (meses.length > 0 && !meses.includes(prev)) {
          const fallback = meses[0]
          setMesEnvio(fallback)
          loadKpis(fallback)
        }
      })
      .catch(() => {})

    return () => { toast.dismiss('operacao-load-kpis') }
  }, [])

  const loadKpis = async (mes: string) => {
    if (!mes) return
    setLoading(true)
    const tid = toast.loading(`Carregando indicadores de ${getMesNome(mes)}…`, { id: 'operacao-load-kpis' })
    try {
      const data = await fetchKpis(mes, 'kpi_agg_test')
      setKpis(data)
      setSelected(new Set(data.map((k) => k.cod)))
      toast.success(`Dados de ${getMesNome(mes)} carregados`, { id: tid })
    } catch {
      toast.error('Erro ao carregar KPIs', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  const handleMesChange = (mes: string) => {
    setMesEnvio(mes)
    loadKpis(mes)
  }

  const allChecked = kpis.length > 0 && selected.size === kpis.length
  const someChecked = selected.size > 0 && !allChecked

  const toggleMaster = (checked: boolean) => {
    checked ? setSelected(new Set(kpis.map((k) => k.cod))) : setSelected(new Set())
  }

  const toggleKpi = (cod: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(cod) ? next.delete(cod) : next.add(cod)
      return next
    })
  }

  const handleDownload = async () => {
    setDownloading(true)
    const tid = toast.loading('Gerando ZIP… aguarde (pode levar até 1 min)')
    try {
      const blob = await downloadZip(mesEnvio || undefined)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Pacote_Indicadores_SLA_${mesEnvio || new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Download iniciado', { id: tid })
    } catch {
      toast.error('Erro ao gerar ZIP', { id: tid })
    } finally {
      setDownloading(false)
    }
  }

  const handleToggleMes = async () => {
    if (!mesEnvio) return
    setToggling(true)
    try {
      if (mesInfo?.fechado) {
        await reabrirMes(mesEnvio)
        toast.success(`${getMesNome(mesEnvio)} reaberto — recálculo automático reativado`)
      } else {
        await fecharMes(mesEnvio)
        toast.success(`${getMesNome(mesEnvio)} fechado — recálculo automático bloqueado`)
      }
      const updated = await fetchMeses()
      setMesesStatus(updated)
    } catch {
      toast.error('Erro ao alterar status do mês')
    } finally {
      setToggling(false)
    }
  }

  const handleSftp = async () => {
    setSendingSftp(true)
    try {
      await enviarSftp(Array.from(selected), mesEnvio || undefined)
      toast.success('Envio SFTP iniciado em background')
      setConfirmSftp(false)
      setTimeout(loadLogs, 3000)
    } catch {
      toast.error('Erro ao enviar via SFTP')
    } finally {
      setSendingSftp(false)
    }
  }

  const sorted = [...kpis].sort((a, b) => parseInt(a.cod) - parseInt(b.cod))
  const filtered = sorted.filter((kpi) => {
    if (filtroStatus === 'dentro') return kpi.status === 'ok' || kpi.status === 'alert'
    if (filtroStatus === 'fora') return kpi.status === 'critical'
    return true
  })
  const isCorrente = mesEnvio === getCurrentMonth()

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-2.5 flex items-center justify-between shadow-sm">
          <Breadcrumbs items={[{ label: 'Menu Principal', to: '/menu' }, { label: 'Central de Envio' }]} />
          <HeaderActions />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-5 py-4">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Card esquerdo — seleção */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4 flex flex-col">

              {/* Header do card */}
              <div className="mb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="font-bold text-base text-slate-800 dark:text-slate-100">Selecione os Indicadores</h2>

                    {/* Seletor de mês */}
                    {opcoesMes.length > 0 && (
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 shadow-sm">
                        <Calendar size={14} className="shrink-0" style={{ color: PRIMARY_BLUE }} />
                        <div className="relative">
                          <select
                            value={mesEnvio}
                            onChange={(e) => handleMesChange(e.target.value)}
                            className="appearance-none pr-6 text-sm font-semibold bg-transparent text-empresa-blue dark:text-slate-100 focus:outline-none cursor-pointer"
                            style={{ backgroundColor: 'transparent' }}
                          >
                            {opcoesMes.map((m) => (
                              <option key={m} value={m} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                                {getMesNome(m)} ({m})
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={14}
                            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-empresa-blue dark:text-slate-200"
                          />
                        </div>
                      </div>
                    )}

                    {/* Badge de status + botão de controle */}
                    {mesEnvio && (() => {
                      if (isCorrente && !mesInfo?.fechado) {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                            <Clock size={11} /> Em andamento
                          </span>
                        )
                      }
                      if (mesInfo?.fechado) {
                        return (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400">
                              <Lock size={11} /> Fechado
                            </span>
                            <button
                              onClick={handleToggleMes}
                              disabled={toggling}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50 disabled:opacity-50 transition-colors"
                            >
                              {toggling ? <Loader2 size={11} className="animate-spin" /> : <LockOpen size={11} />}
                              Reabrir
                            </button>
                          </>
                        )
                      }
                      return (
                        <button
                          onClick={handleToggleMes}
                          disabled={toggling}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                        >
                          {toggling ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
                          Fechar Mês
                        </button>
                      )
                    })()}
                  </div>

                  <div className="flex items-center gap-1 text-xs">
                    <button
                      onClick={() => toggleMaster(true)}
                      className="font-semibold hover:underline"
                      style={{ color: PRIMARY_BLUE }}
                    >
                      Marcar Todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => toggleMaster(false)}
                      className="font-semibold text-slate-500 dark:text-slate-400 hover:underline"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                {/* Descrição do estado do mês */}
                {mesEnvio && (() => {
                  if (isCorrente && !mesInfo?.fechado) {
                    return (
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Mês corrente em andamento — recalculado automaticamente às 07h e 13h. Será fechado ao enviar ao Auditor via SFTP.
                      </p>
                    )
                  }
                  if (mesInfo?.fechado) {
                    return (
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {isCorrente
                          ? 'Fechado após envio ao Auditor — o agendador não recalculará mais este mês. Para corrigir os valores e reenviar, reabra o mês.'
                          : `Fechado${mesInfo.dt_fechamento ? ` em ${new Date(mesInfo.dt_fechamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''} — o agendador não recalculará este mês. Reabra somente se precisar corrigir os valores antes de um reenvio.`
                        }
                      </p>
                    )
                  }
                  return (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Aberto — o agendador pode recalcular os valores às 07h e 13h. Feche o mês para consolidar os dados e impedir novos recálculos automáticos.
                    </p>
                  )
                })()}
              </div>

              {/* Tabela de KPIs */}
              <div className="overflow-y-auto flex-1" style={{ maxHeight: 320 }}>
                <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="p-3 w-10">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => { if (el) el.indeterminate = someChecked }}
                            onChange={(e) => toggleMaster(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          />
                        </th>
                        <th className="p-3">Cód</th>
                        <th className="p-3">Indicador</th>
                        <th className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span>Status</span>
                            <div className="relative">
                              <button
                                ref={filtroBtnRef}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const rect = filtroBtnRef.current?.getBoundingClientRect()
                                  if (rect) setFiltroPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                  setFiltroOpen((o) => !o)
                                }}
                                className={`p-0.5 rounded transition-colors ${filtroStatus !== 'todos' ? 'text-empresa-blue' : 'text-slate-400 hover:text-empresa-blue'}`}
                                title="Filtrar por status"
                              >
                                <Filter size={13} />
                              </button>
                              {filtroOpen && filtroPos && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setFiltroOpen(false)} />
                                  <div
                                    style={{ position: 'fixed', top: filtroPos.top, right: filtroPos.right }}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 min-w-[148px] py-1"
                                  >
                                    {(['todos', 'dentro', 'fora'] as const).map((v) => (
                                      <button
                                        key={v}
                                        onClick={() => { setFiltroStatus(v); setFiltroOpen(false) }}
                                        className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                                          filtroStatus === v
                                            ? 'bg-empresa-blue/10 text-empresa-blue'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                      >
                                        {v === 'todos' ? 'Todos' : v === 'dentro' ? 'Dentro da meta' : 'Fora da meta'}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {loading ? (
                        <tr>
                          <td colSpan={4}>
                            <TableSkeleton rows={5} cols={4} />
                          </td>
                        </tr>
                      ) : sorted.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-xs text-slate-400">
                            Nenhum dado disponível para o período selecionado.
                          </td>
                        </tr>
                      ) : filtered.map((kpi) => (
                        <tr
                          key={kpi.cod}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                          onClick={() => toggleKpi(kpi.cod)}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected.has(kpi.cod)}
                              onChange={() => toggleKpi(kpi.cod)}
                              className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-mono text-slate-400 dark:text-slate-500 text-xs">{kpi.cod}</td>
                          <td className="p-3 font-medium text-slate-700 dark:text-slate-200 text-sm">{parseInt(kpi.cod)}. {kpi.nome} — {kpi.sigla}</td>
                          <td className="p-3 text-center">{statusBadge(kpi)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-md text-sm"
                >
                  {downloading
                    ? <><Loader2 size={14} className="animate-spin" /> Gerando…</>
                    : <><Download size={14} /> Baixar Arquivos</>
                  }
                </button>
                <button
                  onClick={() => { if (selected.size > 0) setConfirmSftp(true) }}
                  disabled={selected.size === 0}
                  className="text-white font-bold py-2 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: PRIMARY_BLUE }}
                >
                  <Send size={14} />
                  Enviar para o Auditor{selected.size > 0 ? ` (${selected.size})` : ''}
                </button>
              </div>
            </div>

            {/* Card direito — histórico */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-base text-slate-800 dark:text-slate-100">Histórico de Envios</h2>
                <button
                  onClick={loadLogs}
                  className="text-xs flex items-center gap-1 hover:underline"
                  style={{ color: PRIMARY_BLUE }}
                >
                  <RefreshCw size={12} />
                  Atualizar
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-2" style={{ maxHeight: 360 }}>
                {logsLoading ? (
                  <ListSkeleton rows={3} />
                ) : logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
                    Nenhum log encontrado.
                  </div>
                ) : logs.map((log) => {
                  const isErro = log.status === 'falha'
                  return (
                    <div
                      key={log.id}
                      className={`border rounded-lg p-3 text-sm bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow ${isErro ? 'border-red-200 dark:border-red-800' : 'border-slate-100 dark:border-slate-600'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm">
                          <User size={13} className="text-slate-300 dark:text-slate-500" />
                          {log.usuario_email}
                        </span>
                        <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                          {new Date(log.dt_envio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <div className="mb-2">
                        {logStatusBadge(log.status, log.qtd_arquivos_ok)}
                      </div>
                      {log.mensagem_erro && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-1 leading-relaxed">{log.mensagem_erro}</p>
                      )}
                      {log.indicadores_enviados.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-600 text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                          Ind: {log.indicadores_enviados.join(', ')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmSftp}
        title="Confirmar Envio SFTP"
        description={`Enviar dados de ${getMesLabel(mesEnvio)} ao Auditor via SFTP (${selected.size} indicador${selected.size !== 1 ? 'es' : ''}). Esta ação não pode ser desfeita.`}
        confirmWord="enviar"
        onConfirm={handleSftp}
        onCancel={() => setConfirmSftp(false)}
        loading={sendingSftp}
      />
    </Layout>
  )
}
