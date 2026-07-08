import { useState, useEffect } from 'react'
import { CheckCircle2, CircleAlert, RefreshCw, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { Layout } from '../components/Layout'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { HeaderActions } from '../components/HeaderActions'
import { ListSkeleton } from '../components/Skeleton'
import { fetchHistoricoEnvios } from '../api/envio'
import type { EnvioLogOut } from '../types'

const PRIMARY_BLUE = '#205DF5'

function StatusBadge({ status }: { status: EnvioLogOut['status'] }) {
  const Icon = status === 'sucesso' ? CheckCircle2 : CircleAlert
  const cls =
    status === 'sucesso'
      ? 'text-green-700 bg-green-50 border-green-200'
      : status === 'parcial'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-red-700 bg-red-50 border-red-200'
  const label = status === 'sucesso' ? 'Sucesso' : status === 'parcial' ? 'Parcial' : 'Falha'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  )
}

export function HistoricoEnvios() {
  const [logs, setLogs] = useState<EnvioLogOut[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetchHistoricoEnvios()
      .then(setLogs)
      .catch(() => toast.error('Erro ao carregar histórico'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-2.5 flex items-center justify-between shadow-sm">
          <Breadcrumbs items={[
            { label: 'Menu Principal', to: '/menu' },
            { label: 'Central de Envio', to: '/operacao' },
            { label: 'Histórico de Envios' },
          ]} />
          <div className="flex items-center gap-3">
            <button onClick={load} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: PRIMARY_BLUE }}>
              <RefreshCw size={13} />
              Atualizar
            </button>
            <HeaderActions />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {loading ? (
            <ListSkeleton rows={6} />
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-slate-400 dark:text-slate-500 text-sm">
              Nenhum envio registrado.
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl">
              {logs.map((log) => {
                const isErro = log.status === 'falha'
                return (
                  <div
                    key={log.id}
                    className={`border rounded-lg p-4 bg-white dark:bg-slate-800 shadow-sm ${isErro ? 'border-red-100 dark:border-red-800' : 'border-slate-100 dark:border-slate-700'}`}
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
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={log.status} />
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                        {log.qtd_arquivos_ok} arquivo{log.qtd_arquivos_ok !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {log.mensagem_erro && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mb-1 leading-relaxed">{log.mensagem_erro}</p>
                    )}
                    {log.indicadores_enviados.length > 0 && (
                      <div className="pt-2 mt-1 border-t border-slate-50 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                        Ind: {log.indicadores_enviados.join(', ')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
