import { useState, useEffect, useMemo } from 'react'
import ActionItemCard from './ActionItemCard'
import SnoozeControl from './SnoozeControl'
import ActionItemHistory from './ActionItemHistory'
import CreateActionItemModal from './CreateActionItemModal'
import {
  listItemsForClient, listItemsForVendor,
  markCompleted, markCancelled, snoozeItem, reopenItem,
  partitionByStatus, sortByUrgency, reconcileSnoozedItems,
  ACTION_TYPES,
} from '../lib/actionItems'

const FILTER_ALL = 'all'
const FILTER_REMINDER = 'reminder'
const FILTER_HOLD = 'hold-expiry'
const FILTER_DISPUTE = 'dispute-followup'
const FILTER_MANUAL = 'manual'

const FILTERS = [
  { key: FILTER_ALL, label: 'All', icon: '📋' },
  { key: FILTER_REMINDER, label: 'Reminders', icon: '⏰' },
  { key: FILTER_HOLD, label: 'Holds', icon: '⏸' },
  { key: FILTER_DISPUTE, label: 'Disputes', icon: '⚠️' },
  { key: FILTER_MANUAL, label: 'Manual', icon: '📌' },
]

// Build parent-child groupings: returns an array of parents,
// where each parent has a `.children` field with sub-items.
function buildHierarchy(items) {
  const childrenByParent = {}
  const topLevel = []
  for (const item of items) {
    if (item.parentItemId) {
      if (!childrenByParent[item.parentItemId]) childrenByParent[item.parentItemId] = []
      childrenByParent[item.parentItemId].push(item)
    } else {
      topLevel.push(item)
    }
  }
  // Sort children of each parent
  for (const parentId of Object.keys(childrenByParent)) {
    childrenByParent[parentId] = sortByUrgency(childrenByParent[parentId])
  }
  // Orphans: child items whose parent isn't in this filtered set
  // — surface them as top-level so they don't disappear
  for (const item of items) {
    if (item.parentItemId) {
      const parentInFiltered = topLevel.find(p => p.id === item.parentItemId)
      if (!parentInFiltered) {
        // Already added under parent's children list, but may need to surface
        // Only surface if NO parent at all (true orphan)
        const parentExists = items.find(p => p.id === item.parentItemId)
        if (!parentExists) {
          topLevel.push(item)
        }
      }
    }
  }
  return topLevel.map(parent => ({
    ...parent,
    children: childrenByParent[parent.id] || [],
  }))
}

export default function ActionItemsPanel({
  clientSlug,
  clientName,
  reportId = null,
  vendors = [],            // for the create modal
  selectedVendorName = null, // if drilled into a vendor, show only its items
}) {
  // Force re-renders when items change
  const [tick, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)

  // Modal states
  const [snoozeTarget, setSnoozeTarget] = useState(null)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // UI state
  const [filter, setFilter] = useState(FILTER_ALL)
  const [showHistory, setShowHistory] = useState(false)

  // Reconcile snoozed items each time we open the panel
  useEffect(() => {
    reconcileSnoozedItems()
    refresh()
  }, [])

  // Fetch items based on context
  const allItems = useMemo(() => {
    if (selectedVendorName) {
      return listItemsForVendor(clientSlug, selectedVendorName)
    }
    return listItemsForClient(clientSlug)
  }, [clientSlug, selectedVendorName, tick])

  // Filter by type
  const filteredItems = useMemo(() => {
    if (filter === FILTER_ALL) return allItems
    return allItems.filter(item => item.type === filter)
  }, [allItems, filter])

  // Partition into active vs done, then build hierarchy on each
  const { active, history } = useMemo(() => partitionByStatus(filteredItems), [filteredItems])
  const activeSorted = useMemo(() => sortByUrgency(active), [active])
  const activeHierarchy = useMemo(() => buildHierarchy(activeSorted), [activeSorted])
  const historySorted = useMemo(() => sortByUrgency(history), [history])
  const historyHierarchy = useMemo(() => buildHierarchy(historySorted), [historySorted])

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

  const handleSnooze = (item) => {
    setSnoozeTarget(item)
  }

  const handleSnoozeConfirm = ({ snoozeUntil, note }) => {
    if (snoozeTarget) {
      snoozeItem(snoozeTarget.id, snoozeUntil, note)
      setSnoozeTarget(null)
      refresh()
    }
  }

  const handleReopen = (item) => {
    reopenItem(item.id, 'Reopened from Action Items panel')
    refresh()
  }

  const handleViewHistory = (item) => {
    setHistoryTarget(item)
  }

  // Render
  const totalActive = activeHierarchy.length
  const totalChildrenActive = activeHierarchy.reduce((sum, p) => sum + (p.children?.length || 0), 0)
  const grandTotalActive = totalActive + totalChildrenActive

  return (
    <div className="px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Action Items
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {selectedVendorName
              ? `For ${selectedVendorName} · ${grandTotalActive} active, ${historyHierarchy.length} completed`
              : `${grandTotalActive} active item${grandTotalActive !== 1 ? 's' : ''}${history.length > 0 ? `, ${history.length} in history` : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="text-sm px-3 py-1.5 rounded font-medium transition-all hover:opacity-90"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          + New Action Item
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => {
          const count = f.key === FILTER_ALL
            ? allItems.length
            : allItems.filter(item => item.type === f.key).length
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="text-xs px-3 py-1.5 rounded-full transition-all"
              style={{
                background: active ? 'var(--ink)' : 'transparent',
                color: active ? 'var(--paper)' : 'var(--muted)',
                border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border)'),
                fontWeight: active ? 600 : 500,
              }}
            >
              {f.icon} {f.label}
              {count > 0 && (
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded-full"
                  style={{
                    background: active ? 'rgba(255,255,255,0.15)' : 'var(--border)',
                    color: active ? 'var(--paper)' : 'var(--muted)',
                    fontSize: '0.65rem',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active items */}
      {activeHierarchy.length === 0 ? (
        <div className="text-center py-10 rounded-lg" style={{ background: '#faf9f7', border: '1px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No active items{filter !== FILTER_ALL ? ` in this filter` : ''}.
          </p>
          {filter === FILTER_ALL && (
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Create one manually or set a reminder/hold/dispute flag on a vendor profile to generate items automatically.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {activeHierarchy.map(item => (
            <ActionItemCard
              key={item.id}
              item={item}
              childItems={item.children}
              onComplete={handleComplete}
              onSnooze={handleSnooze}
              onCancel={handleCancel}
              onReopen={handleReopen}
              onViewHistory={handleViewHistory}
            />
          ))}
        </div>
      )}

      {/* History section */}
      {historyHierarchy.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-2.5 flex items-center justify-between rounded-lg transition-all"
            style={{ background: '#faf9f7', border: '1px solid var(--border)' }}
          >
            <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
              <span style={{ transform: showHistory ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block', fontSize: '0.7em' }}>▶</span>
              History ({historyHierarchy.length})
            </span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {showHistory ? 'Hide' : 'Show'} completed and cancelled items
            </span>
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2">
              {historyHierarchy.map(item => (
                <ActionItemCard
                  key={item.id}
                  item={item}
                  childItems={item.children}
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

      {showCreateModal && (
        <CreateActionItemModal
          clientSlug={clientSlug}
          reportId={reportId}
          vendors={vendors}
          prefilledVendorName={selectedVendorName}
          onCreated={refresh}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}