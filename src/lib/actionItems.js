// Unified Action Items storage and lifecycle management.
// One storage key holds all items across all clients.
//
// Storage key: "ap-narrator:actionItems"
// Schema:
// {
//   "[itemId]": {
//     id, clientSlug, reportId,           // context
//     type, title, vendorName, invoiceNumber,
//     parentItemId,                        // null for top-level, else parent id
//     dueDate, dueTime,                    // ISO date YYYY-MM-DD + HH:MM
//     status, snoozedUntil,
//     recurringCadenceDays,                // null = one-time
//     notes, createdAt, createdBy,
//     history: [{ at, action, note }],
//   }
// }

const STORAGE_KEY = 'ap-narrator:actionItems'

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function makeId() {
  return 'ai-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

function nowIso() {
  return new Date().toISOString()
}

// ── Constants ────────────────────────────────────────────

export const ACTION_TYPES = {
  REMINDER: 'reminder',
  HOLD_EXPIRY: 'hold-expiry',
  DISPUTE_FOLLOWUP: 'dispute-followup',
  RECONCILIATION_FOLLOWUP: 'reconciliation-followup',
  MANUAL: 'manual',
}

export const ACTION_STATUS = {
  OPEN: 'open',
  COMPLETED: 'completed',
  SNOOZED: 'snoozed',
  CANCELLED: 'cancelled',
}

export const TYPE_METADATA = {
  reminder: { label: 'Reminder', icon: '⏰', color: '#b87d00' },
  'hold-expiry': { label: 'Hold Expiry', icon: '⏸', color: '#0369a1' },
  'dispute-followup': { label: 'Dispute Follow-up', icon: '⚠️', color: '#c8401a' },
  'reconciliation-followup': { label: 'Reconciliation Follow-up', icon: '🔍', color: '#7c3aed' },
  manual: { label: 'Manual', icon: '📌', color: '#374151' },
}

export const STATUS_METADATA = {
  open: { label: 'Open', color: '#b87d00' },
  completed: { label: 'Completed', color: '#15803d' },
  snoozed: { label: 'Snoozed', color: '#6b7280' },
  cancelled: { label: 'Cancelled', color: '#9ca3af' },
}

// ── Storage read/write ───────────────────────────────────

function readAll() {
  if (!isBrowser()) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) || {} : {}
  } catch {
    return {}
  }
}

function writeAll(data) {
  if (!isBrowser()) return false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (err) {
    console.error('Failed to write action items', err)
    return false
  }
}

// ── Default empty shape ──────────────────────────────────

export function emptyActionItem() {
  return {
    id: null,
    clientSlug: null,
    reportId: null,
    type: ACTION_TYPES.MANUAL,
    title: '',
    vendorName: null,
    invoiceNumber: null,
    parentItemId: null,
    dueDate: '',
    dueTime: '',
    status: ACTION_STATUS.OPEN,
    snoozedUntil: null,
    recurringCadenceDays: null,
    notes: '',
    createdAt: null,
    createdBy: 'user',
    history: [],
  }
}

// ── CRUD ─────────────────────────────────────────────────

// Create a new action item. Returns the created item or null.
export function createActionItem(payload) {
  if (!payload || !payload.title || !payload.clientSlug) return null
  const all = readAll()
  const id = makeId()
  const item = {
    ...emptyActionItem(),
    ...payload,
    id,
    createdAt: nowIso(),
    history: [{
      at: nowIso(),
      action: 'created',
      note: payload.createdBy === 'system' ? `Auto-generated (${payload.type})` : 'Created manually',
    }],
  }
  all[id] = item
  return writeAll(all) ? item : null
}

export function getActionItem(id) {
  const all = readAll()
  return all[id] || null
}

export function listAllActionItems() {
  return Object.values(readAll())
}

// All items for a given client (optionally filtered by report)
export function listItemsForClient(clientSlug, reportId = null) {
  const all = readAll()
  return Object.values(all).filter(item => {
    if (item.clientSlug !== clientSlug) return false
    if (reportId && item.reportId && item.reportId !== reportId) return false
    return true
  })
}

// Items for a specific vendor (within a client)
export function listItemsForVendor(clientSlug, vendorName) {
  return listItemsForClient(clientSlug).filter(item => item.vendorName === vendorName)
}

// Items for a specific invoice
export function listItemsForInvoice(clientSlug, vendorName, invoiceNumber) {
  return listItemsForClient(clientSlug).filter(item =>
    item.vendorName === vendorName && item.invoiceNumber === invoiceNumber
  )
}

// Find an existing auto-generated item matching trigger criteria.
// Used to avoid creating duplicates when the same trigger fires again.
export function findExistingAutoItem({ clientSlug, type, vendorName = null, invoiceNumber = null, parentItemId = null }) {
  const all = readAll()
  return Object.values(all).find(item =>
    item.clientSlug === clientSlug &&
    item.type === type &&
    item.vendorName === vendorName &&
    item.invoiceNumber === invoiceNumber &&
    (parentItemId === null || item.parentItemId === parentItemId) &&
    item.createdBy === 'system' &&
    item.status !== ACTION_STATUS.CANCELLED &&
    item.status !== ACTION_STATUS.COMPLETED
  ) || null
}

// Update mutable fields on an item, optionally logging a history entry
export function updateActionItem(id, updates, historyEntry = null) {
  const all = readAll()
  if (!all[id]) return false
  all[id] = {
    ...all[id],
    ...updates,
  }
  if (historyEntry) {
    all[id].history = [
      ...(all[id].history || []),
      { at: nowIso(), ...historyEntry },
    ]
  }
  return writeAll(all)
}

