import { useState, useEffect } from 'react'
import { getAuditLogs } from '../lib/api'

const ACTION_LABELS = {
  upload_document: 'Upload Document',
  approve_row:     'Approve Row',
  complete_review: 'Complete Review',
  export_job:      'Export Job',
  retry_job:       'Retry Job',
}

const ACTION_COLORS = {
  upload_document: 'text-blue-400 bg-blue-400/10',
  approve_row:     'text-teal-400 bg-teal-400/10',
  complete_review: 'text-green-400 bg-green-400/10',
  export_job:      'text-purple-400 bg-purple-400/10',
  retry_job:       'text-amber-400 bg-amber-400/10',
}

function formatDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export default function AuditLog() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    getAuditLogs()
      .then(setLogs)
      .catch((err) => setError(err.message || 'Failed to load audit logs'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium text-white">Audit Log</h1>
        <p className="text-white/40 text-sm mt-1">Track who did what and when</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && logs.length === 0 && (
        <div className="text-center py-20">
          <p className="text-white/40 text-sm">No activity recorded yet</p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40 uppercase tracking-wider font-medium">
              Recent Activity
            </p>
            <p className="text-xs text-white/30">{logs.length} entries</p>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-raised/40">
                    <th className="text-left text-white/40 font-normal px-6 py-4">Date / Time</th>
                    <th className="text-left text-white/40 font-normal px-6 py-4">User</th>
                    <th className="text-left text-white/40 font-normal px-6 py-4">Action</th>
                    <th className="text-left text-white/40 font-normal px-6 py-4">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-raised/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-white/50 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-xs text-white/70">
                        {log.userEmail}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${ACTION_COLORS[log.action] ?? 'text-white/50 bg-surface-raised'}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-white/40 truncate max-w-xs">
                        {log.detail ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
