import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppShell() {
  return (
    <div className="flex h-screen bg-surface text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
