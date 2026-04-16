import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { getClients } from '../lib/api'

export default function Sidebar() {
  const [clients, setClients] = useState([])
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    getClients().then(setClients).catch(console.error)
  }, [])

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <aside className="w-56 bg-surface-card border-r border-surface-border flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-surface-border">
        <span className="font-mono text-accent font-medium tracking-tight">
          DocuExtract
        </span>
      </div>

      {/* Client list */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs text-white/40 uppercase tracking-wider px-2 mb-2">
          Clients
        </p>
        {clients.map((client) => {
          const isActive = location.search.includes(`client=${client.id}`)
          return (
            <NavLink
              key={client.id}
              to={`/dashboard?client=${client.id}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-accent-muted text-accent'
                  : 'text-white/60 hover:bg-surface-raised hover:text-white'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-surface-raised flex items-center justify-center text-[10px] font-mono text-white/60 flex-shrink-0">
                {client.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate">{client.name}</span>
            </NavLink>
          )
        })}
        {clients.length === 0 && (
          <p className="text-xs text-white/20 px-2 py-1">No clients found</p>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-surface-border">
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-surface-raised transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
