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
      background: '#FCFAF9',
      borderBottom: '1px solid #E8E4DF',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 32,
    }}>
      {/* Logo */}
      <NavLink to="/" style={{ flexShrink: 0, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: '0.1em',
          color: '#111',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          UNIQLO
        </span>
        <span style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: '#B3001B',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          PRICE TRACKER
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
              color: isActive ? '#B3001B' : '#666',
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
          background: '#26547C',
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
