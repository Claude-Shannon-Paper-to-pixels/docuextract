import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getPendingRows, getReviewSummary, approveRow } from '../lib/api'

const REASON_META = {
  vendor_unmatched: {
    label: 'Vendor Unmatched',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  gl_unmatched: {
    label: 'GL Unmatched',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
    dot: 'bg-orange-400',
  },
  low_confidence: {
    label: 'Low Confidence',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    dot: 'bg-red-400',
  },
  row_count_mismatch: {
    label: 'Row Mismatch',
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

function EditableCell({ value, onChange, highlight, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-transparent border rounded px-2 py-1 text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-accent transition-colors min-w-[110px] ${
        highlight
          ? 'border-amber-500/60 bg-amber-500/8'
          : 'border-surface-border hover:border-white/20 focus:border-accent'
      }`}
    />
  )
}

export default function Review() {
  const { jobId } = useParams()
  const navigate  = useNavigate()

  const [rows, setRows]         = useState([])
  const [edits, setEdits]       = useState({})
  const [approved, setApproved] = useState(new Set())
  const [saving, setSaving]     = useState(new Set())
  const [loading, setLoading]   = useState(true)
  const [summary, setSummary]   = useState(null)

  function initialEdit(r) {
    return {
      vendorCode:          r.vendorCode          ?? '',
      vendorNameMatched:   r.vendorNameMatched   ?? '',
      glCode:              r.glCode              ?? '',
      glLabel:             r.glLabel             ?? '',
      date:                r.date ? r.date.slice(0, 10) : '',
      documentDescription: r.documentDescription ?? '',
      documentType:        r.documentType        ?? '',
      documentCategory:    r.documentCategory    ?? '',
      invoiceNumber:       r.invoiceNumber       ?? '',
      cnNumber:            r.cnNumber            ?? '',
      debit:               r.debit  != null ? String(r.debit)  : '',
      credit:              r.credit != null ? String(r.credit) : '',
      outletCode:          r.outletCode          ?? '',
      pageNumber:          r.pageNumber != null  ? String(r.pageNumber) : '',
      extractionRemarks:   r.extractionRemarks   ?? '',
    }
  }

  useEffect(() => {
    Promise.all([getPendingRows(jobId), getReviewSummary(jobId)])
      .then(([pendingData, summaryData]) => {
        const pending = pendingData.rows ?? []
        setRows(pending)
        setSummary(summaryData)
        const initial = {}
        for (const r of pending) {
          initial[r.id] = initialEdit(r)
        }
        setEdits(initial)
      })
      .catch((err) => toast.error(err.message || 'Failed to load review data'))
      .finally(() => setLoading(false))
  }, [jobId])

  function getEdit(rowId) {
    return edits[rowId] ?? { vendorCode: '', vendorNameMatched: '', glCode: '', glLabel: '', date: '', documentDescription: '', documentType: '', documentCategory: '', invoiceNumber: '', cnNumber: '', debit: '', credit: '', outletCode: '', pageNumber: '', extractionRemarks: '' }
  }

  function updateEdit(rowId, field, value) {
    setEdits((prev) => ({
      ...prev,
      [rowId]: { ...getEdit(rowId), ...prev[rowId], [field]: value },
    }))
  }

  function isRowValid(rowId) {
    const e = getEdit(rowId)
    return (
      e.vendorCode.trim() &&
      e.vendorNameMatched.trim() &&
      e.glCode.trim() &&
      e.glLabel.trim()
    )
  }

  async function handleApproveRow(rowId) {
    if (!isRowValid(rowId)) return
    setSaving((prev) => new Set(prev).add(rowId))
    try {
      await approveRow(jobId, rowId, getEdit(rowId))
      setApproved((prev) => new Set(prev).add(rowId))
      toast.success('Row approved')
    } catch (err) {
      toast.error(err.message || 'Failed to save row')
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(rowId); return n })
    }
  }

  async function handleApproveAll() {
    const pending = rows.filter((r) => !approved.has(r.id) && isRowValid(r.id))
    if (pending.length === 0) return

    // Mark all as saving
    setSaving(new Set(pending.map((r) => r.id)))

    const results = await Promise.allSettled(
      pending.map((r) => approveRow(jobId, r.id, getEdit(r.id)).then(() => r.id))
    )

    const succeeded = new Set()
    let failCount = 0
    for (const result of results) {
      if (result.status === 'fulfilled') succeeded.add(result.value)
      else failCount++
    }

    setApproved((prev) => new Set([...prev, ...succeeded]))
    setSaving(new Set())

    if (failCount > 0) toast.error(`${failCount} row(s) failed to save`)
    else toast.success(`All ${succeeded.size} rows approved!`)
  }

  const approvedCount      = approved.size
  const pendingCount       = rows.length - approvedCount
  const validPendingCount  = rows.filter((r) => !approved.has(r.id) && isRowValid(r.id)).length

  // Auto-navigate when everything is approved
  useEffect(() => {
    if (rows.length > 0 && approvedCount === rows.length) {
      toast.success('All rows reviewed! Redirecting to export…')
      const t = setTimeout(() => navigate(`/jobs/${jobId}/export`), 1200)
      return () => clearTimeout(t)
    }
  }, [approvedCount, rows.length, jobId, navigate])

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

  if (rows.length === 0) {
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

  return (
    <div className="w-full flex flex-col gap-5">

      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate(`/jobs/${jobId}/details`)}
          className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1 flex-shrink-0"
        >
          ← Back
        </button>

        <h1 className="text-lg font-medium text-white">Review Queue</h1>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-28 h-1.5 bg-surface-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${rows.length ? (approvedCount / rows.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-white/40 whitespace-nowrap">
            <span className="text-white font-mono">{approvedCount}</span>
            <span> / </span>
            <span className="font-mono">{rows.length}</span>
            <span className="ml-1">approved</span>
          </span>
        </div>

        {/* Reason summary pills */}
        {summary && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(summary.byReason)
              .filter(([, count]) => count > 0)
              .map(([key, count]) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    REASON_META[key]?.bg ?? 'bg-white/5 border-white/10'
                  } ${REASON_META[key]?.color ?? 'text-white/40'}`}
                >
                  <span className={`w-1 h-1 rounded-full ${REASON_META[key]?.dot ?? 'bg-white/30'}`} />
                  {REASON_SUMMARY_LABELS[key] ?? key} ({count})
                </span>
              ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {approvedCount === rows.length ? (
            <button
              onClick={() => navigate(`/jobs/${jobId}/export`)}
              className="bg-green-500 hover:bg-green-400 text-black font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Go to Export →
            </button>
          ) : (
            <button
              onClick={handleApproveAll}
              disabled={validPendingCount === 0}
              className="bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Approve All Valid ({validPendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Column legend */}
      <div className="flex items-center gap-5 text-[11px] text-white/30 px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded border border-amber-500/60 bg-amber-500/10" />
          Needs attention — fill in before approving
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Vendor columns
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          GL columns
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded border border-green-500/40 bg-green-500/10" />
          Approved
        </span>
      </div>

      {/* Review table */}
      <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-surface-raised sticky top-0 z-10">
                {/* Read-only context columns */}
                <th className="text-left text-white/40 font-normal px-4 py-3 whitespace-nowrap">Company</th>
                <th className="text-left text-white/40 font-normal px-4 py-3 whitespace-nowrap">File Name</th>
                <th className="text-left text-white/40 font-normal px-4 py-3 whitespace-nowrap">Reason</th>
                {/* Editable columns — highlighted headers */}
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="text-white/40">Outlet Code</span>
                </th>
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="text-white/40">Doc Category</span>
                </th>
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="text-white/40">Date</span>
                </th>
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="text-white/40">Invoice #</span>
                </th>
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="text-white/40">CN #</span>
                </th>
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="text-white/40">Doc Type</span>
                </th>
                <th className="text-left font-normal px-4 py-3 min-w-[180px]">
                  <span className="text-white/40">Description</span>
                </th>
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-1 text-amber-400/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Vendor Code
                  </span>
                </th>
                <th className="text-left font-normal px-4 py-3 min-w-[140px]">
                  <span className="flex items-center gap-1 text-amber-400/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Vendor Name
                  </span>
                </th>
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-1 text-orange-400/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    Account Code
                  </span>
                </th>
                <th className="text-left font-normal px-4 py-3 min-w-[140px]">
                  <span className="flex items-center gap-1 text-orange-400/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    Account Desc.
                  </span>
                </th>
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="text-white/40">Debit</span>
                </th>
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="text-white/40">Credit</span>
                </th>
                <th className="text-left font-normal px-4 py-3 whitespace-nowrap">
                  <span className="text-white/40">Page #</span>
                </th>
                <th className="text-left font-normal px-4 py-3 min-w-[140px]">
                  <span className="text-white/40">Extraction Remarks</span>
                </th>
                <th className="text-left text-white/40 font-normal px-4 py-3 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {rows.map((row) => {
                const edit        = getEdit(row.id)
                const isApproved  = approved.has(row.id)
                const isSaving    = saving.has(row.id)
                const isValid     = isRowValid(row.id)
                const meta        = REASON_META[row.reviewReason]

                const vendorFlag  = row.reviewReason === 'vendor_unmatched' || row.reviewReason === 'low_confidence'
                const glFlag      = row.reviewReason === 'gl_unmatched'     || row.reviewReason === 'low_confidence'

                const cell = (field, placeholder, highlight = false) =>
                  isApproved ? (
                    <span className="font-mono text-green-400/70 text-xs">{edit[field] || '—'}</span>
                  ) : (
                    <EditableCell
                      value={edit[field]}
                      onChange={(v) => updateEdit(row.id, field, v)}
                      highlight={highlight && !edit[field].trim()}
                      placeholder={placeholder}
                    />
                  )

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isApproved ? 'bg-green-500/5 opacity-60' : 'hover:bg-surface-raised/20'
                    }`}
                  >
                    {/* Company — read-only */}
                    <td className="px-4 py-2.5 text-white/50 whitespace-nowrap text-xs">
                      {row.companyName ?? '—'}
                    </td>

                    {/* File Name — read-only */}
                    <td className="px-4 py-2.5 font-mono text-white/30 max-w-[150px]">
                      <span className="block truncate text-[10px]" title={row.originalFilename}>
                        {row.originalFilename ?? '—'}
                      </span>
                    </td>

                    {/* Reason — read-only */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {meta ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.bg} ${meta.color}`}>
                          <span className={`w-1 h-1 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      ) : <span className="text-white/20 text-xs">—</span>}
                    </td>

                    {/* Outlet Code — editable */}
                    <td className="px-4 py-2.5">{cell('outletCode', 'F5063')}</td>

                    {/* Doc Category — editable */}
                    <td className="px-4 py-2.5">{cell('documentCategory', 'INVOICE')}</td>

                    {/* Date — editable */}
                    <td className="px-4 py-2.5">{cell('date', 'YYYY-MM-DD')}</td>

                    {/* Invoice # — editable */}
                    <td className="px-4 py-2.5">{cell('invoiceNumber', 'INV-001')}</td>

                    {/* CN # — editable */}
                    <td className="px-4 py-2.5">{cell('cnNumber', 'CN-001')}</td>

                    {/* Doc Type — editable */}
                    <td className="px-4 py-2.5">{cell('documentType', 'TAX INVOICE')}</td>

                    {/* Description — editable */}
                    <td className="px-4 py-2.5">{cell('documentDescription', 'Description')}</td>

                    {/* Vendor Code — editable + amber highlight */}
                    <td className="px-4 py-2.5">{cell('vendorCode', '4000/I01', vendorFlag)}</td>

                    {/* Vendor Name — editable + amber highlight */}
                    <td className="px-4 py-2.5">{cell('vendorNameMatched', 'Vendor name', vendorFlag)}</td>

                    {/* Account Code (GL Code) — editable + orange highlight */}
                    <td className="px-4 py-2.5">{cell('glCode', '6011/000', glFlag)}</td>

                    {/* Account Desc (GL Label) — editable + orange highlight */}
                    <td className="px-4 py-2.5">{cell('glLabel', 'GL description', glFlag)}</td>

                    {/* Debit — editable */}
                    <td className="px-4 py-2.5">{cell('debit', '0.00')}</td>

                    {/* Credit — editable */}
                    <td className="px-4 py-2.5">{cell('credit', '0.00')}</td>

                    {/* Page # — editable */}
                    <td className="px-4 py-2.5">{cell('pageNumber', '1')}</td>

                    {/* Extraction Remarks — editable */}
                    <td className="px-4 py-2.5">{cell('extractionRemarks', 'Remarks')}</td>

                    {/* Approve button */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {isApproved ? (
                        <span className="text-green-400 text-[10px] font-medium">✓ Approved</span>
                      ) : (
                        <button
                          onClick={() => handleApproveRow(row.id)}
                          disabled={!isValid || isSaving}
                          className="text-[11px] font-medium px-3 py-1 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSaving ? '…' : 'Approve'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom bar */}
      {approvedCount > 0 && approvedCount < rows.length && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-white/30">
            {pendingCount} row{pendingCount !== 1 ? 's' : ''} still pending
          </p>
          <button
            onClick={() => navigate(`/jobs/${jobId}/export`)}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Skip remaining & go to export →
          </button>
        </div>
      )}
    </div>
  )
}
