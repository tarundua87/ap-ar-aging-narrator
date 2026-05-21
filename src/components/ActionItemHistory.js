import { TYPE_METADATA, STATUS_METADATA } from '../lib/actionItems'

// Map history action names to display metadata
const ACTION_DISPLAY = {
  created:     { label: 'Created',     icon: '✨', color: '#15803d' },
  completed:   { label: 'Completed',   icon: '✓',  color: '#15803d' },
  cancelled:   { label: 'Cancelled',   icon: '✕',  color: '#9ca3af' },
  snoozed:     { label: 'Snoozed',     icon: '⏱',  color: '#6b7280' },
  unsnoozed:   { label: 'Unsnoozed',   icon: '🔔', color: '#b87d00' },
  reopened:    { label: 'Reopened',    icon: '↻',  color: '#c8401a' },
  edited:      { label: 'Edited',      icon: '✎',  color: '#374151' },
  'note-added':{ label: 'Note Added',  icon: '📝', color: '#374151' },
}

function formatTimestamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${datePart} at ${timePart}`
}

function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

export default function ActionItemHistory({ item, onClose }) {
  if (!item) return null

  const type = TYPE_METADATA[item.type] || TYPE_METADATA.manual
  const status = STATUS_METADATA[item.status] || STATUS_METADATA.open

  const history = [...(item.history || [])].reverse() // newest first

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(15,17,23,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full"
        style={{ maxWidth: '640px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 rounded-t-xl" style={{ background: 'var(--ink)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                History · {type.label}
              </p>
              <h2 className="text-base font-bold mt-0.5" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
                {item.title}
              </h2>
              {item.vendorName && (
                <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                  {item.vendorName}
                  {item.invoiceNumber && ` · Invoice ${item.invoiceNumber}`}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded transition-all shrink-0"
              style={{ color: 'var(--paper)', background: '#374151' }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="px-5 py-3 flex items-center gap-3" style={{ background: '#faf9f7', borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Current Status
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: status.color + '20', color: status.color, border: '1px solid ' + status.color + '40' }}
          >
            {status.label}
          </span>
          {item.dueDate && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              · Due {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {item.snoozedUntil && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              · Snoozed until {new Date(item.snoozedUntil).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Timeline */}
        <div className="px-5 py-5" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {history.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>
              No history events recorded yet.
            </p>
          ) : (
            <div className="relative" style={{ paddingLeft: '28px' }}>
              {/* Vertical timeline line */}
              <div
                className="absolute"
                style={{
                  left: '11px',
                  top: '12px',
                  bottom: '12px',
                  width: '2px',
                  background: 'var(--border)',
                }}
              />

              {history.map((entry, idx) => {
                const display = ACTION_DISPLAY[entry.action] || { label: entry.action, icon: '•', color: '#6b7280' }
                const isFirst = idx === 0
                return (
                  <div key={idx} className="relative mb-5 last:mb-0">
                    {/* Marker dot */}
                    <div
                      className="absolute flex items-center justify-center"
                      style={{
                        left: '-28px',
                        top: '0',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'white',
                        border: `2px solid ${display.color}`,
                        fontSize: '0.7rem',
                      }}
                    >
                      {display.icon}
                    </div>

                    {/* Content */}
                    <div
                      className="rounded-lg p-3"
                      style={{
                        background: isFirst ? '#fffbeb' : 'white',
                        border: '1px solid ' + (isFirst ? '#fcd34d' : 'var(--border)'),
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: display.color }}>
                          {display.label}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          {timeAgo(entry.at)}
                        </span>
                      </div>
                      <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
                        {formatTimestamp(entry.at)}
                      </p>
                      {entry.note && (
                        <p className="text-sm mt-2" style={{ color: 'var(--ink)' }}>
                          {entry.note}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 rounded-b-xl" style={{ background: '#faf9f7', borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {history.length} event{history.length !== 1 ? 's' : ''} in timeline ·
            Created {item.createdBy === 'system' ? 'automatically' : 'manually'}
            {item.createdAt && ` on ${formatTimestamp(item.createdAt)}`}
          </p>
        </div>
      </div>
    </div>
  )
}