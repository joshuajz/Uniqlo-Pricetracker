export default function PageLoader() {
  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 pb-[60px] animate-pulse">

      {/* Header */}
      <div className="mb-8">
        <div className="h-3 w-32 bg-stone-200 dark:bg-stone-800 rounded mb-3" />
        <div className="h-9 w-64 bg-stone-200 dark:bg-stone-800 rounded" />
        <div className="h-3 w-48 bg-stone-200 dark:bg-stone-800 rounded mt-3" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-9">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-t-[3px] border-stone-200 dark:border-stone-700 pt-3">
            <div className="h-7 w-16 bg-stone-200 dark:bg-stone-800 rounded mb-2" />
            <div className="h-2.5 w-20 bg-stone-100 dark:bg-stone-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="border-t-2 border-stone-200 dark:border-stone-700 pt-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-3 border-b border-stone-100 dark:border-stone-800"
            style={{ opacity: 1 - i * 0.1 }}
          >
            <div className="w-12 h-12 bg-stone-200 dark:bg-stone-800 rounded shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-3/4" />
              <div className="h-2.5 bg-stone-100 dark:bg-stone-800/60 rounded w-1/3" />
            </div>
            <div className="text-right space-y-2 shrink-0">
              <div className="h-3 w-14 bg-stone-200 dark:bg-stone-800 rounded ml-auto" />
              <div className="h-2.5 w-10 bg-stone-100 dark:bg-stone-800/60 rounded ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
