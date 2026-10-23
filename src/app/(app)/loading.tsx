export default function AppLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-pulse" aria-busy="true" aria-label="Loading content">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-slate-200" />
          <div className="h-4 w-72 rounded bg-slate-100" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-lg bg-slate-200" />
          <div className="h-9 w-32 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* Metrics / KPI skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 rounded bg-slate-200" />
              <div className="h-7 w-7 rounded-lg bg-slate-100" />
            </div>
            <div className="mt-3 h-6 w-16 rounded bg-slate-300" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Filter / Search Bar skeleton */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-9 w-64 rounded-lg bg-slate-100" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 rounded-lg bg-slate-100" />
            <div className="h-9 w-28 rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>

      {/* Table / List skeleton */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex gap-4">
          <div className="h-4 w-16 rounded bg-slate-200" />
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-4 w-48 rounded bg-slate-200" />
          <div className="h-4 w-24 rounded bg-slate-200 ml-auto" />
        </div>
        <div className="divide-y divide-slate-100 p-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3.5">
              <div className="h-4 w-12 rounded bg-slate-200" />
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-4 w-60 rounded bg-slate-100" />
              <div className="h-5 w-20 rounded-full bg-slate-200 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
