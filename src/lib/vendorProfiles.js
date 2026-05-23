// Vendor profile storage — per-client profiles + global suggestion bank.
// Also handles invoice-level overrides (per-invoice flags & notes).
//
// Storage keys:
//   "vendor-profiles:[clientSlug]"   → per-client vendor profile map
//   "invoice-overrides:[clientSlug]:[reportId]" → per-report invoice overrides
//   "vendor-suggestions"             → global vendor-name → [prior profiles]

import { getEnabledItems, getItemById } from './masterConfig'
import { triggerOnVendorProfileSave, triggerOnInvoiceOverrideSave } from './actionItemTriggers'

const PROFILES_KEY_PREFIX = 'vendor-profiles:'
const INVOICE_OVERRIDES_KEY_PREFIX = 'invoice-overrides:'
const SUGGESTIONS_KEY = 'vendor-suggestions'

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

// ── Default empty shapes ─────────────────────────────────

export function emptyProfile() {
  return {
    paymentMethodId: 'manual',
    criticalityId: 'standard',
    natureId: 'other',
    is1099Eligible: false,
    isFlagged: false,             // NEW — replaces Action Flag dropdown (details go in Notes)
    defaultTakeActionId: 'none',  // NEW — auto-applies to new invoices on next upload
    paymentTermsId: 'default',
    customTermsDays: null,
    notes: '',
    reminderDate: '',
    updatedAt: null,
  }
}

export function emptyInvoiceOverride() {
  return {
    isFlagged: false,             // NEW — replaces flagId dropdown (details go in Notes)
    statusId: 'open',
    takeActionId: 'none',         // NEW — Full Pay, Part Pay, Hold, Disputed, Pending Reconciliation, Auto Pay
    partPaymentAmount: null,      // NEW — only meaningful when takeActionId === 'part-pay'
    reminderDate: '',             // NEW — invoice-level reminder
    notes: '',
    updatedAt: null,
  }
}

// ── Per-client profile storage ───────────────────────────

export function getClientProfiles(clientSlug) {
  if (!isBrowser() || !clientSlug) return {}
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY_PREFIX + clientSlug)
    return raw ? JSON.parse(raw) || {} : {}
  } catch {
    return {}
  }
}

export function getVendorProfile(clientSlug, vendorName) {
  const all = getClientProfiles(clientSlug)
  return all[vendorName] || emptyProfile()
}

export function saveVendorProfile(clientSlug, vendorName, profile) {
  if (!isBrowser() || !clientSlug || !vendorName) return false
  try {
    const all = getClientProfiles(clientSlug)
    const enriched = { ...profile, updatedAt: new Date().toISOString() }
    all[vendorName] = enriched
    window.localStorage.setItem(PROFILES_KEY_PREFIX + clientSlug, JSON.stringify(all))
    addToSuggestionBank(vendorName, enriched, clientSlug)

    // Fire action item triggers (auto-create reminders, holds, disputes)
    try {
      const profileDescribed = describeProfile(enriched)
      triggerOnVendorProfileSave({
        clientSlug,
        vendorName,
        profile: enriched,
        profileDescribed,
      })
    } catch (err) {
      console.error('Action item trigger failed (vendor)', err)
    }

    return true
  } catch (err) {
    console.error('Failed to save vendor profile', err)
    return false
  }
}

export function saveAllProfiles(clientSlug, profileMap) {
  if (!isBrowser() || !clientSlug) return false
  try {
    const enriched = {}
    const now = new Date().toISOString()
    for (const [vendorName, profile] of Object.entries(profileMap)) {
      enriched[vendorName] = { ...profile, updatedAt: now }
      addToSuggestionBank(vendorName, enriched[vendorName], clientSlug)
    }
    window.localStorage.setItem(PROFILES_KEY_PREFIX + clientSlug, JSON.stringify(enriched))

    // Fire triggers for each vendor (e.g., bulk save from New Vendors Modal)
    for (const [vendorName, profile] of Object.entries(enriched)) {
      try {
        const profileDescribed = describeProfile(profile)
        triggerOnVendorProfileSave({
          clientSlug,
          vendorName,
          profile,
          profileDescribed,
        })
      } catch (err) {
        console.error('Action item trigger failed (bulk vendor)', err)
      }
    }

    return true
  } catch (err) {
    console.error('Failed to save profiles', err)
    return false
  }
}

