import { useState, useEffect, useMemo } from 'react'
import ActionItemCard from './ActionItemCard'
import SnoozeControl from './SnoozeControl'
import ActionItemHistory from './ActionItemHistory'
import CreateActionItemModal from './CreateActionItemModal'
import {
  listAllActionItems,
  markCompleted, markCancelled, snoozeItem, reopenItem,
  partitionByStatus, sortByUrgency, reconcileSnoozedItems,
  getUrgencyTier,
} from '../lib/actionItems'

const FILTER_ALL = 'all'
const FILTER_REMINDER = 'reminder'
const FILTER_HOLD = 'hold-expiry'
const FILTER_DISPUTE = 'dispute-followup'
const FILTER_MANUAL = 'manual'

const URGENCY_FILTER_ALL = 'all'
const URGENCY_FILTER_OVERDUE = 'overdue'
const URGENCY_FILTER_TODAY = 'today'
const URGENCY_FILTER_THIS_WEEK = 'this-week'
const URGENCY_FILTER_FUTURE = 'future'

const TYPE_FILTERS = [
  { key: FILTER_ALL, label: 'All Types', icon: '📋' },
  { key: FILTER_REMINDER, label: 'Reminders', icon: '⏰' },
  { key: FILTER_HOLD, label: 'Holds', icon: '⏸' },
  { key: FILTER_DISPUTE, label: 'Disputes', icon: '⚠️' },
  { key: FILTER_MANUAL, label: 'Manual', icon: '📌' },
]

const URGENCY_FILTERS = [
  { key: URGENCY_FILTER_ALL, label: 'All', color: '#374151' },
  { key: URGENCY_FILTER_OVERDUE, label: 'Overdue', color: '#991b1b' },
  { key: URGENCY_FILTER_TODAY, label: 'Today', color: '#c8401a' },
  { key: URGENCY_FILTER_THIS_WEEK, label: 'This Week', color: '#b87d00' },
  { key: URGENCY_FILTER_FUTURE, label: 'Future', color: '#15803d' },
]

