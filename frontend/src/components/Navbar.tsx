import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/categories', label: 'Categories', end: false },
  { to: '/dashboard', label: 'Dashboard', end: false },
  { to: '/faq', label: 'FAQ', end: false },
]

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-[100] bg-stone-50 border-b border-stone-200 h-[52px] flex items-center px-6 gap-8">
      {/* Logo */}
      <NavLink to="/" className="shrink-0 flex flex-col gap-0.5">
        <span className="text-sm font-black tracking-[0.1em] text-gray-900 uppercase leading-none">
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
              `text-[13px] tracking-[0.01em] transition-colors ${isActive ? 'font-semibold text-red-700' : 'font-normal text-gray-500'}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>

    </nav>
  )
}
