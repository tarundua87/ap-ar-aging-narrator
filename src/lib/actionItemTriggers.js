// Auto-generation logic for action items.
// Called by vendorProfiles.js after a profile or invoice override is saved.
// Decides what new items to create (or not duplicate).
//
// Triggers handled:
//   - Reminder date set → reminder item
//   - Action flag = 'hold' → hold-expiry item (default +30 days if no date specified)
//   - Action flag = 'disputed' → dispute-followup item (default +14 days)
//   - Invoice flag = 'on-hold' → hold-expiry item (child of vendor's, if any)
//   - Invoice flag = 'disputed' → dispute-followup item (child of vendor's, if any)

import {
  createActionItem, findExistingAutoItem, ACTION_TYPES,
} from './actionItems'

// Default cadence values (kept here in case Master Config isn't loaded yet).
// The Master Config can override these — checked at trigger time.
const DEFAULT_DISPUTE_CADENCE_DAYS = 14
const DEFAULT_HOLD_DEFAULT_DAYS = 30

function addDays(daysFromToday) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}

// Read user's preferred default cadences from Master Config if available.
// Master Config items live under category 'actionItemSettings' — we add
// that category in File C3. Until then, fall back to constants here.
function readDefaults() {
  if (typeof window === 'undefined') {
    return {
      disputeCadenceDays: DEFAULT_DISPUTE_CADENCE_DAYS,
      holdDefaultDays: DEFAULT_HOLD_DEFAULT_DAYS,
    }
  }
  try {
    const raw = window.localStorage.getItem('ap-narrator:masterConfig')
    if (!raw) return {
      disputeCadenceDays: DEFAULT_DISPUTE_CADENCE_DAYS,
      holdDefaultDays: DEFAULT_HOLD_DEFAULT_DAYS,
    }
    const cfg = JSON.parse(raw) || {}
    const settings = cfg.actionItemSettings || []
    const disputeItem = settings.find(s => s.id === 'dispute-cadence')
    const holdItem = settings.find(s => s.id === 'hold-default-days')
    return {
      disputeCadenceDays: disputeItem?.meta?.days ?? DEFAULT_DISPUTE_CADENCE_DAYS,
      holdDefaultDays: holdItem?.meta?.days ?? DEFAULT_HOLD_DEFAULT_DAYS,
    }
  } catch {
    return {
      disputeCadenceDays: DEFAULT_DISPUTE_CADENCE_DAYS,
      holdDefaultDays: DEFAULT_HOLD_DEFAULT_DAYS,
    }
  }
}

// ── Triggers for VENDOR-LEVEL profile changes ───────────

// Called after a vendor profile is saved.
// Returns an array of created action items (or empty).
export function triggerOnVendorProfileSave({ clientSlug, vendorName, profile, profileDescribed }) {
  const created = []
  if (!clientSlug || !vendorName || !profile) return created

  const defaults = readDefaults()

  // Reminder date trigger
  if (profile.reminderDate) {
    const existing = findExistingAutoItem({
      clientSlug, type: ACTION_TYPES.REMINDER, vendorName,
    })
    if (!existing) {
      const item = createActionItem({
        clientSlug,
        type: ACTION_TYPES.REMINDER,
        title: `Follow up with ${vendorName}`,
        vendorName,
        dueDate: profile.reminderDate,
        notes: profile.notes || '',
        createdBy: 'system',
      })
      if (item) created.push(item)
    } else {
      // Existing item — leave as-is (user manages manually per our decision)
    }
  }

  // Action flag triggers — use describeProfile labels if available
  const actionFlagLabel = profileDescribed?.actionFlag || ''

  if (/^hold$/i.test(actionFlagLabel)) {
    const existing = findExistingAutoItem({
      clientSlug, type: ACTION_TYPES.HOLD_EXPIRY, vendorName,
    })
    if (!existing) {
      const item = createActionItem({
        clientSlug,
        type: ACTION_TYPES.HOLD_EXPIRY,
        title: `${vendorName} hold expires`,
        vendorName,
        dueDate: addDays(defaults.holdDefaultDays),
        notes: `Hold flag set on vendor profile. Default ${defaults.holdDefaultDays}-day review window.`,
        createdBy: 'system',
      })
      if (item) created.push(item)
    }
  }

  if (/disputed/i.test(actionFlagLabel)) {
    const existing = findExistingAutoItem({
      clientSlug, type: ACTION_TYPES.DISPUTE_FOLLOWUP, vendorName,
    })
    if (!existing) {
      const item = createActionItem({
        clientSlug,
        type: ACTION_TYPES.DISPUTE_FOLLOWUP,
        title: `Follow up on ${vendorName} dispute`,
        vendorName,
        dueDate: addDays(defaults.disputeCadenceDays),
        recurringCadenceDays: defaults.disputeCadenceDays,
        notes: `Dispute flag set on vendor profile. Follow up every ${defaults.disputeCadenceDays} days.`,
        createdBy: 'system',
      })
      if (item) created.push(item)
    }
  }

  return created
}

