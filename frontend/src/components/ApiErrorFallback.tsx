interface ApiErrorFallbackProps {
  onRetry: () => void
}

export default function ApiErrorFallback({ onRetry }: ApiErrorFallbackProps) {
  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 pb-[60px]">

      {/* Title skeleton mirroring the real masthead */}
      <div className="pt-6 pb-5 border-b border-stone-200 dark:border-stone-700 mb-8">
        <h1 className="text-[36px] sm:text-[52px] font-black tracking-[-0.03em] leading-none m-0">
          Uniqlo <span className="text-red-700">Tracker</span>
        </h1>
      </div>

      {/* Error card */}
      <div className="border-t-[3px] border-t-zinc-700 dark:border-t-stone-400 border border-zinc-200 dark:border-stone-700 p-8 sm:p-12 flex flex-col items-center gap-5 text-center">

        {/* Icon */}
        <div className="text-[40px] leading-none select-none">⚡</div>

        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-stone-100 mb-1">
            Server is starting up
          </p>
          <p className="text-sm text-gray-500 dark:text-stone-400 max-w-sm">
            The API is waking from sleep — this usually takes 10–20 seconds.
            Click retry to try again.
          </p>
        </div>

        <button
          onClick={onRetry}
          className="mt-1 px-5 py-2 bg-red-700 hover:bg-red-800 active:bg-red-900 text-white text-sm font-semibold tracking-wide transition-colors duration-100 cursor-pointer border-0 font-sans"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
