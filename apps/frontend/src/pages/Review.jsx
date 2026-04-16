import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getPendingRows, getReviewSummary, approveRow, bulkApproveRows } from '../lib/api'

// ── Review reason metadata ─────────────────────────────────────────────────
const REASON_META = {
  vendor_unmatched: {
    label: 'Vendor Unmatched',
    description: 'Could not find a matching vendor in the vendor master.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  gl_unmatched: {
    label: 'GL Unmatched',
    description: 'No GL account rule matched this description or vendor.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
    dot: 'bg-orange-400',
  },
  low_confidence: {
    label: 'Low Confidence',
    description: 'Gemini extraction confidence was below the threshold — verify all fields.',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    dot: 'bg-red-400',
  },
  row_count_mismatch: {
    label: 'Row Count Mismatch',
    description: 'Fewer rows were extracted than expected — PDF may be faded or low quality.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
    dot: 'bg-purple-400',
  },
}

const REASON_SUMMARY_LABELS = {
  vendor_unmatched:   'Vendor Unmatched',
  gl_unmatched:       'GL Unmatched',
  low_confidence:     'Low Confidence',
  row_count_mismatch: 'Row Mismatch',
  unknown:            'Other',
}

export default function Review() {
  const { jobId } = useParams()
  const navigate  = useNavigate()

  const [rows, setRows]             = useState([])
  const [current, setCurrent]       = useState(0)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary]       = useState(null)

  // Editable fields
  const [vendorCode, setVendorCode]               = useState('')
  const [vendorNameMatched, setVendorNameMatched] = useState('')
  const [glCode, setGlCode]                       = useState('')
  const [glLabel, setGlLabel]                     = useState('')

  const row   = rows[current]
  const total = rows.length

  const reason       = row?.reviewReason
  const reasonMeta   = REASON_META[reason] ?? null

  // Determine how many other rows share the same raw vendor name
  const sameVendorRows = rows.filter(
    (r, i) => i !== current && r.vendorNameRaw === row?.vendorNameRaw,
  )

  useEffect(() => {
    Promise.all([getPendingRows(jobId), getReviewSummary(jobId)])
      .then(([pendingData, summaryData]) => {
        const pending = pendingData.rows ?? []
        setRows(pending)
        setSummary(summaryData)
        if (pending[0]) prefill(pending[0])
      })
      .catch((err) => toast.error(err.message || 'Failed to load review data'))
      .finally(() => setLoading(false))
  }, [jobId])

  function prefill(r) {
    setVendorCode(r.vendorCode ?? '')
    setVendorNameMatched(r.vendorNameMatched ?? '')
    setGlCode(r.glCode ?? '')
    setGlLabel(r.glLabel ?? '')
  }

  // All rows require vendorCode, vendorName, glCode, and glLabel
  function isValid() {
    if (!vendorCode.trim() || !vendorNameMatched.trim()) return false
    if (!glCode.trim() || !glLabel.trim()) return false
    return true
  }

  async function handleApprove() {
    if (!isValid()) return
    setSubmitting(true)
    try {
      const payload = { vendorCode, vendorNameMatched, glCode, glLabel }
      await approveRow(jobId, row.id, payload)
      toast.success('Row approved')
      advance()
    } catch (err) {
      toast.error(err.message || 'Failed to save — check all required fields')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBulkApprove() {
    if (!isValid() || sameVendorRows.length === 0) return
    setSubmitting(true)
    try {
      const payload = {
        vendorNameRaw: row.vendorNameRaw,
        vendorCode,
        vendorNameMatched,
        glCode,
        glLabel,
      }
      const { updatedCount } = await bulkApproveRows(jobId, payload)
      toast.success(`Bulk approved ${updatedCount} rows for "${row.vendorNameRaw}"`)
      // Reload pending rows after bulk
      setLoading(true)
      const data = await getPendingRows(jobId)
      const pending = data.rows ?? []
      setRows(pending)
      const summaryData = await getReviewSummary(jobId)
      setSummary(summaryData)
      if (pending.length === 0) {
        navigate(`/jobs/${jobId}/export`)
      } else {
        setCurrent(0)
        prefill(pending[0])
      }
    } catch (err) {
      toast.error(err.message || 'Bulk approve failed')
    } finally {
      setSubmitting(false)
      setLoading(false)
    }
  }

  function handleSkip() {
    advance()
  }

  function advance() {
    const next = current + 1
    if (next >= total) {
      navigate(`/jobs/${jobId}/export`)
    } else {
      setCurrent(next)
      prefill(rows[next])
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin mx-auto mb-3" />
          <p className="text-white/40 text-sm">Loading rows…</p>
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="max-w-md space-y-4">
        <p className="text-white/60 text-sm">No rows need review for this job.</p>
        <button
          onClick={() => navigate(`/jobs/${jobId}/export`)}
          className="text-sm text-accent hover:underline"
        >
          Go to export →
        </button>
      </div>
    )
  }

  if (current >= total) return null

  const amountStr = row.debit != null
    ? `RM ${Number(row.debit).toFixed(2)} Dr`
    : row.credit != null
      ? `RM ${Number(row.credit).toFixed(2)} Cr`
      : '—'

  return (
    <div className="max-w-5xl flex flex-col gap-5">

      {/* Progress + summary bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/jobs/${jobId}/details`)}
          className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1 flex-shrink-0"
        >
          ← Back
        </button>
        <p className="text-sm text-white/40 whitespace-nowrap">
          Reviewing{' '}
          <span className="text-white font-mono">{current + 1}</span> of{' '}
          <span className="text-white font-mono">{total}</span>
        </p>
        <div className="flex-1 h-1 bg-surface-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${((current) / total) * 100}%` }}
          />
        </div>

        {/* Summary pills */}
        {summary && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {Object.entries(summary.byReason)
              .filter(([, count]) => count > 0)
              .map(([key, count]) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    REASON_META[key]?.bg ?? 'bg-white/5 border-white/10 text-white/40'
                  } ${REASON_META[key]?.color ?? 'text-white/40'}`}
                >
                  <span className={`w-1 h-1 rounded-full ${REASON_META[key]?.dot ?? 'bg-white/30'}`} />
                  {REASON_SUMMARY_LABELS[key] ?? key} ({count})
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Review reason banner */}
      {reasonMeta && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${reasonMeta.bg}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${reasonMeta.dot}`} />
          <div>
            <p className={`text-xs font-semibold ${reasonMeta.color}`}>{reasonMeta.label}</p>
            <p className="text-xs text-white/50 mt-0.5">{reasonMeta.description}</p>
          </div>
        </div>
      )}

      {/* Split view */}
      <div className="flex gap-6">

        {/* Left: transaction context */}
        <div className="flex-1 bg-surface-card border border-surface-border rounded-xl p-6 space-y-4">
          <p className="text-xs text-white/40 uppercase tracking-wider">Transaction details</p>

          <div className="space-y-3">
            {[
              { label: 'Date',         value: row.date ? new Date(row.date).toLocaleDateString() : '—' },
              { label: 'Description',  value: row.documentDescription },
              { label: 'Vendor (raw)', value: row.vendorNameRaw },
              { label: 'Amount',       value: amountStr },
              { label: 'Category',     value: row.documentCategory },
              { label: 'Invoice #',    value: row.invoiceNumber ?? row.cnNumber ?? '—' },
              { label: 'Page',         value: row.pageNumber ?? '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-white/30 mb-0.5">{label}</p>
                <p className="text-sm text-white font-mono break-all">{value ?? '—'}</p>
              </div>
            ))}
          </div>

          {/* Confidence indicator */}
          {row.confidence != null && (
            <div className="pt-2 border-t border-surface-border">
              <p className="text-xs text-white/30 mb-1">Extraction confidence</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      row.confidence < 0.6 ? 'bg-red-400' :
                      row.confidence < 0.8 ? 'bg-amber-400' :
                      'bg-green-400'
                    }`}
                    style={{ width: `${Math.round(row.confidence * 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-mono ${
                  row.confidence < 0.6 ? 'text-red-400' :
                  row.confidence < 0.8 ? 'text-amber-400' :
                  'text-green-400'
                }`}>
                  {Math.round(row.confidence * 100)}%
                </span>
              </div>
            </div>
          )}

          {row.extractionRemarks && (
            <div className="pt-2 border-t border-surface-border">
              <p className="text-xs text-white/30 mb-1">Extraction remarks</p>
              <p className="text-xs text-amber-400/80 font-mono">{row.extractionRemarks}</p>
            </div>
          )}

          {/* Bulk approve hint */}
          {sameVendorRows.length > 0 && (
            <div className="pt-2 border-t border-surface-border">
              <p className="text-xs text-white/30">
                <span className="text-accent font-medium">{sameVendorRows.length}</span> other row{sameVendorRows.length > 1 ? 's' : ''} share this vendor name.
                Use <span className="text-accent">Bulk Approve</span> to apply the same codes to all of them at once.
              </p>
            </div>
          )}
        </div>

        {/* Right: correction form */}
        <div className="w-80 flex flex-col gap-4">
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-4">
            <p className="text-xs text-white/40 uppercase tracking-wider">Assign codes</p>

            {/* Vendor code */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5">
                Vendor code
                {!row.vendorCode && <span className="ml-2 text-amber-400">· missing</span>}
              </label>
              <input
                type="text"
                value={vendorCode}
                onChange={(e) => setVendorCode(e.target.value)}
                placeholder="e.g. 4000/I01"
                className={`w-full bg-surface-raised border rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent transition-colors font-mono ${
                  !vendorCode.trim() ? 'border-amber-500/50' : 'border-surface-border'
                }`}
              />
            </div>

            {/* Vendor name */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Vendor name (matched)</label>
              <input
                type="text"
                value={vendorNameMatched}
                onChange={(e) => setVendorNameMatched(e.target.value)}
                placeholder="e.g. ILT OPTICS (M) SDN BHD"
                className={`w-full bg-surface-raised border rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent transition-colors font-mono ${
                  !vendorNameMatched.trim() ? 'border-amber-500/50' : 'border-surface-border'
                }`}
              />
            </div>

            {/* GL fields — required for ALL rows including PAYMENT */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5">
                GL account code
                {!row.glCode && <span className="ml-2 text-amber-400">· missing</span>}
              </label>
              <input
                type="text"
                value={glCode}
                onChange={(e) => setGlCode(e.target.value)}
                placeholder="e.g. 6011/000"
                className={`w-full bg-surface-raised border rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent transition-colors font-mono ${
                  !glCode.trim() ? 'border-amber-500/50' : 'border-surface-border'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">GL account description</label>
              <input
                type="text"
                value={glLabel}
                onChange={(e) => setGlLabel(e.target.value)}
                placeholder="e.g. Purchases - Other Supplies"
                className={`w-full bg-surface-raised border rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent transition-colors font-mono ${
                  !glLabel.trim() ? 'border-amber-500/50' : 'border-surface-border'
                }`}
              />
            </div>
          </div>

          {/* Approve single */}
          <button
            onClick={handleApprove}
            disabled={!isValid() || submitting}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            {submitting ? 'Saving…' : 'Approve →'}
          </button>

          {/* Bulk approve — only shown when other rows share same vendor */}
          {sameVendorRows.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={!isValid() || submitting}
              className="w-full bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              {submitting ? 'Saving…' : `Bulk Approve all ${sameVendorRows.length + 1} rows →`}
            </button>
          )}

          <button
            onClick={handleSkip}
            disabled={submitting}
            className="w-full text-center text-xs text-white/30 hover:text-white/60 transition-colors py-1 disabled:opacity-40"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
