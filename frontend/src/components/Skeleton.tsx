interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />
}

export function KpiGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-3 w-4/5 mb-3" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-20 mx-auto mt-4" />
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-72 max-w-full" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-9 w-28 mb-4" />
          <Skeleton className="h-2 w-full" />
        </div>
        <div className="col-span-12 md:col-span-5 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <Skeleton className="h-3 w-28 mb-3" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, col) => (
            <Skeleton key={col} className="h-5 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between gap-4 mb-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-5 w-36 mb-3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  )
}
