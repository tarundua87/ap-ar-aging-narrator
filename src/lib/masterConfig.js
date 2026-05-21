// Master configuration — single source of truth for all dropdown options.
// Pre-populated with sensible defaults so the app works out of the box.
// User can add, edit, disable, or reset items via the Settings screen.
//
// Storage key: "ap-narrator:masterConfig"
// Each option is an object: { id, label, enabled, isDefault, meta? }
//   - id: stable identifier used for storage (auto-generated if not provided)
//   - label: display string shown in dropdowns
//   - enabled: whether to show in dropdowns
//   - isDefault: true if shipped with the app (cannot be deleted, only disabled)
//   - meta: optional extra data (e.g., color, icon, description)

const STORAGE_KEY = 'ap-narrator:masterConfig'

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function makeId(label) {
  return String(label).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// ── Default master configuration ────────────────────────────

export const DEFAULT_CONFIG = {
  paymentMethods: [
    { id: 'manual', label: 'Manual', enabled: true, isDefault: true },
    { id: 'ach-pad', label: 'ACH / PAD', enabled: true, isDefault: true },
    { id: 'credit-card', label: 'Credit Card', enabled: true, isDefault: true },
    { id: 'standing-instruction', label: 'Standing Instruction', enabled: true, isDefault: true },
    { id: 'auto-debit', label: 'Auto-Debit', enabled: true, isDefault: true },
    { id: 'wire-transfer', label: 'Wire Transfer', enabled: true, isDefault: true },
    { id: 'check', label: 'Check', enabled: true, isDefault: true },
    { id: 'other', label: 'Other', enabled: true, isDefault: true },
  ],
  criticalityLevels: [
    { id: 'critical', label: 'Critical', enabled: true, isDefault: true, meta: { description: 'Cannot be delayed (rent, utilities, taxes)', color: '#c8401a' } },
    { id: 'standard', label: 'Standard', enabled: true, isDefault: true, meta: { description: 'Normal payment priority', color: '#b87d00' } },
    { id: 'flexible', label: 'Flexible', enabled: true, isDefault: true, meta: { description: 'Can be delayed if needed', color: '#15803d' } },
  ],
  paymentTerms: [
    { id: 'default', label: 'Default (use due date)', enabled: true, isDefault: true, meta: { days: null } },
    { id: 'net-15', label: 'Net 15', enabled: true, isDefault: true, meta: { days: 15 } },
    { id: 'net-30', label: 'Net 30', enabled: true, isDefault: true, meta: { days: 30 } },
    { id: 'net-45', label: 'Net 45', enabled: true, isDefault: true, meta: { days: 45 } },
    { id: 'net-60', label: 'Net 60', enabled: true, isDefault: true, meta: { days: 60 } },
    { id: 'net-90', label: 'Net 90', enabled: true, isDefault: true, meta: { days: 90 } },
    { id: 'net-120', label: 'Net 120', enabled: true, isDefault: true, meta: { days: 120 } },
    { id: 'due-on-receipt', label: 'Due on Receipt', enabled: true, isDefault: true, meta: { days: 0 } },
    { id: 'custom', label: 'Custom', enabled: true, isDefault: true, meta: { days: null, requiresInput: true } },
  ],
  actionFlags: [
    { id: 'none', label: 'None', enabled: true, isDefault: true, meta: { icon: '' } },
    { id: 'auto-paying', label: 'Auto-paying', enabled: true, isDefault: true, meta: { icon: '🔄' } },
    { id: 'hold', label: 'Hold', enabled: true, isDefault: true, meta: { icon: '⏸' } },
    { id: 'follow-up', label: 'Active follow-up needed', enabled: true, isDefault: true, meta: { icon: '📞' } },
    { id: 'disputed', label: 'Disputed', enabled: true, isDefault: true, meta: { icon: '⚠️' } },
    { id: 'awaiting-approval', label: 'Awaiting approval', enabled: true, isDefault: true, meta: { icon: '⏳' } },
  ],
  statuses: [
    { id: 'pending', label: 'Pending', enabled: true, isDefault: true, meta: { color: '#b87d00' } },
    { id: 'action-taken', label: 'Action Taken', enabled: true, isDefault: true, meta: { color: '#0369a1' } },
    { id: 'resolved', label: 'Resolved', enabled: true, isDefault: true, meta: { color: '#15803d' } },
    { id: 'escalated', label: 'Escalated', enabled: true, isDefault: true, meta: { color: '#c8401a' } },
  ],
  // For invoice-level overrides
  invoiceFlags: [
    { id: 'none', label: 'None', enabled: true, isDefault: true, meta: { icon: '' } },
    { id: 'disputed', label: 'Disputed', enabled: true, isDefault: true, meta: { icon: '⚠️' } },
    { id: 'cancelled', label: 'Cancelled (credit received)', enabled: true, isDefault: true, meta: { icon: '↩️' } },
    { id: 'paid-manually', label: 'Paid manually', enabled: true, isDefault: true, meta: { icon: '✓' } },
    { id: 'on-hold', label: 'On hold', enabled: true, isDefault: true, meta: { icon: '⏸' } },
    { id: 'awaiting-docs', label: 'Awaiting documentation', enabled: true, isDefault: true, meta: { icon: '📄' } },
  ],
  invoiceStatuses: [
    { id: 'open', label: 'Open', enabled: true, isDefault: true, meta: { color: '#374151' } },
    { id: 'action-required', label: 'Action Required', enabled: true, isDefault: true, meta: { color: '#b87d00' } },
    { id: 'resolved', label: 'Resolved', enabled: true, isDefault: true, meta: { color: '#15803d' } },
    { id: 'escalated', label: 'Escalated', enabled: true, isDefault: true, meta: { color: '#c8401a' } },
  ],
  vendorNatures: [
    { id: 'rent', label: 'Rent', enabled: true, isDefault: true, meta: { icon: '🏢' } },
    { id: 'utilities', label: 'Utilities', enabled: true, isDefault: true, meta: { icon: '⚡' } },
    { id: 'inventory', label: 'Inventory / Cost of Goods', enabled: true, isDefault: true, meta: { icon: '📦' } },
    { id: 'professional-services', label: 'Professional Services', enabled: true, isDefault: true, meta: { icon: '💼' } },
    { id: 'software-saas', label: 'Software / SaaS', enabled: true, isDefault: true, meta: { icon: '💻' } },
    { id: 'equipment', label: 'Equipment', enabled: true, isDefault: true, meta: { icon: '🛠️' } },
    { id: 'insurance', label: 'Insurance', enabled: true, isDefault: true, meta: { icon: '🛡️' } },
    { id: 'tax-government', label: 'Tax / Government', enabled: true, isDefault: true, meta: { icon: '🏛️' } },
    { id: 'office-supplies', label: 'Office Supplies', enabled: true, isDefault: true, meta: { icon: '📎' } },
    { id: 'marketing-advertising', label: 'Marketing / Advertising', enabled: true, isDefault: true, meta: { icon: '📣' } },
    { id: 'telecom', label: 'Telecom', enabled: true, isDefault: true, meta: { icon: '📡' } },
    { id: 'banking-fees', label: 'Banking / Fees', enabled: true, isDefault: true, meta: { icon: '🏦' } },
    { id: 'other', label: 'Other', enabled: true, isDefault: true, meta: { icon: '•' } },
  ],
  actionItemSettings: [
    { id: 'dispute-cadence', label: 'Dispute Follow-up Cadence', enabled: true, isDefault: true, meta: { days: 14, icon: '⚠️', description: 'How many days between dispute follow-up checks' } },
    { id: 'hold-default-days', label: 'Hold Default Window', enabled: true, isDefault: true, meta: { days: 30, icon: '⏸', description: 'Default expiry for vendors/invoices put on Hold without a specific date' } },
    { id: 'overdue-color-threshold', label: 'Overdue Alert Color Threshold', enabled: true, isDefault: true, meta: { days: 0, icon: '🔴', description: 'Action items overdue past this many days show in red (0 = same day)' } },
    { id: 'urgent-window-days', label: 'Urgent Window', enabled: true, isDefault: true, meta: { days: 7, icon: '🟡', description: 'Items due within this many days are shown as urgent' } },
  ],
}

// ── Read / write storage ────────────────────────────────────

export function getMasterConfig() {
  if (!isBrowser()) return DEFAULT_CONFIG
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    const stored = JSON.parse(raw) || {}
    // Merge stored on top of defaults so newly added defaults appear
    // for users who configured the app before those were shipped.
    const merged = {}
    for (const category of Object.keys(DEFAULT_CONFIG)) {
      const defaults = DEFAULT_CONFIG[category]
      const userItems = stored[category] || []
      // Build a map of stored items by id, plus all default items
      const map = {}
      for (const item of defaults) map[item.id] = { ...item }
      for (const item of userItems) {
        if (map[item.id]) {
          // Allow user to override enabled/label/meta of defaults
          map[item.id] = { ...map[item.id], ...item, isDefault: true }
        } else {
          // Custom user-added item
          map[item.id] = { ...item, isDefault: false }
        }
      }
      merged[category] = Object.values(map)
    }
    return merged
  } catch (err) {
    console.error('Failed to read master config', err)
    return DEFAULT_CONFIG
  }
}