// ── Triggers for INVOICE-LEVEL override changes ─────────

// Called after an invoice override is saved.
// Returns an array of created action items (or empty).
// Invoice-level items can be CHILD items of a vendor-level item (parent/child model).
export function triggerOnInvoiceOverrideSave({
  clientSlug, reportId, vendorName, invoiceNumber, override, overrideDescribed,
}) {
  const created = []
  if (!clientSlug || !vendorName || !invoiceNumber || !override) return created

  const defaults = readDefaults()
  const flagLabel = overrideDescribed?.flag || ''

  // Find any existing vendor-level item of the same type to use as parent
  const findVendorParent = (type) => {
    return findExistingAutoItem({
      clientSlug, type, vendorName, invoiceNumber: null,
    })
  }

  if (/^on hold$/i.test(flagLabel)) {
    const existing = findExistingAutoItem({
      clientSlug, type: ACTION_TYPES.HOLD_EXPIRY, vendorName, invoiceNumber,
    })
    if (!existing) {
      const parent = findVendorParent(ACTION_TYPES.HOLD_EXPIRY)
      const item = createActionItem({
        clientSlug,
        reportId,
        type: ACTION_TYPES.HOLD_EXPIRY,
        title: `Invoice ${invoiceNumber} hold expires`,
        vendorName,
        invoiceNumber,
        parentItemId: parent?.id || null,
        dueDate: addDays(defaults.holdDefaultDays),
        notes: `Hold flag set on invoice. Default ${defaults.holdDefaultDays}-day review.`,
        createdBy: 'system',
      })
      if (item) created.push(item)
    }
  }

  if (/^disputed$/i.test(flagLabel)) {
    const existing = findExistingAutoItem({
      clientSlug, type: ACTION_TYPES.DISPUTE_FOLLOWUP, vendorName, invoiceNumber,
    })
    if (!existing) {
      const parent = findVendorParent(ACTION_TYPES.DISPUTE_FOLLOWUP)
      const item = createActionItem({
        clientSlug,
        reportId,
        type: ACTION_TYPES.DISPUTE_FOLLOWUP,
        title: `Follow up on disputed invoice ${invoiceNumber}`,
        vendorName,
        invoiceNumber,
        parentItemId: parent?.id || null,
        dueDate: addDays(defaults.disputeCadenceDays),
        recurringCadenceDays: defaults.disputeCadenceDays,
        notes: `Dispute flag set on this specific invoice.`,
        createdBy: 'system',
      })
      if (item) created.push(item)
    }
  }

  // Cancelled / Credit received → not actionable, no item generated
  // Paid manually → not actionable, no item generated
  // Awaiting documentation → could be a reminder, but we skip for now to avoid noise

  return created
}

// Helper: summarize what was triggered (for showing a toast/notification)
export function summarizeTriggerResults(items) {
  if (!items || items.length === 0) return null
  if (items.length === 1) {
    return `Created 1 action item: "${items[0].title}"`
  }
  return `Created ${items.length} action items`
}