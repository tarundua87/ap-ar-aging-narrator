// Vendor profile storage — per-client profiles + global suggestion bank.
// Also handles invoice-level overrides (per-invoice flags & notes).
//
// Storage keys:
//   "vendor-profiles:[clientSlug]"   → per-client vendor profile map
//   "invoice-overrides:[clientSlug]:[reportId]" → per-report invoice overrides
//   "vendor-suggestions"             → global vendor-name → [prior profiles]

import { getEnabledItems, getItemById } from './masterConfig'

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
    natureId: 'other',           // NEW — vendor category (rent, utilities, etc.)
    is1099Eligible: false,        // NEW — US 1099 reporting eligibility
    paymentTermsId: 'default',
    customTermsDays: null,        // when paymentTermsId === 'custom'
    notes: '',
    reminderDate: '',             // ISO date YYYY-MM-DD
    actionFlagId: 'none',
    statusId: 'pending',
    updatedAt: null,
  }
}

export function emptyInvoiceOverride() {
  return {
    flagId: 'none',
    statusId: 'open',
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
    all[invoiceKey(vendorName, invoiceNumber)] = {
      ...override,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(invoiceOverridesKey(clientSlug, reportId), JSON.stringify(all))
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
    actionFlag: getItemById('actionFlags', profile.actionFlagId)?.label || 'None',
    status: getItemById('statuses', profile.statusId)?.label || 'Pending',
  }
  return {
    ...lookups,
    is1099Eligible: !!profile.is1099Eligible,
    customTermsDays: profile.customTermsDays || null,
    notes: profile.notes || '',
    reminderDate: profile.reminderDate || '',
  }
}

export function describeInvoiceOverride(override) {
  if (!override) return null
  return {
    flag: getItemById('invoiceFlags', override.flagId)?.label || 'None',
    status: getItemById('invoiceStatuses', override.statusId)?.label || 'Open',
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
    profile.paymentTermsId !== empty.paymentTermsId ||
    (profile.notes && profile.notes.trim()) ||
    profile.reminderDate ||
    profile.actionFlagId !== empty.actionFlagId ||
    profile.statusId !== empty.statusId
  )
}

export function invoiceOverrideIsConfigured(override) {
  if (!override) return false
  const empty = emptyInvoiceOverride()
  return (
    override.flagId !== empty.flagId ||
    override.statusId !== empty.statusId ||
    (override.notes && override.notes.trim())
  )
}