import { useState } from 'react'
import {
  getClientProfiles, saveVendorProfile, emptyProfile,
  describeProfile, profileIsConfigured,
  getInvoiceOverrides, saveInvoiceOverride, emptyInvoiceOverride, invoiceOverrideIsConfigured,
  autoSuggestProfile,
} from '../lib/vendorProfiles'
import { getEnabledItems, getItemById } from '../lib/masterConfig'
import VendorProfileForm from './VendorProfileForm'

function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Take Actions that REQUIRE a reminder date to be set.
// Saving them with a blank reminderDate is allowed (per B-warn decision),
// but the row shows a warning and no action item is triggered until both
// fields are populated.
const TAKE_ACTIONS_REQUIRING_REMINDER = ['hold', 'disputed', 'pending-recon']

// Returns YYYY-MM-DD for today, used to set the min on the date input
function todayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// Validate reminderDate is today or future (defensive — in case a past
// date sneaks through despite the min attribute on the input)
function isValidReminderDate(dateStr) {
  if (!dateStr) return false
  const today = todayIso()
  return dateStr >= today
}

function InlineSelect({ value, onChange, options, withIcons = false }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs px-2 py-1 rounded outline-none w-full"
      style={{ border: '1px solid var(--border)', background: 'white' }}
    >
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>
          {withIcons && opt.meta?.icon ? opt.meta.icon + ' ' : ''}{opt.label}
        </option>
      ))}
    </select>
  )
}

