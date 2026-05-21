import { useState } from 'react'
import {
  TYPE_METADATA, STATUS_METADATA,
  formatDueIndicator, getUrgencyTier,
  ACTION_STATUS,
} from '../lib/actionItems'

// Urgency styling for the left border accent and badge
const URGENCY_STYLES = {
  overdue:    { border: '#991b1b', bg: '#fef2f2', badge: { background: '#fee2e2', color: '#991b1b' } },
  today:      { border: '#c8401a', bg: '#fff7ed', badge: { background: '#ffedd5', color: '#9a3412' } },
  tomorrow:   { border: '#b45309', bg: '#fffbeb', badge: { background: '#fef3c7', color: '#78350f' } },
  'this-week':{ border: '#b87d00', bg: '#fefce8', badge: { background: '#fef9c3', color: '#854d0e' } },
  future:     { border: '#15803d', bg: '#f0fdf4', badge: { background: '#dcfce7', color: '#14532d' } },
  snoozed:    { border: '#6b7280', bg: '#f9fafb', badge: { background: '#e5e7eb', color: '#374151' } },
  'no-date':  { border: '#9ca3af', bg: 'white',   badge: { background: '#f3f4f6', color: '#6b7280' } },
  done:       { border: '#86efac', bg: 'white',   badge: { background: '#dcfce7', color: '#14532d' } },
  none:       { border: 'var(--border)', bg: 'white', badge: { background: '#f3f4f6', color: '#6b7280' } },
}

