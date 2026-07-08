import { useState } from 'react'

interface Props {
  linhas: Record<string, unknown>[]
}

export function IndicadorTable({ linhas }: Props) {
  const [filters, setFilters] = useState<Record<string, string>>({})

  if (linhas.length === 0) return <p className="text-sm text-gray-500">Sem dados disponíveis.</p>

  const cols = Object.keys(linhas[0])

  const filtered = linhas.filter((row) =>
    cols.every((col) => {
      const f = filters[col]?.toLowerCase()
      if (!f) return true
      return String(row[col] ?? '').toLowerCase().includes(f)
    })
  )

  const setFilter = (col: string, val: string) =>
    setFilters((prev) => ({ ...prev, [col]: val }))

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-empresa-blue text-white">
            {cols.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{col}</th>
            ))}
          </tr>
          <tr className="bg-gray-50 border-b border-gray-200">
            {cols.map((col) => (
              <th key={col} className="px-2 py-1">
                <input
                  type="text"
                  placeholder="filtrar…"
                  value={filters[col] ?? ''}
                  onChange={(e) => setFilter(col, e.target.value)}
                  className="w-full min-w-[60px] border border-gray-200 rounded px-1.5 py-0.5 text-[10px] text-gray-700 font-normal focus:outline-none focus:border-empresa-blue"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="px-3 py-6 text-center text-gray-400">
                Nenhum resultado para os filtros aplicados.
              </td>
            </tr>
          ) : (
            filtered.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-empresa-50' : 'bg-gray-50 hover:bg-empresa-50'}>
                {cols.map((col) => (
                  <td key={col} className="px-3 py-1.5 whitespace-nowrap transition-colors">
                    {String(row[col] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {filtered.length > 0 && filtered.length < linhas.length && (
          <tfoot>
            <tr className="bg-amber-50">
              <td colSpan={cols.length} className="px-3 py-1.5 text-[10px] text-amber-700 text-center">
                Exibindo {filtered.length} de {linhas.length} registros
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
