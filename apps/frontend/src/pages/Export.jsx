import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getJobStatus, downloadExport } from '../lib/api'

export default function Export() {
  const { jobId } = useParams()
  const navigate  = useNavigate()

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn:  () => getJobStatus(jobId),
  })

  async function handleDownload() {
    try {
      const blob     = await downloadExport(jobId)
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = `export_${job?.outletCode ?? jobId}_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const approvedRows = job?.approvedRows ?? 0
  const totalRows    = job?.totalRows ?? 0
  const reviewRows   = job?.reviewRows ?? 0
  const autoRate     = totalRows > 0 ? Math.round((approvedRows / totalRows) * 100) : 0
  const hoursSaved   = totalRows > 0 ? ((totalRows / 20) * 0.5).toFixed(1) : '—'

  return (
    <div className="max-w-lg space-y-8">
      {/* Header */}
      <div>
        <p className="text-white/40 text-sm mb-1">Processing complete</p>
        <h1 className="text-xl font-medium text-white">Ready to export</h1>
        {job?.originalFilename && (
          <p className="text-white/30 text-xs font-mono mt-1 truncate">
            {job.originalFilename}
          </p>
        )}
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-card border border-surface-border rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-surface-raised rounded w-20 mb-2" />
              <div className="h-7 bg-surface-raised rounded w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total transactions',   value: totalRows },
            { label: 'Auto-approved',        value: `${autoRate}%` },
            { label: 'Human reviewed',       value: reviewRows },
            { label: 'Estimated time saved', value: `${hoursSaved} hrs` },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-surface-card border border-surface-border rounded-xl p-4"
            >
              <p className="text-white/40 text-xs mb-1">{label}</p>
              <p className="font-mono text-2xl font-medium text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Download — xlsx only (server only generates xlsx) */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-3">
        <p className="text-sm text-white/40 mb-4">Download your export</p>
        <button
          onClick={handleDownload}
          className="w-full bg-accent hover:bg-accent/90 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
          disabled={isLoading}
        >
          Download Excel (.xlsx)
        </button>
        <p className="text-xs text-white/20 text-center">
          Contains all approved and reviewed transactions
        </p>
      </div>

      <button
        onClick={() => navigate('/dashboard')}
        className="text-sm text-white/30 hover:text-white/60 transition-colors"
      >
        ← Back to dashboard
      </button>
    </div>
  )
}