export default function ActionItemCard({
  item,
  childItems = [],          // sub-items if this is a parent
  onComplete,
  onSnooze,
  onCancel,
  onReopen,
  onViewHistory,
  onEdit,
  compact = false,          // when true, render as a sub-item (child card)
}) {
  if (!item) return null

  const type = TYPE_METADATA[item.type] || TYPE_METADATA.manual
  const status = STATUS_METADATA[item.status] || STATUS_METADATA.open
  const urgency = getUrgencyTier(item)
  const urgencyStyle = URGENCY_STYLES[urgency] || URGENCY_STYLES.none

  const isOpen = item.status === ACTION_STATUS.OPEN
  const isSnoozed = item.status === ACTION_STATUS.SNOOZED
  const isDone = item.status === ACTION_STATUS.COMPLETED || item.status === ACTION_STATUS.CANCELLED

  const dueText = formatDueIndicator(item)

  return (
    <div
      className="rounded-lg overflow-hidden transition-all"
      style={{
        borderLeft: `4px solid ${urgencyStyle.border}`,
        border: `1px solid var(--border)`,
        borderLeftWidth: '4px',
        borderLeftColor: urgencyStyle.border,
        background: isDone ? '#fafaf9' : urgencyStyle.bg,
        opacity: isDone ? 0.7 : 1,
      }}
    >
      <div className={compact ? 'px-3 py-2.5' : 'px-4 py-3'}>
        {/* Top row: title + status badges */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span style={{ fontSize: '0.9rem' }}>{type.icon}</span>
              <span
                className="text-xs uppercase tracking-widest font-semibold"
                style={{ color: type.color }}
              >
                {type.label}
              </span>
              {item.parentItemId && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#e5e7eb', color: '#374151', fontSize: '0.65rem' }}>
                  sub-item
                </span>
              )}
            </div>
            <h4
              className={compact ? 'text-sm font-semibold leading-tight' : 'text-base font-semibold leading-tight'}
              style={{ color: 'var(--ink)', textDecoration: isDone ? 'line-through' : 'none' }}
            >
              {item.title}
            </h4>
          </div>

          {/* Status badge (top-right) */}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            style={{
              background: urgencyStyle.badge.background,
              color: urgencyStyle.badge.color,
            }}
          >
            {isDone ? status.label : dueText}
          </span>
        </div>

        {/* Context line: vendor / invoice */}
        {(item.vendorName || item.invoiceNumber) && (
          <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>
            {item.vendorName && <span>👤 {item.vendorName}</span>}
            {item.vendorName && item.invoiceNumber && <span> · </span>}
            {item.invoiceNumber && <span>📄 Invoice {item.invoiceNumber}</span>}
          </p>
        )}

        {/* Notes preview */}
        {item.notes && item.notes.trim() && !compact && (
          <p className="text-xs mt-1 mb-2 px-2 py-1.5 rounded" style={{ background: 'white', color: 'var(--ink)', border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--muted)' }}>Note:</span> {item.notes.trim()}
          </p>
        )}

        {/* Actions row */}
        {!compact && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {isOpen && onComplete && (
              <button
                onClick={() => onComplete(item)}
                className="text-xs px-2.5 py-1 rounded transition-all hover:opacity-90 font-medium"
                style={{ background: '#15803d', color: 'white' }}
              >
                ✓ Complete
              </button>
            )}
            {(isOpen || isSnoozed) && onSnooze && (
              <button
                onClick={() => onSnooze(item)}
                className="text-xs px-2.5 py-1 rounded transition-all"
                style={{ color: 'var(--ink)', border: '1px solid var(--border)', background: 'white' }}
              >
                ⏱ {isSnoozed ? 'Re-snooze' : 'Snooze'}
              </button>
            )}
            {isOpen && onCancel && (
              <button
                onClick={() => onCancel(item)}
                className="text-xs px-2.5 py-1 rounded transition-all"
                style={{ color: 'var(--muted)', border: '1px solid var(--border)', background: 'white' }}
              >
                ✕ Cancel
              </button>
            )}
            {isDone && onReopen && (
              <button
                onClick={() => onReopen(item)}
                className="text-xs px-2.5 py-1 rounded transition-all"
                style={{ color: 'var(--accent)', border: '1px solid var(--border)', background: 'white' }}
              >
                ↻ Reopen
              </button>
            )}
            {onEdit && !isDone && (
              <button
                onClick={() => onEdit(item)}
                className="text-xs px-2.5 py-1 rounded transition-all"
                style={{ color: 'var(--muted)', border: '1px solid var(--border)', background: 'white' }}
              >
                ✎ Edit
              </button>
            )}
            {onViewHistory && (
              <button
                onClick={() => onViewHistory(item)}
                className="text-xs px-2.5 py-1 rounded transition-all ml-auto"
                style={{ color: 'var(--muted)', background: 'transparent' }}
              >
                History ({item.history?.length || 0}) →
              </button>
            )}
          </div>
        )}

        {/* Compact mode: minimal actions */}
        {compact && (isOpen || isSnoozed) && onComplete && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              onClick={() => onComplete(item)}
              className="text-xs px-2 py-0.5 rounded transition-all hover:opacity-90 font-medium"
              style={{ background: '#15803d', color: 'white' }}
            >
              ✓
            </button>
            {onSnooze && (
              <button
                onClick={() => onSnooze(item)}
                className="text-xs px-2 py-0.5 rounded transition-all"
                style={{ color: 'var(--ink)', border: '1px solid var(--border)', background: 'white' }}
              >
                ⏱
              </button>
            )}
            {onViewHistory && (
              <button
                onClick={() => onViewHistory(item)}
                className="text-xs px-2 py-0.5 rounded transition-all ml-auto"
                style={{ color: 'var(--muted)', background: 'transparent' }}
              >
                History
              </button>
            )}
          </div>
        )}
      </div>

      {/* Child items rendered indented below */}
      {childItems.length > 0 && (
        <div
          className="px-4 pb-3 pt-1 space-y-1.5"
          style={{ marginLeft: '20px', borderLeft: '2px dashed var(--border)' }}
        >
          {childItems.map(child => (
            <ActionItemCard
              key={child.id}
              item={child}
              compact
              onComplete={onComplete}
              onSnooze={onSnooze}
              onCancel={onCancel}
              onReopen={onReopen}
              onViewHistory={onViewHistory}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}