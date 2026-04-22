import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { getJobs, uploadPDF, retryJob } from '../lib/api'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const [jobs, setJobs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [retrying, setRetrying]   = useState(null)
  const navigate = useNavigate()

  function loadJobs() {
    setLoading(true)
    getJobs()
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function handleRetry(jobId) {
    setRetrying(jobId)
    try {
      await retryJob(jobId)
      toast.success('Job re-queued for processing')
      loadJobs()
      navigate(`/jobs/${jobId}`)
    } catch (err) {
      toast.error(err.message || 'Retry failed')
    } finally {
      setRetrying(null)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: async ([file]) => {
      if (!file) return
      setUploading(true)
      setUploadError('')
      try {
        const { jobId } = await uploadPDF(file)
        navigate(`/jobs/${jobId}`)
      } catch (err) {
        setUploadError(err.message || 'Upload failed. Please try again.')
        setUploading(false)
      }
    },
  })

  // Calculate stats from jobs array
  const stats = {
    submitted: jobs.length,
    underReview: jobs.filter(j => j.status === 'pending_review').length,
    completed: jobs.filter(j => j.status === 'complete').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-white">Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">Manage your document uploads and processing jobs</p>
        </div>
      </div>

      {/* Professional Upload Section */}
      <div
        {...getRootProps()}
        className={`rounded-xl border border-dashed transition-all cursor-pointer group ${
          isDragActive
            ? 'border-accent bg-accent/5 scale-[1.02]'
            : 'border-surface-border hover:border-accent/50 hover:bg-surface-raised/30'
        }`}
      >
        <input {...getInputProps()} />
        
        {uploading ? (
          <div className="px-8 py-8 flex items-center justify-center">
            <div className="loader" style={{ fontSize: '18px' }} />
          </div>
        ) : isDragActive ? (
          <div className="px-8 py-8 flex items-center justify-center">
            <div className="text-center">
              <p className="text-accent text-sm font-medium">Drop your PDF here</p>
            </div>
          </div>
        ) : (
          <div className="px-8 py-8 flex items-center gap-6">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <svg className="h-6 w-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium text-sm">
                Drag a vendor statement PDF here, or <span className="text-accent">click to browse</span>
              </p>
              <p className="text-white/40 text-xs mt-1">
                Tip: Include the outlet code in the filename (e.g., MCT_F5063_Dec2025.pdf)
              </p>
            </div>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
          <p className="text-red-400 text-sm">{uploadError}</p>
        </div>
      )}

      {/* Stats Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="loader" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-surface-card border border-surface-border rounded-lg p-5">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Total Submitted</p>
            <p className="text-3xl font-mono font-semibold text-white">{stats.submitted}</p>
            <p className="text-white/30 text-xs mt-2">Documents uploaded</p>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-lg p-5">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Under Review</p>
            <p className="text-3xl font-mono font-semibold text-amber-400">{stats.underReview}</p>
            <p className="text-white/30 text-xs mt-2">Waiting for approval</p>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-lg p-5">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Completed</p>
            <p className="text-3xl font-mono font-semibold text-green-400">{stats.completed}</p>
            <p className="text-white/30 text-xs mt-2">Ready to export</p>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-lg p-5">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Failed</p>
            <p className="text-3xl font-mono font-semibold text-red-400">{stats.failed}</p>
            <p className="text-white/30 text-xs mt-2">Processing errors</p>
          </div>
        </div>
      )}

      {/* Job History Table */}
      {!loading && jobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-white/40 uppercase tracking-wider font-medium">
              All Jobs
            </h2>
            <p className="text-xs text-white/30">
              Showing {jobs.length} result{jobs.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-raised/40">
                    <th className="text-left text-white/40 font-normal px-6 py-4">File Name</th>
                    <th className="text-left text-white/40 font-normal px-6 py-4">Submitted</th>
                    <th className="text-left text-white/40 font-normal px-6 py-4">Status</th>
                    <th className="text-left text-white/40 font-normal px-6 py-4">Rows</th>
                    <th className="text-left text-white/40 font-normal px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="hover:bg-surface-raised/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-white/70 truncate max-w-xs">
                        {job.originalFilename}
                      </td>
                      <td className="px-6 py-4 text-white/50 text-xs">
                        {new Date(job.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-white/50">
                        <span className="bg-surface-raised px-2.5 py-1 rounded text-white/60">
                          {job.totalRows ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {job.status === 'failed' ? (
                          <button
                            onClick={() => handleRetry(job.id)}
                            disabled={retrying === job.id}
                            className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors disabled:opacity-50"
                          >
                            {retrying === job.id ? 'Retrying…' : 'Retry ↺'}
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(job.status === 'pending_review' ? `/jobs/${job.id}/review` : `/jobs/${job.id}/details`)}
                            className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
                          >
                            {job.status === 'pending_review' ? 'Start Review →' : 'View Details →'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && jobs.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-block mb-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-surface-raised">
              <svg className="h-8 w-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <h3 className="text-white/60 text-sm font-medium mb-1">No jobs yet</h3>
          <p className="text-white/30 text-xs">
            Upload a vendor statement PDF to get started
          </p>
        </div>
      )}
    </div>
  )
}
