import { NavLink } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import posthog from 'posthog-js'
import { useTheme } from '../context/ThemeContext'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/categories', label: 'Categories', end: false },
  { to: '/faq', label: 'FAQ', end: false },
]

export default function Navbar() {
  const { theme, toggle } = useTheme()

  return (
    <nav className="sticky top-0 z-[100] bg-stone-50 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700 h-[52px] flex items-center px-6 gap-8 transition-colors duration-200">
      {/* Logo */}
      <NavLink to="/" className="shrink-0 flex flex-col gap-0.5">
        <span className="text-sm font-black tracking-[0.1em] text-gray-900 dark:text-stone-100 uppercase leading-none">
          UNIQLO
        </span>
        <span className="text-[8px] font-bold tracking-[0.2em] text-red-700 uppercase leading-none">
          PRICE TRACKER
        </span>
      </NavLink>

      {/* Nav links */}
      <div className="flex gap-5 flex-1">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `text-[13px] tracking-[0.01em] transition-colors ${
                isActive
                  ? 'font-semibold text-red-700'
                  : 'font-normal text-gray-500 dark:text-stone-400 hover:text-gray-900 dark:hover:text-stone-100'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={() => {
          posthog.capture('theme_toggled', { new_theme: theme === 'dark' ? 'light' : 'dark' })
          toggle()
        }}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="ml-auto shrink-0 flex items-center justify-center w-8 h-8 rounded-none border border-stone-200 dark:border-stone-700 text-gray-500 dark:text-stone-400 hover:text-gray-900 dark:hover:text-stone-100 hover:border-gray-400 dark:hover:border-stone-500 bg-transparent transition-colors duration-150 cursor-pointer"
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </nav>
  )
}
