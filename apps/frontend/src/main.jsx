import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import './index.css'

import Login     from './pages/Login'
import Register  from './pages/Register'
import Dashboard from './pages/Dashboard'
import JobStatus   from './pages/JobStatus'
import JobDetails  from './pages/JobDetails'
import Review      from './pages/Review'
import Export      from './pages/Export'
import AppShell  from './components/AppShell'

const queryClient = new QueryClient()

const isLoggedIn = () => !!localStorage.getItem('token')

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid rgba(255,255,255,0.08)', fontSize: '13px' },
          success: { iconTheme: { primary: '#a6e3a1', secondary: '#1e1e2e' } },
          error:   { iconTheme: { primary: '#f38ba8', secondary: '#1e1e2e' } },
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"             element={<Dashboard />} />
            <Route path="jobs/:jobId"            element={<JobStatus />} />
            <Route path="jobs/:jobId/details"    element={<JobDetails />} />
            <Route path="jobs/:jobId/review"     element={<Review />} />
            <Route path="jobs/:jobId/export"     element={<Export />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
