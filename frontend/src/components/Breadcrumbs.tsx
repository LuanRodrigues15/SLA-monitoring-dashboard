import { useNavigate } from 'react-router-dom'
import { BarChart2 } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  to?: string
  onClick?: () => void
}

interface Props {
  items: BreadcrumbItem[]
}

const PRIMARY_BLUE = '#205DF5'

export function Breadcrumbs({ items }: Props) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center gap-2 text-sm min-w-0">
      <button
        onClick={() => navigate('/menu')}
        className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-empresa-blue"
        style={{ backgroundColor: PRIMARY_BLUE }}
        title="Ir para o menu"
      >
        <BarChart2 size={16} className="text-white" />
      </button>

      <div className="flex items-center gap-1.5 min-w-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const action = item.onClick ?? (item.to ? () => navigate(item.to!) : undefined)

          return (
            <div key={`${item.label}-${index}`} className="flex items-center gap-1.5 min-w-0">
              {action && !isLast ? (
                <button
                  onClick={action}
                  className="font-semibold text-slate-500 hover:text-empresa-blue transition-colors px-1 py-0.5 rounded hover:bg-slate-50 truncate"
                >
                  {item.label}
                </button>
              ) : (
                <span
                  className={`px-1 py-0.5 truncate ${isLast ? 'font-bold' : 'font-semibold text-slate-500'}`}
                  style={isLast ? { color: PRIMARY_BLUE } : undefined}
                  title={item.label}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <span className="text-slate-300 font-semibold flex-shrink-0">/</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
