// Auto-generation logic for action items.
// Called by vendorProfiles.js after a profile or invoice override is saved.
// Decides what new items to create (or not duplicate).
//
// Phase 2A design decisions:
//   - reminderDate is the user's chosen follow-up date — REQUIRED for an
//     action item to be created. We do not use system defaults anymore.
//   - Vendor-level Action Flag triggers are REMOVED entirely (per locked scope).
//     Existing items from old flag triggers are left in place — bookkeeper
//     can mark them complete or cancelled manually.
//   - Invoice-level Take Action drives the TYPE of follow-up item:
//       hold          → HOLD_EXPIRY
//       disputed      → DISPUTE_FOLLOWUP (no longer recurring)
//       pending-recon → RECONCILIATION_FOLLOWUP
//       (anything else with a reminderDate) → generic REMINDER
//   - Auto Pay is NOT in the Take Action enum — it lives on the vendor
//     profile as paymentMethodId. Auto-pay invoices generate no items here.

import {
  createActionItem, findExistingAutoItem, ACTION_TYPES,
} from './actionItems'

// ── Vendor-level triggers ────────────────────────────────

// Called after a vendor profile is saved.
// Returns an array of created action items (or empty).
//
// Only one vendor-level trigger remains: a vendor-level reminderDate creates
// a generic REMINDER item. Action Flag triggers are removed per Phase 2A.
export function triggerOnVendorProfileSave({ clientSlug, vendorName, profile, profileDescribed }) {
  const created = []
  if (!clientSlug || !vendorName || !profile) return created

  // Reminder date trigger — generic reminder, no Take Action context at vendor level
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
    }
    // Existing item — leave as-is; user manages manually
  }

  return created
}

// ── Invoice-level triggers ──────────────────────────────

// Called after an invoice override is saved.
// Returns an array of created action items (or empty).
//
// Rule: reminderDate is required. Without it, no item is created — regardless
// of takeActionId. The Take Action only colours the TYPE of follow-up.
//
// Invoice-level items can be CHILD items of a vendor-level item of the same
// type, so the bookkeeper sees them grouped under the parent vendor item.
export function triggerOnInvoiceOverrideSave({
  clientSlug, reportId, vendorName, invoiceNumber, override, overrideDescribed,
}) {
  const created = []
  if (!clientSlug || !vendorName || !invoiceNumber || !override) return created

  // Hard requirement: must have a reminderDate for any item to be created.
  // This implements the "no defaults, user must pick the date" decision.
  if (!override.reminderDate) return created

  // Map takeActionId to action item type
  const takeActionId = override.takeActionId || 'none'
  let type = null
  let titlePrefix = null

  if (takeActionId === 'hold') {
    type = ACTION_TYPES.HOLD_EXPIRY
    titlePrefix = `Invoice ${invoiceNumber} hold review`
  } else if (takeActionId === 'disputed') {
    type = ACTION_TYPES.DISPUTE_FOLLOWUP
    titlePrefix = `Follow up on disputed invoice ${invoiceNumber}`
  } else if (takeActionId === 'pending-recon') {
    type = ACTION_TYPES.RECONCILIATION_FOLLOWUP
    titlePrefix = `Reconciliation check on invoice ${invoiceNumber}`
  } else {
    // Generic reminder for none / full-pay / part-pay with a reminderDate set
    type = ACTION_TYPES.REMINDER
    titlePrefix = `Reminder on invoice ${invoiceNumber}`
  }

  // Find any existing vendor-level item of the same type to use as parent
  const findVendorParent = (parentType) => {
    return findExistingAutoItem({
      clientSlug, type: parentType, vendorName, invoiceNumber: null,
    })
  }

  // De-duplicate: don't create if an open item of this type already exists
  // for this specific invoice
  const existing = findExistingAutoItem({
    clientSlug, type, vendorName, invoiceNumber,
  })
  if (existing) return created

  const parent = findVendorParent(type)
  const notes = override.notes
    ? override.notes
    : `Auto-created from invoice Take Action: ${overrideDescribed?.takeAction || takeActionId}`

  const item = createActionItem({
    clientSlug,
    reportId,
    type,
    title: titlePrefix,
    vendorName,
    invoiceNumber,
    parentItemId: parent?.id || null,
    dueDate: override.reminderDate,
    notes,
    createdBy: 'system',
  })
  if (item) created.push(item)

  return created
}

// ── Helper: summarize trigger results ───────────────────

export function summarizeTriggerResults(items) {
  if (!items || items.length === 0) return null
  if (items.length === 1) {
    return `Created 1 action item: "${items[0].title}"`
  }
  return `Created ${items.length} action items`
}