export function saveMasterConfig(config) {
  if (!isBrowser()) return false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    return true
  } catch (err) {
    console.error('Failed to save master config', err)
    return false
  }
}

export function resetToDefaults() {
  if (!isBrowser()) return false
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

// ── Convenience helpers ────────────────────────────────────

// Returns only enabled items for a given category — what the UI dropdowns should show
export function getEnabledItems(category) {
  const config = getMasterConfig()
  return (config[category] || []).filter(item => item.enabled)
}

// Returns an item by id (regardless of enabled status) — needed when displaying old data
export function getItemById(category, id) {
  const config = getMasterConfig()
  return (config[category] || []).find(item => item.id === id) || null
}

// Add a new custom item to a category
export function addCustomItem(category, label, meta = {}) {
  if (!label || !label.trim()) return null
  const config = getMasterConfig()
  if (!config[category]) return null
  const id = makeId(label) + '-' + Math.random().toString(36).slice(2, 7)
  const newItem = { id, label: label.trim(), enabled: true, isDefault: false, meta }
  config[category] = [...config[category], newItem]
  saveMasterConfig(config)
  return newItem
}

// Edit an item's label (defaults are editable; ids stay stable)
export function updateItemLabel(category, id, newLabel) {
  const config = getMasterConfig()
  const item = (config[category] || []).find(i => i.id === id)
  if (!item) return false
  item.label = String(newLabel).trim()
  saveMasterConfig(config)
  return true
}

// Toggle an item's enabled state
export function toggleItemEnabled(category, id) {
  const config = getMasterConfig()
  const item = (config[category] || []).find(i => i.id === id)
  if (!item) return false
  item.enabled = !item.enabled
  saveMasterConfig(config)
  return true
}

// Remove a custom item (default items cannot be deleted, only disabled)
export function deleteCustomItem(category, id) {
  const config = getMasterConfig()
  const item = (config[category] || []).find(i => i.id === id)
  if (!item || item.isDefault) return false
  config[category] = config[category].filter(i => i.id !== id)
  saveMasterConfig(config)
  return true
}

// Update an item's meta (e.g., changing color, icon, description)
export function updateItemMeta(category, id, newMeta) {
  const config = getMasterConfig()
  const item = (config[category] || []).find(i => i.id === id)
  if (!item) return false
  item.meta = { ...(item.meta || {}), ...newMeta }
  saveMasterConfig(config)
  return true
}

// Categories exposed for UI to iterate
export const CONFIG_CATEGORIES = [
  { key: 'paymentMethods', label: 'Payment Methods', description: 'How vendors are paid' },
  { key: 'criticalityLevels', label: 'Criticality Levels', description: 'How urgent each vendor is' },
  { key: 'vendorNatures', label: 'Vendor Nature', description: 'What the vendor provides (rent, utilities, inventory, etc.)' },
  { key: 'paymentTerms', label: 'Payment Terms', description: 'Net days for invoice due dates' },
  { key: 'actionFlags', label: 'Vendor Action Flags', description: 'Active state of a vendor' },
  { key: 'statuses', label: 'Vendor Statuses', description: 'Workflow status of a vendor' },
  { key: 'invoiceFlags', label: 'Invoice Action Flags', description: 'State of individual invoices' },
  { key: 'invoiceStatuses', label: 'Invoice Statuses', description: 'Workflow status of individual invoices' },
  { key: 'actionItemSettings', label: 'Action Items Settings', description: 'Defaults for reminders, dispute follow-ups, and hold expiry' },
]