// Delete an item (and its children). Used rarely — most lifecycle changes
// go through markCompleted/markCancelled/snooze instead.
export function deleteActionItem(id) {
  const all = readAll()
  if (!all[id]) return false
  // Delete children first
  const children = Object.values(all).filter(item => item.parentItemId === id)
  for (const child of children) {
    delete all[child.id]
  }
  delete all[id]
  return writeAll(all)
}

// ── Lifecycle transitions ────────────────────────────────

export function markCompleted(id, note = '') {
  return updateActionItem(id, {
    status: ACTION_STATUS.COMPLETED,
    snoozedUntil: null,
  }, {
    action: 'completed',
    note: note || 'Marked as completed',
  })
}

export function markCancelled(id, note = '') {
  return updateActionItem(id, {
    status: ACTION_STATUS.CANCELLED,
    snoozedUntil: null,
  }, {
    action: 'cancelled',
    note: note || 'Marked as cancelled',
  })
}

// Snooze: hide from main list until a future date/time
export function snoozeItem(id, snoozeUntilIso, note = '') {
  return updateActionItem(id, {
    status: ACTION_STATUS.SNOOZED,
    snoozedUntil: snoozeUntilIso,
  }, {
    action: 'snoozed',
    note: note || `Snoozed until ${snoozeUntilIso}`,
  })
}

// Unsnooze (called when a snoozed item's wake time has passed)
export function unsnooze(id) {
  return updateActionItem(id, {
    status: ACTION_STATUS.OPEN,
    snoozedUntil: null,
  }, {
    action: 'unsnoozed',
    note: 'Returned to open after snooze period',
  })
}

// Reopen a completed/cancelled item
export function reopenItem(id, note = '') {
  return updateActionItem(id, {
    status: ACTION_STATUS.OPEN,
    snoozedUntil: null,
  }, {
    action: 'reopened',
    note: note || 'Reopened',
  })
}

// ── Filtering & derived state ───────────────────────────

// Auto-unsnooze any items whose snooze period has elapsed.
// Should be called when the user loads the Action Items view.
export function reconcileSnoozedItems() {
  const all = readAll()
  const now = new Date()
  let changed = false
  for (const item of Object.values(all)) {
    if (item.status === ACTION_STATUS.SNOOZED && item.snoozedUntil) {
      if (new Date(item.snoozedUntil) <= now) {
        item.status = ACTION_STATUS.OPEN
        item.snoozedUntil = null
        item.history = [
          ...(item.history || []),
          { at: nowIso(), action: 'unsnoozed', note: 'Auto-returned to open after snooze period' },
        ]
        changed = true
      }
    }
  }
  if (changed) writeAll(all)
}

// Compute days-to-due (positive = future, 0 = today, negative = overdue).
// Returns null if no due date.
export function daysToDue(item) {
  if (!item || !item.dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(item.dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.round((due - today) / (1000 * 60 * 60 * 24))
}

// Get the urgency tier of an item based on due date and status
export function getUrgencyTier(item) {
  if (!item) return 'none'
  if (item.status === ACTION_STATUS.COMPLETED || item.status === ACTION_STATUS.CANCELLED) return 'done'
  if (item.status === ACTION_STATUS.SNOOZED) return 'snoozed'
  const days = daysToDue(item)
  if (days === null) return 'no-date'
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 1) return 'tomorrow'
  if (days <= 7) return 'this-week'
  return 'future'
}

// Format a human-readable due indicator
export function formatDueIndicator(item) {
  if (!item || !item.dueDate) return 'No due date'
  if (item.status === ACTION_STATUS.SNOOZED) {
    return item.snoozedUntil ? `Snoozed until ${new Date(item.snoozedUntil).toLocaleDateString()}` : 'Snoozed'
  }
  const days = daysToDue(item)
  if (days === null) return 'No due date'
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days <= 7) return `Due in ${days} days`
  return `Due ${new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

// Returns child items of a given parent
export function getChildren(parentId) {
  if (!parentId) return []
  return Object.values(readAll()).filter(item => item.parentItemId === parentId)
}

// Count of open items (open or snoozed-but-due) needing user attention
export function countActiveItems(clientSlug = null) {
  const items = clientSlug ? listItemsForClient(clientSlug) : listAllActionItems()
  return items.filter(item =>
    item.status === ACTION_STATUS.OPEN || item.status === ACTION_STATUS.SNOOZED
  ).length
}

// Count of overdue + due-today items (for notification badge)
export function countUrgentItems(clientSlug = null) {
  const items = clientSlug ? listItemsForClient(clientSlug) : listAllActionItems()
  return items.filter(item => {
    if (item.status !== ACTION_STATUS.OPEN) return false
    const tier = getUrgencyTier(item)
    return tier === 'overdue' || tier === 'today'
  }).length
}

// Group items into open (active) and completed/cancelled (history)
export function partitionByStatus(items) {
  const active = []
  const history = []
  for (const item of items) {
    if (item.status === ACTION_STATUS.COMPLETED || item.status === ACTION_STATUS.CANCELLED) {
      history.push(item)
    } else {
      active.push(item)
    }
  }
  return { active, history }
}

// Sort items: overdue first, then today, then by due date ascending
export function sortByUrgency(items) {
  const tierOrder = { overdue: 0, today: 1, tomorrow: 2, 'this-week': 3, future: 4, snoozed: 5, 'no-date': 6, done: 7, none: 8 }
  return [...items].sort((a, b) => {
    const aTier = tierOrder[getUrgencyTier(a)] ?? 99
    const bTier = tierOrder[getUrgencyTier(b)] ?? 99
    if (aTier !== bTier) return aTier - bTier
    // Within tier, sort by due date
    const aDays = daysToDue(a)
    const bDays = daysToDue(b)
    if (aDays === null) return 1
    if (bDays === null) return -1
    return aDays - bDays
  })
}