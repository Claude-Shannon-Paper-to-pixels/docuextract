import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getJobStatus, getJobRows, getReviewSummary } from '../lib/api'
import StatusBadge from '../components/StatusBadge'

const REVIEW_REASON_META = {
  vendor_unmatched:   { label: 'Vendor Unmatched',   color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/30',  dot: 'bg-amber-400' },
  gl_unmatched:       { label: 'GL Unmatched',       color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30', dot: 'bg-orange-400' },
  low_confidence:     { label: 'Low Confidence',     color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30',       dot: 'bg-red-400' },
  row_count_mismatch: { label: 'Row Mismatch',        color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30', dot: 'bg-purple-400' },
}

const STATUS_FILTERS = [
  { label: 'All',          value: '' },
  { label: 'Approved',     value: 'approved' },
  { label: 'Needs Review', value: 'needs_review' },
  { label: 'Reviewed',     value: 'reviewed' },
  { label: 'Raw',          value: 'raw' },
]

const ROW_STATUS_STYLES = {
  approved:     'bg-green-500/20 text-green-300 border border-green-500/30 ring-1 ring-green-500/20',
  reviewed:     'bg-accent/20 text-accent border border-accent/30 ring-1 ring-accent/20',
  needs_review: 'bg-amber-500/20 text-amber-300 border border-amber-500/30 ring-1 ring-amber-500/20',
  raw:          'bg-white/10 text-white/50 border border-white/10',
}

const ROW_STATUS_LABELS = {
  approved:     'Approved',
  reviewed:     'Reviewed',
  needs_review: 'Needs Review',
  raw:          'Raw',
}

const ROW_STATUS_DOT = {
  approved:     'bg-green-400',
  reviewed:     'bg-accent',
  needs_review: 'bg-amber-400',
  raw:          'bg-white/30',
}

export default function JobDetails() {
  const { jobId }  = useParams()
  const navigate   = useNavigate()
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn:  () => getJobStatus(jobId),
  })

  const { data: rows = [], isLoading: rowsLoading } = useQuery({
    queryKey: ['job-rows', jobId, filter],
    queryFn:  () => getJobRows(jobId, filter),
    staleTime: 0,
  })

  // Client-side search across multiple fields
  const filtered = search.trim()
    ? rows.filter(r =>
        [
          r.documentDescription,
          r.documentCategory,
          r.documentType,
          r.vendorNameRaw,
          r.vendorNameMatched,
          r.vendorCode,
          r.invoiceNumber,
          r.cnNumber,
          r.glCode,
          r.glLabel,
          r.outletCode,
          r.companyName,
          r.originalFilename,
          r.extractionRemarks,
        ].some(v => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : rows

  const isLoading = jobLoading || rowsLoading

  const { data: allRows = [] } = useQuery({
    queryKey: ['job-rows', jobId, ''],
    queryFn:  () => getJobRows(jobId),
    staleTime: 0,
  })

  const { data: reviewSummary } = useQuery({
    queryKey: ['review-summary', jobId],
    queryFn:  () => getReviewSummary(jobId),
    enabled:  job?.status === 'pending_review',
    staleTime: 0,
  })

  const rowStats = {
    total:       allRows.length,
    approved:    allRows.filter(r => r.status === 'approved').length,
    reviewed:    allRows.filter(r => r.status === 'reviewed').length,
    needsReview: allRows.filter(r => r.status === 'needs_review').length,
    raw:         allRows.filter(r => r.status === 'raw').length,
  }

  return (
    <div className="w-full space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-white/30 hover:text-white/60 transition-colors mb-2 flex items-center gap-1"
          >
            ← Dashboard
          </button>
          <h1 className="text-2xl font-medium text-white truncate max-w-2xl">
            {job?.originalFilename ?? 'Loading…'}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            {job?.outletCode && (
              <span className="text-xs font-mono text-white/40 bg-surface-raised px-2 py-0.5 rounded">
                {job.outletCode}
              </span>
            )}
            {job && <StatusBadge status={job.status} />}
            {job?.createdAt && (
              <span className="text-xs text-white/30">
                {new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {job?.status === 'pending_review' && reviewSummary && (
            <div className="flex items-center gap-1.5 mr-1">
              {Object.entries(reviewSummary.byReason)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => {
                  const meta = REVIEW_REASON_META[key]
                  return meta ? (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.bg} ${meta.color}`}
                    >
                      <span className={`w-1 h-1 rounded-full ${meta.dot}`} />
                      {meta.label} ({count})
                    </span>
                  ) : null
                })}
            </div>
          )}
          {job?.status === 'pending_review' && (
            <button
              onClick={() => navigate(`/jobs/${jobId}/review`)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Start Review
            </button>
          )}
          <button
            onClick={() => navigate(`/jobs/${jobId}/export`)}
            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export to Excel
          </button>
        </div>
      </div>

      {/* Row stats cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Rows',   value: rowStats.total,       color: 'text-white' },
          { label: 'Approved',     value: rowStats.approved,    color: 'text-green-400' },
          { label: 'Reviewed',     value: rowStats.reviewed,    color: 'text-accent' },
          { label: 'Needs Review', value: rowStats.needsReview, color: 'text-amber-400' },
          { label: 'Raw',          value: rowStats.raw,         color: 'text-white/40' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-card border border-surface-border rounded-lg p-4">
            <p className="text-white/40 text-xs mb-1">{label}</p>
            <p className={`text-2xl font-mono font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1 bg-surface-card border border-surface-border rounded-lg p-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'bg-surface-raised text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search description, vendor, GL code…"
            className="w-full bg-surface-card border border-surface-border rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin mx-auto mb-3" />
              <p className="text-white/40 text-xs">Loading rows…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="h-10 w-10 text-white/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-white/40 text-sm font-medium">No rows found</p>
            <p className="text-white/20 text-xs mt-1">Try changing the filter or clearing the search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-surface-raised/40">
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Company</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Outlet Code</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Doc Category</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Invoice #</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">CN #</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Doc Type</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 min-w-[200px]">Description</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Vendor Code</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 min-w-[140px]">Vendor Name</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Account Code</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 min-w-[140px]">Account Desc.</th>
                  <th className="text-right text-white/40 font-medium px-4 py-3 whitespace-nowrap">Debit</th>
                  <th className="text-right text-white/40 font-medium px-4 py-3 whitespace-nowrap">Credit</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Page</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 min-w-[160px]">File Name</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 min-w-[160px]">Extraction Remarks</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="text-left text-white/40 font-medium px-4 py-3 whitespace-nowrap">Review Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map(row => (
                  <tr key={row.id} className="hover:bg-surface-raised/20 transition-colors">

                    {/* Company Name */}
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                      {row.companyName ?? '—'}
                    </td>

                    {/* Outlet Code */}
                    <td className="px-4 py-3 font-mono text-white/50 whitespace-nowrap">
                      {row.outletCode
                        ? <span className="bg-surface-raised px-1.5 py-0.5 rounded">{row.outletCode}</span>
                        : '—'}
                    </td>

                    {/* Document Category */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.documentCategory
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-raised text-white/50">{row.documentCategory}</span>
                        : '—'}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                      {row.date
                        ? new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>

                    {/* Invoice Number */}
                    <td className="px-4 py-3 font-mono text-white/50 whitespace-nowrap">
                      {row.invoiceNumber ?? '—'}
                    </td>

                    {/* CN Number */}
                    <td className="px-4 py-3 font-mono text-white/50 whitespace-nowrap">
                      {row.cnNumber ?? '—'}
                    </td>

                    {/* Document Type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.documentType
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-raised text-white/50">{row.documentType}</span>
                        : '—'}
                    </td>

                    {/* Document Description */}
                    <td className="px-4 py-3 text-white/70 max-w-xs">
                      <p className="truncate" title={row.documentDescription}>{row.documentDescription ?? '—'}</p>
                    </td>

                    {/* Vendor Code */}
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      {row.vendorCode
                        ? <span className="text-white/60">{row.vendorCode}</span>
                        : <span className="text-amber-400/60">—</span>}
                    </td>

                    {/* Vendor Name */}
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-white/70 truncate" title={row.vendorNameMatched ?? row.vendorNameRaw}>
                        {row.vendorNameMatched ?? row.vendorNameRaw ?? '—'}
                      </p>
                      {row.vendorNameMatched && row.vendorNameRaw !== row.vendorNameMatched && (
                        <p className="text-white/25 truncate mt-0.5 text-[10px]" title={row.vendorNameRaw}>
                          raw: {row.vendorNameRaw}
                        </p>
                      )}
                    </td>

                    {/* Account Code (GL Code) */}
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      {row.glCode
                        ? <span className="text-white/60">{row.glCode}</span>
                        : <span className="text-amber-400/60">—</span>}
                    </td>

                    {/* Account Description (GL Label) */}
                    <td className="px-4 py-3 text-white/40 max-w-[160px]">
                      <p className="truncate text-[11px]" title={row.glLabel}>{row.glLabel ?? '—'}</p>
                    </td>

                    {/* Debit */}
                    <td className="px-4 py-3 font-mono text-right whitespace-nowrap text-red-400">
                      {row.debit != null ? `RM ${Number(row.debit).toFixed(2)}` : '—'}
                    </td>

                    {/* Credit */}
                    <td className="px-4 py-3 font-mono text-right whitespace-nowrap text-green-400">
                      {row.credit != null ? `RM ${Number(row.credit).toFixed(2)}` : '—'}
                    </td>

                    {/* Page Number */}
                    <td className="px-4 py-3 font-mono text-white/30">
                      {row.pageNumber ?? '—'}
                    </td>

                    {/* File Name */}
                    <td className="px-4 py-3 font-mono text-white/30 max-w-[160px]">
                      <p className="truncate text-[10px]" title={row.originalFilename}>{row.originalFilename ?? '—'}</p>
                    </td>

                    {/* Extraction Remarks */}
                    <td className="px-4 py-3 text-amber-400/70 max-w-[160px]">
                      <p className="truncate text-[10px]" title={row.extractionRemarks}>{row.extractionRemarks ?? '—'}</p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${ROW_STATUS_STYLES[row.status] ?? 'bg-white/5 text-white/30 border border-white/10'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ROW_STATUS_DOT[row.status] ?? 'bg-white/30'}`} />
                        {ROW_STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>

                    {/* Review Reason */}
                    <td className="px-4 py-3">
                      {row.reviewReason ? (() => {
                        const meta = REVIEW_REASON_META[row.reviewReason]
                        return meta ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.bg} ${meta.color}`}>
                            <span className={`w-1 h-1 rounded-full flex-shrink-0 ${meta.dot}`} />
                            {meta.label}
                          </span>
                        ) : (
                          <span className="text-white/30 text-[10px] font-mono">{row.reviewReason}</span>
                        )
                      })() : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>

            {/* Table footer */}
            <div className="border-t border-surface-border px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-white/30">
                Showing <span className="text-white/50">{filtered.length}</span> of{' '}
                <span className="text-white/50">{rows.length}</span> rows
                {filter && (
                  <span className="text-white/30">
                    {' '}· filtered by <span className="text-accent/70">{filter}</span>
                  </span>
                )}
              </p>
              <button
                onClick={() => navigate(`/jobs/${jobId}/export`)}
                className="text-xs text-accent hover:underline font-medium"
              >
                Export all to Excel →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}