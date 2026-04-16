const styles = {
  queued:         'bg-white/10 text-white/50',
  extracting:     'bg-accent-muted text-accent',
  enriching:      'bg-accent-muted text-accent',
  pending_review: 'bg-amber-500/15 text-amber-400',
  complete:       'bg-green-500/15 text-green-400',
  failed:         'bg-red-500/15 text-red-400',
}

const labels = {
  queued:         'Queued',
  extracting:     'Extracting…',
  enriching:      'Enriching…',
  pending_review: 'Needs Review',
  complete:       'Complete',
  failed:         'Failed',
}

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${
        styles[status] ?? styles.queued
      }`}
    >
      {labels[status] ?? status}
    </span>
  )
}