export default function AllActionItemsPage({ clients, onBack, onJumpToClient }) {
  // Force re-renders
  const [tick, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)

  // Filter state
  const [typeFilter, setTypeFilter] = useState(FILTER_ALL)
  const [urgencyFilter, setUrgencyFilter] = useState(URGENCY_FILTER_ALL)
  const [clientFilter, setClientFilter] = useState('all')
  const [showHistory, setShowHistory] = useState(false)

  // Modal states
  const [snoozeTarget, setSnoozeTarget] = useState(null)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Reconcile snoozed items on mount
  useEffect(() => {
    reconcileSnoozedItems()
    refresh()
  }, [])

  // Build a slug → displayName map for quick lookup
  const clientNameMap = useMemo(() => {
    const m = {}
    for (const c of clients) m[c.slug] = c.displayName
    return m
  }, [clients])

  // Fetch all items
  const allItems = useMemo(() => listAllActionItems(), [tick])

  // Apply filters
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      // Type filter
      if (typeFilter !== FILTER_ALL && item.type !== typeFilter) return false
      // Client filter
      if (clientFilter !== 'all' && item.clientSlug !== clientFilter) return false
      // Urgency filter (only applies to active items)
      if (urgencyFilter !== URGENCY_FILTER_ALL) {
        const tier = getUrgencyTier(item)
        if (urgencyFilter === URGENCY_FILTER_THIS_WEEK) {
          if (tier !== 'this-week' && tier !== 'tomorrow') return false
        } else if (tier !== urgencyFilter) {
          return false
        }
      }
      return true
    })
  }, [allItems, typeFilter, urgencyFilter, clientFilter])

  // Partition + sort
  const { active, history } = useMemo(() => partitionByStatus(filteredItems), [filteredItems])
  const activeSorted = useMemo(() => sortByUrgency(active), [active])
  const historySorted = useMemo(() => sortByUrgency(history), [history])

  // Group active items by client
  const groupedByClient = useMemo(() => {
    const groups = {}
    for (const item of activeSorted) {
      const slug = item.clientSlug
      if (!groups[slug]) groups[slug] = { slug, name: clientNameMap[slug] || slug, items: [] }
      groups[slug].items.push(item)
    }
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))
  }, [activeSorted, clientNameMap])

  // Action handlers
  const handleComplete = (item) => {
    const note = prompt('Add a note about how this was completed (optional):', '') || ''
    markCompleted(item.id, note)
    refresh()
  }

  const handleCancel = (item) => {
    if (!confirm(`Cancel "${item.title}"?`)) return
    const note = prompt('Reason for cancelling (optional):', '') || ''
    markCancelled(item.id, note)
    refresh()
  }

  const handleSnooze = (item) => setSnoozeTarget(item)
  const handleSnoozeConfirm = ({ snoozeUntil, note }) => {
    if (snoozeTarget) {
      snoozeItem(snoozeTarget.id, snoozeUntil, note)
      setSnoozeTarget(null)
      refresh()
    }
  }
  const handleReopen = (item) => {
    reopenItem(item.id, 'Reopened from All Action Items page')
    refresh()
  }
  const handleViewHistory = (item) => setHistoryTarget(item)

  // Counts for summary
  const counts = useMemo(() => {
    const c = { overdue: 0, today: 0, thisWeek: 0, future: 0, snoozed: 0 }
    for (const item of activeSorted) {
      const tier = getUrgencyTier(item)
      if (tier === 'overdue') c.overdue++
      else if (tier === 'today') c.today++
      else if (tier === 'tomorrow' || tier === 'this-week') c.thisWeek++
      else if (tier === 'snoozed') c.snoozed++
      else c.future++
    }
    return c
  }, [activeSorted])

  return (
    <div>
      {/* Header */}
      <button
        onClick={onBack}
        className="text-xs mb-4 flex items-center gap-1.5 transition-all hover:opacity-80"
        style={{ color: 'var(--muted)' }}
      >
        ← Back to Library
      </button>

      <div className="mb-6">
        <h2 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
          All Action Items
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Cross-client view · {activeSorted.length} active · {history.length} in history
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <SummaryTile label="Overdue" count={counts.overdue} color="#991b1b" onClick={() => setUrgencyFilter(URGENCY_FILTER_OVERDUE)} active={urgencyFilter === URGENCY_FILTER_OVERDUE} />
        <SummaryTile label="Today" count={counts.today} color="#c8401a" onClick={() => setUrgencyFilter(URGENCY_FILTER_TODAY)} active={urgencyFilter === URGENCY_FILTER_TODAY} />
        <SummaryTile label="This Week" count={counts.thisWeek} color="#b87d00" onClick={() => setUrgencyFilter(URGENCY_FILTER_THIS_WEEK)} active={urgencyFilter === URGENCY_FILTER_THIS_WEEK} />
        <SummaryTile label="Future" count={counts.future} color="#15803d" onClick={() => setUrgencyFilter(URGENCY_FILTER_FUTURE)} active={urgencyFilter === URGENCY_FILTER_FUTURE} />
        <SummaryTile label="Snoozed" count={counts.snoozed} color="#6b7280" onClick={() => setUrgencyFilter(URGENCY_FILTER_ALL)} active={false} />
      </div>

      {/* Filters row */}
      <div className="mb-5 space-y-3">
        {/* Urgency filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-widest font-semibold mr-1" style={{ color: 'var(--muted)' }}>Urgency:</span>
          {URGENCY_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setUrgencyFilter(f.key)}
              className="text-xs px-3 py-1 rounded-full transition-all"
              style={{
                background: urgencyFilter === f.key ? f.color : 'transparent',
                color: urgencyFilter === f.key ? 'white' : 'var(--muted)',
                border: '1px solid ' + (urgencyFilter === f.key ? f.color : 'var(--border)'),
                fontWeight: urgencyFilter === f.key ? 600 : 500,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Type + client filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-widest font-semibold mr-1" style={{ color: 'var(--muted)' }}>Type:</span>
            {TYPE_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className="text-xs px-3 py-1 rounded-full transition-all"
                style={{
                  background: typeFilter === f.key ? 'var(--ink)' : 'transparent',
                  color: typeFilter === f.key ? 'var(--paper)' : 'var(--muted)',
                  border: '1px solid ' + (typeFilter === f.key ? 'var(--ink)' : 'var(--border)'),
                  fontWeight: typeFilter === f.key ? 600 : 500,
                }}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>Client:</span>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="text-xs px-2 py-1 rounded outline-none"
              style={{ border: '1px solid var(--border)', background: 'white' }}
            >
              <option value="all">All clients</option>
              {clients.map(c => (
                <option key={c.slug} value={c.slug}>{c.displayName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active items grouped by client */}
      {groupedByClient.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#faf9f7', border: '1px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No active action items match your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByClient.map(group => (
            <div key={group.slug}>
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  onClick={() => onJumpToClient && onJumpToClient(group.slug)}
                  className="text-sm font-semibold transition-all hover:opacity-80"
                  style={{ color: 'var(--ink)', fontFamily: 'Playfair Display, serif' }}
                >
                  {group.name} →
                </button>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map(item => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    onComplete={handleComplete}
                    onSnooze={handleSnooze}
                    onCancel={handleCancel}
                    onReopen={handleReopen}
                    onViewHistory={handleViewHistory}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History section */}
      {historySorted.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-2.5 flex items-center justify-between rounded-lg transition-all"
            style={{ background: '#faf9f7', border: '1px solid var(--border)' }}
          >
            <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
              <span style={{ transform: showHistory ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block', fontSize: '0.7em' }}>▶</span>
              History ({historySorted.length})
            </span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {showHistory ? 'Hide' : 'Show'} completed and cancelled items
            </span>
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2">
              {historySorted.map(item => (
                <ActionItemCard
                  key={item.id}
                  item={item}
                  onReopen={handleReopen}
                  onViewHistory={handleViewHistory}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {snoozeTarget && (
        <SnoozeControl
          item={snoozeTarget}
          onSnooze={handleSnoozeConfirm}
          onClose={() => setSnoozeTarget(null)}
        />
      )}

      {historyTarget && (
        <ActionItemHistory
          item={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}

function SummaryTile({ label, count, color, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-3 rounded-lg transition-all text-left hover:opacity-90"
      style={{
        background: active ? color : color + '15',
        border: '1px solid ' + (active ? color : color + '40'),
        color: active ? 'white' : color,
      }}
    >
      <p className="text-2xl font-bold leading-none">{count}</p>
      <p className="text-xs mt-1.5" style={{ fontWeight: 500 }}>{label}</p>
    </button>
  )
}