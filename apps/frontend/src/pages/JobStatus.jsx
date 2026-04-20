import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getJobStatus, retryJob } from '../lib/api'
import StatusBadge from '../components/StatusBadge'

const STEPS = ['queued', 'extracting', 'enriching', 'complete']

const TERMINAL = ['complete', 'pending_review', 'failed']

const STEP_LABELS = {
  queued:     'Job queued — waiting for a worker',
  extracting: 'Reading transactions from PDF…',
  enriching:  'Matching vendor codes and GL accounts…',
  complete:   'Processing complete',
}

export default function JobStatus() {
  const { jobId } = useParams()
  const navigate  = useNavigate()
  const queryClient = useQueryClient()
  const [retrying, setRetrying] = useState(false)

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn:  () => getJobStatus(jobId),
    refetchInterval: (query) =>
      TERMINAL.includes(query.state.data?.status) ? false : 3000,
  })

  useEffect(() => {
    if (!job) return
    if (job.status === 'complete') navigate(`/jobs/${jobId}/details`)
    // 'pending_review' stays on this page — shows review prompt below
  }, [job?.status])

  async function handleRetry() {
    setRetrying(true)
    try {
      await retryJob(jobId)
      toast.success('Job re-queued for processing')
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
    } catch (err) {
      toast.error(err.message || 'Retry failed')
      setRetrying(false)
    }
  }

  // Map pending_review to the last step visually
  const displayStatus = job?.status === 'pending_review' ? 'complete' : job?.status
  const currentStep   = STEPS.indexOf(displayStatus)

  return (
    <div className="max-w-xl space-y-10">
      <div>
        <p className="text-white/40 text-sm mb-1">Processing</p>
        <h1 className="text-xl font-medium text-white font-mono truncate">
          {job?.originalFilename ?? 'Loading…'}
        </h1>
        {job?.outletCode && (
          <p className="text-white/30 text-xs mt-1 font-mono">Outlet: {job.outletCode}</p>
        )}
      </div>

      {/* Progress stepper */}
      <div className="space-y-4">
        {STEPS.map((step, i) => {
          const done   = i < currentStep
          const active = i === currentStep
          return (
            <div key={step} className="flex items-start gap-4">
              <div
                className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-mono border transition-colors ${
                  done   ? 'bg-green-500 border-green-500 text-white' :
                  active ? 'border-accent text-accent animate-pulse' :
                           'border-surface-border text-white/20'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <div>
                <p
                  className={`text-sm font-medium ${
                    active ? 'text-white' : done ? 'text-white/50' : 'text-white/20'
                  }`}
                >
                  {step.charAt(0).toUpperCase() + step.slice(1)}
                </p>
                {active && (
                  <p className="text-xs text-white/40 mt-0.5">
                    {STEP_LABELS[step]}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Stats — visible once enrichment / review stage reached */}
      {job && ['pending_review', 'complete'].includes(job.status) && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total rows',    value: job.totalRows },
            { label: 'Auto-approved', value: job.approvedRows },
            { label: 'Need review',   value: job.reviewRows },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <p className="text-white/40 text-xs mb-1">{label}</p>
              <p className="font-mono text-2xl font-medium text-white">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Review prompt */}
      {job?.status === 'pending_review' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
          <p className="text-amber-400 text-sm font-medium mb-3">
            {job.reviewRows ?? 'Some'} rows need your attention
          </p>
          <button
            onClick={() => navigate(`/jobs/${jobId}/review`)}
            className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Start review →
          </button>
        </div>
      )}

      {/* Status badge */}
      {job && (
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-xs">Current status:</span>
          <StatusBadge status={job.status} />
        </div>
      )}

      {/* Error state */}
      {job?.status === 'failed' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 space-y-3">
          <p className="text-red-400 text-sm font-medium">Processing failed</p>
          {job.errorMessage && (
            <p className="text-red-400/70 text-xs font-mono">{job.errorMessage}</p>
          )}
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {retrying ? 'Re-queuing…' : '↺ Retry extraction'}
          </button>
        </div>
      )}
    </div>
  )
}
