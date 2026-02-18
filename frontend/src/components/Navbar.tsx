import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/categories', label: 'Categories', end: false },
  { to: '/dashboard', label: 'Dashboard', end: false },
  { to: '/faq', label: 'FAQ', end: false },
]

export default function Navbar() {
  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: '#fff',
      borderBottom: '1px solid #e8e8e8',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 32,
    }}>
      {/* Logo */}
      <NavLink to="/" style={{ flexShrink: 0 }}>
        <span style={{
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '0.12em',
          color: '#111',
          textTransform: 'uppercase',
        }}>
          Uniqlo <span style={{ color: '#dc2626' }}>Tracker</span>
        </span>
      </NavLink>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: 20, flex: 1 }}>
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            style={({ isActive }) => ({
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#dc2626' : '#666',
              letterSpacing: '0.01em',
              transition: 'color 0.1s',
            })}
          >
            {link.label}
          </NavLink>
        ))}
      </div>

      {/* User pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.05em',
        }}>
          JD
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#444' }}>Josh</span>
      </div>
    </nav>
  )
}