export function deleteVendorProfile(clientSlug, vendorName) {
  if (!isBrowser() || !clientSlug) return false
  try {
    const all = getClientProfiles(clientSlug)
    delete all[vendorName]
    window.localStorage.setItem(PROFILES_KEY_PREFIX + clientSlug, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

// ── Invoice-level overrides ──────────────────────────────

function invoiceOverridesKey(clientSlug, reportId) {
  return INVOICE_OVERRIDES_KEY_PREFIX + clientSlug + ':' + reportId
}

export function getInvoiceOverrides(clientSlug, reportId) {
  if (!isBrowser() || !clientSlug || !reportId) return {}
  try {
    const raw = window.localStorage.getItem(invoiceOverridesKey(clientSlug, reportId))
    return raw ? JSON.parse(raw) || {} : {}
  } catch {
    return {}
  }
}

// Use a composite key — vendor + invoice number — to keep overrides unique
function invoiceKey(vendorName, invoiceNumber) {
  return vendorName + '||' + invoiceNumber
}

export function getInvoiceOverride(clientSlug, reportId, vendorName, invoiceNumber) {
  const all = getInvoiceOverrides(clientSlug, reportId)
  return all[invoiceKey(vendorName, invoiceNumber)] || emptyInvoiceOverride()
}

export function saveInvoiceOverride(clientSlug, reportId, vendorName, invoiceNumber, override) {
  if (!isBrowser() || !clientSlug || !reportId) return false
  try {
    const all = getInvoiceOverrides(clientSlug, reportId)
    const enriched = { ...override, updatedAt: new Date().toISOString() }
    all[invoiceKey(vendorName, invoiceNumber)] = enriched
    window.localStorage.setItem(invoiceOverridesKey(clientSlug, reportId), JSON.stringify(all))

    // Fire invoice-level action item triggers
    try {
      const overrideDescribed = describeInvoiceOverride(enriched)
      triggerOnInvoiceOverrideSave({
        clientSlug,
        reportId,
        vendorName,
        invoiceNumber,
        override: enriched,
        overrideDescribed,
      })
    } catch (err) {
      console.error('Action item trigger failed (invoice)', err)
    }

    return true
  } catch (err) {
    console.error('Failed to save invoice override', err)
    return false
  }
}

export function saveAllInvoiceOverrides(clientSlug, reportId, overrideMap) {
  if (!isBrowser() || !clientSlug || !reportId) return false
  try {
    const now = new Date().toISOString()
    const enriched = {}
    for (const [key, override] of Object.entries(overrideMap)) {
      enriched[key] = { ...override, updatedAt: now }
    }
    window.localStorage.setItem(invoiceOverridesKey(clientSlug, reportId), JSON.stringify(enriched))
    return true
  } catch (err) {
    console.error('Failed to save invoice overrides', err)
    return false
  }
}

// ── Global suggestion bank ───────────────────────────────

export function readSuggestionBank() {
  if (!isBrowser()) return {}
  try {
    const raw = window.localStorage.getItem(SUGGESTIONS_KEY)
    return raw ? JSON.parse(raw) || {} : {}
  } catch {
    return {}
  }
}

function writeSuggestionBank(data) {
  if (!isBrowser()) return false
  try {
    window.localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

function addToSuggestionBank(vendorName, profile, originClientSlug) {
  const bank = readSuggestionBank()
  if (!bank[vendorName]) bank[vendorName] = []
  bank[vendorName] = bank[vendorName].filter(s => s.clientSlug !== originClientSlug)
  bank[vendorName].push({
    clientSlug: originClientSlug,
    profile,
    suggestedAt: new Date().toISOString(),
  })
  bank[vendorName] = bank[vendorName]
    .sort((a, b) => new Date(b.suggestedAt) - new Date(a.suggestedAt))
    .slice(0, 5)
  writeSuggestionBank(bank)
}

export function getSuggestionsForVendor(vendorName, currentClientSlug) {
  const bank = readSuggestionBank()
  const entries = bank[vendorName] || []
  return entries.filter(s => s.clientSlug !== currentClientSlug)
}

export function autoSuggestProfile(vendorName, currentClientSlug) {
  const suggestions = getSuggestionsForVendor(vendorName, currentClientSlug)
  if (suggestions.length === 0) return null
  const top = suggestions[0]
  return { profile: top.profile, sourceClientSlug: top.clientSlug }
}

// ── Helpers used by the rest of the app ──────────────────

export function findUnprofiledVendors(clientSlug, vendorList) {
  const profiles = getClientProfiles(clientSlug)
  return (vendorList || []).filter(v => !profiles[v.name])
}

// Resolve the actual days-of-credit for a profile (e.g., "Net 30" → 30)
export function resolveTermsDays(profile) {
  if (!profile) return null
  if (profile.paymentTermsId === 'default') return null
  if (profile.paymentTermsId === 'custom') {
    const n = parseInt(profile.customTermsDays, 10)
    return isNaN(n) ? null : n
  }
  const item = getItemById('paymentTerms', profile.paymentTermsId)
  return item?.meta?.days ?? null
}

// Is an invoice "actually" overdue given its profile's payment-terms override?
export function isInvoiceOverdueByProfile(invoice, profile) {
  if (!profile) return invoice.daysPastDue > 0
  const days = resolveTermsDays(profile)
  if (days === null) return invoice.daysPastDue > 0
  return invoice.daysPastDue > days
}

// Convert a profile to a human-readable description (used in the AI prompt
// and in UI tooltips). Resolves IDs into labels using master config.
export function describeProfile(profile) {
  if (!profile) return null
  const lookups = {
    paymentMethod: getItemById('paymentMethods', profile.paymentMethodId)?.label || 'Unknown',
    criticality: getItemById('criticalityLevels', profile.criticalityId)?.label || 'Unknown',
    nature: getItemById('vendorNatures', profile.natureId)?.label || 'Other',
    paymentTerms: getItemById('paymentTerms', profile.paymentTermsId)?.label || 'Default',
  }
  return {
    ...lookups,
    is1099Eligible: !!profile.is1099Eligible,
    isFlagged: !!profile.isFlagged,
    customTermsDays: profile.customTermsDays || null,
    notes: profile.notes || '',
    reminderDate: profile.reminderDate || '',
  }
}

export function describeInvoiceOverride(override) {
  if (!override) return null
  return {
    isFlagged: !!override.isFlagged,
    status: getItemById('invoiceStatuses', override.statusId)?.label || 'Open',
    takeAction: getItemById('invoiceTakeActions', override.takeActionId)?.label || 'None',
    takeActionId: override.takeActionId || 'none',
    partPaymentAmount: override.partPaymentAmount || null,
    reminderDate: override.reminderDate || '',
    notes: override.notes || '',
  }
}

// Returns true if the profile has any meaningful (non-default) values.
// Used to decide whether to show profile indicators in the UI.
export function profileIsConfigured(profile) {
  if (!profile) return false
  const empty = emptyProfile()
  return (
    profile.paymentMethodId !== empty.paymentMethodId ||
    profile.criticalityId !== empty.criticalityId ||
    profile.natureId !== empty.natureId ||
    !!profile.is1099Eligible !== empty.is1099Eligible ||
    !!profile.isFlagged !== empty.isFlagged ||
    profile.paymentTermsId !== empty.paymentTermsId ||
    profile.defaultTakeActionId !== empty.defaultTakeActionId ||
    (profile.notes && profile.notes.trim()) ||
    profile.reminderDate
  )
}

export function invoiceOverrideIsConfigured(override) {
  if (!override) return false
  const empty = emptyInvoiceOverride()
  return (
    !!override.isFlagged !== empty.isFlagged ||
    override.statusId !== empty.statusId ||
    override.takeActionId !== empty.takeActionId ||
    (override.partPaymentAmount && override.partPaymentAmount > 0) ||
    override.reminderDate ||
    (override.notes && override.notes.trim())
  )
}

// ── Migration helpers ───────────────────────────────────
// These run silently when reading existing data to keep the schema clean
// across version changes. Old fields are stripped; new fields default sensibly.

function migrateVendorProfile(profile) {
  if (!profile) return profile
  const migrated = { ...profile }
  // Strip removed fields
  delete migrated.actionFlagId
  delete migrated.statusId
  // Ensure new fields exist
  if (typeof migrated.isFlagged !== 'boolean') migrated.isFlagged = false
  if (!migrated.defaultTakeActionId) migrated.defaultTakeActionId = 'none'
  return migrated
}

function migrateInvoiceOverride(override) {
  if (!override) return override
  const migrated = { ...override }
  // Convert old flagId dropdown to isFlagged checkbox
  if ('flagId' in migrated) {
    migrated.isFlagged = migrated.flagId && migrated.flagId !== 'none'
    delete migrated.flagId
  }
  // Ensure new fields exist
  if (typeof migrated.isFlagged !== 'boolean') migrated.isFlagged = false
  if (!migrated.takeActionId) migrated.takeActionId = 'none'
  if (migrated.partPaymentAmount === undefined) migrated.partPaymentAmount = null
  if (typeof migrated.reminderDate !== 'string') migrated.reminderDate = ''
  return migrated
}

// Apply migration on read by wrapping the existing read functions
const _origGetClientProfiles = getClientProfiles
export function getMigratedClientProfiles(clientSlug) {
  const raw = _origGetClientProfiles(clientSlug)
  const migrated = {}
  for (const [name, profile] of Object.entries(raw)) {
    migrated[name] = migrateVendorProfile(profile)
  }
  return migrated
}

const _origGetInvoiceOverrides = getInvoiceOverrides
export function getMigratedInvoiceOverrides(clientSlug, reportId) {
  const raw = _origGetInvoiceOverrides(clientSlug, reportId)
  const migrated = {}
  for (const [key, override] of Object.entries(raw)) {
    migrated[key] = migrateInvoiceOverride(override)
  }
  return migrated
}