// ── Invoice overrides editor for a single vendor ──────────
function InvoiceOverridesTable({ clientSlug, reportId, vendor, overrides, onChange }) {
  const invoiceStatuses = getEnabledItems('invoiceStatuses')
  const takeActions = getEnabledItems('invoiceTakeActions')
  const minDate = todayIso()

  const updateOverride = (invoiceNumber, key, value) => {
    const current = overrides[vendor.name + '||' + invoiceNumber] || emptyInvoiceOverride()
    const next = { ...current, [key]: value }
    // If user switches away from Part Pay, clear the part-payment amount
    if (key === 'takeActionId' && value !== 'part-pay') {
      next.partPaymentAmount = null
    }
    // Defensive: if user somehow set a past reminderDate, refuse to save it
    if (key === 'reminderDate' && value && !isValidReminderDate(value)) {
      return
    }
    saveInvoiceOverride(clientSlug, reportId, vendor.name, invoiceNumber, next)
    onChange()
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="w-full text-xs" style={{ minWidth: '1200px' }}>
          <thead style={{ background: '#faf9f7' }}>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Invoice #</th>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Days Past Due</th>
              <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Open Balance</th>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)', minWidth: '200px' }}>Take Action</th>
              <th className="text-center px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Flagged</th>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Status</th>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Reminder Date</th>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {vendor.invoices.map((inv, idx) => {
              const override = overrides[vendor.name + '||' + inv.invoiceNumber] || emptyInvoiceOverride()
              const isPartPay = override.takeActionId === 'part-pay'
              const reminderRequired = TAKE_ACTIONS_REQUIRING_REMINDER.includes(override.takeActionId)
              const reminderMissing = reminderRequired && !override.reminderDate
              return (
                <tr key={idx} style={{ borderBottom: idx < vendor.invoices.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-3 py-2 font-medium align-top">{inv.invoiceNumber}</td>
                  <td className="px-3 py-2 align-top" style={{ color: inv.daysPastDue > 90 ? '#c8401a' : inv.daysPastDue > 60 ? '#ea580c' : inv.daysPastDue > 0 ? '#b87d00' : 'var(--muted)' }}>
                    {inv.daysPastDue > 0 ? `${inv.daysPastDue}d` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold align-top" style={{ color: inv.openBalance < 0 ? '#15803d' : 'var(--ink)' }}>
                    {fmt(inv.openBalance)}
                  </td>
                  <td className="px-3 py-2 align-top" style={{ minWidth: '200px' }}>
                    <InlineSelect
                      value={override.takeActionId || 'none'}
                      onChange={(v) => updateOverride(inv.invoiceNumber, 'takeActionId', v)}
                      options={takeActions}
                      withIcons
                    />
                    {isPartPay && (
                      <div className="mt-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={override.partPaymentAmount ?? ''}
                          onChange={(e) => updateOverride(
                            inv.invoiceNumber,
                            'partPaymentAmount',
                            e.target.value === '' ? null : parseFloat(e.target.value)
                          )}
                          placeholder={`Amount to pay (max ${fmt(inv.openBalance)})`}
                          className="text-xs px-2 py-1 rounded outline-none w-full"
                          style={{ border: '1px solid var(--border)', background: 'white' }}
                        />
                        {override.partPaymentAmount > inv.openBalance && (
                          <p className="text-xs mt-1" style={{ color: '#c8401a' }}>
                            ⚠ Exceeds open balance
                          </p>
                        )}
                      </div>
                    )}
                    {reminderRequired && (
                      <p className="text-xs mt-1" style={{ color: reminderMissing ? '#c8401a' : '#15803d', fontWeight: 500 }}>
                        {reminderMissing ? '⚠ Reminder date required →' : '✓ Reminder date set'}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center align-top" style={{ minWidth: '70px' }}>
                    <input
                      type="checkbox"
                      checked={!!override.isFlagged}
                      onChange={(e) => updateOverride(inv.invoiceNumber, 'isFlagged', e.target.checked)}
                      title="Mark for attention — explain in Notes"
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </td>
                  <td className="px-3 py-2 align-top" style={{ minWidth: '140px' }}>
                    <InlineSelect
                      value={override.statusId}
                      onChange={(v) => updateOverride(inv.invoiceNumber, 'statusId', v)}
                      options={invoiceStatuses}
                    />
                  </td>
                  <td className="px-3 py-2 align-top" style={{ minWidth: '160px' }}>
                    <input
                      type="date"
                      min={minDate}
                      value={override.reminderDate || ''}
                      onChange={(e) => updateOverride(inv.invoiceNumber, 'reminderDate', e.target.value)}
                      className="text-xs px-2 py-1 rounded outline-none w-full"
                      style={{
                        border: '1px solid ' + (reminderMissing ? '#c8401a' : 'var(--border)'),
                        background: reminderMissing ? '#fef2f2' : 'white',
                      }}
                    />
                    {reminderMissing && (
                      <p className="text-xs mt-1" style={{ color: '#c8401a' }}>
                        Pick today or a future date
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top" style={{ minWidth: '160px' }}>
                    <input
                      type="text"
                      value={override.notes || ''}
                      onChange={(e) => updateOverride(inv.invoiceNumber, 'notes', e.target.value)}
                      className="text-xs px-2 py-1 rounded outline-none w-full"
                      style={{ border: '1px solid var(--border)', background: 'white' }}
                      placeholder="Optional note…"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Deep-edit panel for a single vendor ───────────────────
function VendorDeepEdit({ clientSlug, reportId, vendor, profile, suggestion, overrides, onSaveProfile, onOverridesChange, onBack }) {
  const [tab, setTab] = useState('profile') // 'profile' | 'invoices'

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="text-xs px-3 py-1.5 rounded transition-all"
          style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          ← All Vendors
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Editing</p>
          <h3 className="text-base font-bold truncate" style={{ fontFamily: 'Playfair Display, serif' }}>{vendor.name}</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setTab('profile')}
          className="text-sm px-4 py-2 transition-all"
          style={{
            color: tab === 'profile' ? 'var(--ink)' : 'var(--muted)',
            borderBottom: tab === 'profile' ? '2px solid var(--accent)' : '2px solid transparent',
            fontWeight: tab === 'profile' ? 600 : 400,
          }}
        >
          Vendor Profile
        </button>
        <button
          onClick={() => setTab('invoices')}
          className="text-sm px-4 py-2 transition-all"
          style={{
            color: tab === 'invoices' ? 'var(--ink)' : 'var(--muted)',
            borderBottom: tab === 'invoices' ? '2px solid var(--accent)' : '2px solid transparent',
            fontWeight: tab === 'invoices' ? 600 : 400,
          }}
        >
          Invoice Actions ({vendor.invoices.length})
        </button>
      </div>

      {tab === 'profile' && (
        <VendorProfileForm
          vendorName={vendor.name}
          initialProfile={profile}
          suggestion={suggestion}
          onSave={(p) => { onSaveProfile(p); onBack() }}
          onCancel={onBack}
          compact
        />
      )}

      {tab === 'invoices' && (
        <InvoiceOverridesTable
          clientSlug={clientSlug}
          reportId={reportId}
          vendor={vendor}
          overrides={overrides}
          onChange={onOverridesChange}
        />
      )}
    </div>
  )
}

// ── Main bulk edit table ──────────────────────────────────
function BulkTable({ vendors, profiles, overridesByVendor, clientSlug, onUpdate, onDeepEdit }) {
  const paymentMethods = getEnabledItems('paymentMethods')
  const criticalityLevels = getEnabledItems('criticalityLevels')
  const vendorNatures = getEnabledItems('vendorNatures')
  const takeActions = getEnabledItems('invoiceTakeActions')

  const updateField = (vendorName, key, value) => {
    const current = profiles[vendorName] || emptyProfile()
    const next = { ...current, [key]: value }
    saveVendorProfile(clientSlug, vendorName, next)
    onUpdate()
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="w-full text-xs" style={{ minWidth: '1180px' }}>
          <thead style={{ background: 'var(--ink)' }}>
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Vendor</th>
              <th className="text-right px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Total A/P</th>
              <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Payment</th>
              <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Default Take Action</th>
              <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Criticality</th>
              <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Nature</th>
              <th className="text-center px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>1099</th>
              <th className="text-center px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Flagged</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor, idx) => {
              const profile = profiles[vendor.name] || emptyProfile()
              const overrides = overridesByVendor[vendor.name] || {}
              const overrideCount = Object.values(overrides).filter(o => invoiceOverrideIsConfigured(o)).length
              const isConfigured = profileIsConfigured(profile)

              return (
                <tr key={vendor.name} style={{ borderBottom: idx < vendors.length - 1 ? '1px solid var(--border)' : 'none', background: idx % 2 === 1 ? '#faf9f7' : 'white' }}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onDeepEdit(vendor.name)}
                        className="text-xs font-medium text-left transition-all hover:underline"
                        style={{ color: 'var(--ink)' }}
                      >
                        {vendor.name}
                      </button>
                      {profile.isFlagged && (
                        <span title="Flagged for attention" style={{ color: '#c8401a' }}>🚩</span>
                      )}
                      {isConfigured && (
                        <span title="Profile configured" style={{ color: '#15803d' }}>●</span>
                      )}
                      {overrideCount > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#78350f' }} title={`${overrideCount} invoice override${overrideCount !== 1 ? 's' : ''}`}>
                          {overrideCount} inv
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {vendor.invoiceCount} invoice{vendor.invoiceCount !== 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(vendor.aging.totalAP)}</td>
                  <td className="px-3 py-2" style={{ minWidth: '160px' }}>
                    <InlineSelect
                      value={profile.paymentMethodId}
                      onChange={(v) => updateField(vendor.name, 'paymentMethodId', v)}
                      options={paymentMethods}
                    />
                  </td>
                  <td className="px-3 py-2" style={{ minWidth: '170px' }}>
                    <InlineSelect
                      value={profile.defaultTakeActionId || 'none'}
                      onChange={(v) => updateField(vendor.name, 'defaultTakeActionId', v)}
                      options={takeActions}
                      withIcons
                    />
                  </td>
                  <td className="px-3 py-2" style={{ minWidth: '140px' }}>
                    <InlineSelect
                      value={profile.criticalityId}
                      onChange={(v) => updateField(vendor.name, 'criticalityId', v)}
                      options={criticalityLevels}
                    />
                  </td>
                  <td className="px-3 py-2" style={{ minWidth: '160px' }}>
                    <InlineSelect
                      value={profile.natureId || 'other'}
                      onChange={(v) => updateField(vendor.name, 'natureId', v)}
                      options={vendorNatures}
                      withIcons
                    />
                  </td>
                  <td className="px-3 py-2 text-center" style={{ minWidth: '60px' }}>
                    <input
                      type="checkbox"
                      checked={!!profile.is1099Eligible}
                      onChange={(e) => updateField(vendor.name, 'is1099Eligible', e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </td>
                  <td className="px-3 py-2 text-center" style={{ minWidth: '70px' }}>
                    <input
                      type="checkbox"
                      checked={!!profile.isFlagged}
                      onChange={(e) => updateField(vendor.name, 'isFlagged', e.target.checked)}
                      title="Mark for attention — explain in Notes"
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onDeepEdit(vendor.name)}
                      className="text-xs px-2 py-1 rounded transition-all"
                      style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
                    >
                      Edit full
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Top-level component ───────────────────────────────────
export default function VendorSettingsPanel({ clientSlug, clientName, reportId, vendors, onClose, getSourceClientName }) {
  const [, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)

  const [deepEditVendor, setDeepEditVendor] = useState(null) // vendor name string

  const profiles = getClientProfiles(clientSlug)
  const overridesFlat = getInvoiceOverrides(clientSlug, reportId)

  // Group overrides by vendor name for easy lookup
  const overridesByVendor = {}
  for (const [key, override] of Object.entries(overridesFlat)) {
    const [vendorName] = key.split('||')
    if (!overridesByVendor[vendorName]) overridesByVendor[vendorName] = {}
    overridesByVendor[vendorName][key] = override
  }

  const handleSaveProfile = (vendorName, profile) => {
    saveVendorProfile(clientSlug, vendorName, profile)
    refresh()
  }

  const deepEditVendorObj = vendors.find(v => v.name === deepEditVendor)
  const deepEditProfile = deepEditVendor ? (profiles[deepEditVendor] || emptyProfile()) : null
  const deepEditSuggestion = deepEditVendor && !profileIsConfigured(deepEditProfile)
    ? (() => {
        const s = autoSuggestProfile(deepEditVendor, clientSlug)
        if (!s) return null
        return {
          profile: s.profile,
          sourceClientSlug: s.sourceClientSlug,
          sourceClientName: getSourceClientName ? getSourceClientName(s.sourceClientSlug) : s.sourceClientSlug,
        }
      })()
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(15,17,23,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl my-8 mx-4 w-full"
        style={{ maxWidth: '1100px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between rounded-t-xl" style={{ background: 'var(--ink)' }}>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Configure Vendors</p>
            <h2 className="text-xl font-bold truncate" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
              {clientName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded transition-all shrink-0 ml-3"
            style={{ color: 'var(--paper)', background: '#374151' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5" style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
          {deepEditVendor && deepEditVendorObj ? (
            <VendorDeepEdit
              clientSlug={clientSlug}
              reportId={reportId}
              vendor={deepEditVendorObj}
              profile={deepEditProfile}
              suggestion={deepEditSuggestion}
              overrides={overridesByVendor[deepEditVendor] || {}}
              onSaveProfile={(p) => handleSaveProfile(deepEditVendor, p)}
              onOverridesChange={refresh}
              onBack={() => setDeepEditVendor(null)}
            />
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Edit payment method, default take action, criticality, and flagged status for each vendor. Click a vendor name to access invoice-level take actions and overrides.
                  Changes save automatically.
                </p>
              </div>
              <BulkTable
                vendors={vendors}
                profiles={profiles}
                overridesByVendor={overridesByVendor}
                clientSlug={clientSlug}
                onUpdate={refresh}
                onDeepEdit={setDeepEditVendor}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}