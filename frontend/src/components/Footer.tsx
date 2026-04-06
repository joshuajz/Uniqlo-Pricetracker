export default function Footer() {
  return (
    <footer className="border-t border-stone-200 dark:border-stone-700 px-6 py-5 flex justify-between items-center bg-stone-50 dark:bg-stone-900 text-xs text-gray-400 dark:text-stone-500 transition-colors duration-200">
      <span>
        <strong className="text-gray-600 dark:text-stone-300 font-semibold">Uniqlo Price Tracker</strong>
        {' '}— Updated daily. Not affiliated with Uniqlo Co., Ltd.
      </span>
      <span className="text-gray-300 dark:text-stone-600">© 2026</span>
    </footer>
  )
}
