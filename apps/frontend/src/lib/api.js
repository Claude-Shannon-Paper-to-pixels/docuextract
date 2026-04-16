const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function headers() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...options.headers },
  })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Auth
export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })

export const register = (email, password, role = 'reviewer') =>
  request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, role }) })

// Clients
export const getClients = () => request('/clients')

// Jobs — /jobs returns all jobs for the JWT user's associated client
export const getJobs = () => request('/jobs')

export const uploadPDF = (file) => {
  const form = new FormData()
  form.append('file', file)
  const token = localStorage.getItem('token')
  return fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  }).then((r) => {
    if (r.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    if (!r.ok) return r.text().then((t) => { throw new Error(t) })
    return r.json()
  })
}

export const getJobStatus = (jobId) => request(`/jobs/${jobId}/status`)

// All extracted rows for a job (optional status filter: raw | approved | needs_review | reviewed)
export const getJobRows = (jobId, status) =>
  request(`/jobs/${jobId}/rows${status ? `?status=${status}` : ''}`)

// Review — returns { total, rows }
export const getPendingRows = (jobId) => request(`/jobs/${jobId}/rows/pending`)

export const getReviewSummary = (jobId) => request(`/jobs/${jobId}/review-summary`)

export const approveRow = (jobId, rowId, data) =>
  request(`/jobs/${jobId}/rows/${rowId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

export const bulkApproveRows = (jobId, data) =>
  request(`/jobs/${jobId}/rows/bulk-approve`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

// Export — backend only supports xlsx
export const downloadExport = (jobId) =>
  fetch(`${BASE}/jobs/${jobId}/export`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  }).then((r) => {
    if (r.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    if (!r.ok) throw new Error('Export failed')
    return r.blob()
  })
