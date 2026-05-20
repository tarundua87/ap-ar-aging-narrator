import { useState } from 'react'
import {
  emptyProfile, saveVendorProfile, autoSuggestProfile,
} from '../lib/vendorProfiles'
import { getEnabledItems } from '../lib/masterConfig'

function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

// Each vendor row in the review table — has its own draft profile state
function VendorReviewRow({ vendor, draft, onChange, suggestion, sourceClientName, onAcceptSuggestion, onDismissSuggestion, suggestionDismissed }) {
  const paymentMethods = getEnabledItems('paymentMethods')
  const criticalityLevels = getEnabledItems('criticalityLevels')
  const vendorNatures = getEnabledItems('vendorNatures')
  const actionFlags = getEnabledItems('actionFlags')

  const update = (key, value) => onChange({ ...draft, [key]: value })

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="px-3 py-3 align-top">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{vendor.name}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {fmt(vendor.aging.totalAP)} · {vendor.invoiceCount} invoice{vendor.invoiceCount !== 1 ? 's' : ''}
          </p>
          {suggestion && !suggestionDismissed && (
            <div className="mt-2 px-2 py-1.5 rounded text-xs" style={{ background: '#eef6ff', border: '1px solid #bfdbfe' }}>
              <p className="font-medium" style={{ color: '#1e40af' }}>💡 Found settings from {sourceClientName}</p>
              <div className="flex gap-1 mt-1">
                <button
                  onClick={onAcceptSuggestion}
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: '#1e40af', color: 'white' }}
                >
                  Use these
                </button>
                <button
                  onClick={onDismissSuggestion}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ color: '#1e40af', background: 'transparent' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-3 align-top" style={{ minWidth: '160px' }}>
        <InlineSelect value={draft.paymentMethodId} onChange={(v) => update('paymentMethodId', v)} options={paymentMethods} />
      </td>
      <td className="px-3 py-3 align-top" style={{ minWidth: '140px' }}>
        <InlineSelect value={draft.criticalityId} onChange={(v) => update('criticalityId', v)} options={criticalityLevels} />
      </td>
      <td className="px-3 py-3 align-top" style={{ minWidth: '160px' }}>
        <InlineSelect value={draft.natureId || 'other'} onChange={(v) => update('natureId', v)} options={vendorNatures} withIcons />
      </td>
      <td className="px-3 py-3 align-top text-center" style={{ minWidth: '60px' }}>
        <input
          type="checkbox"
          checked={!!draft.is1099Eligible}
          onChange={(e) => update('is1099Eligible', e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
      </td>
      <td className="px-3 py-3 align-top" style={{ minWidth: '180px' }}>
        <InlineSelect value={draft.actionFlagId} onChange={(v) => update('actionFlagId', v)} options={actionFlags} withIcons />
      </td>
      <td className="px-3 py-3 align-top" style={{ minWidth: '160px' }}>
        <input
          type="text"
          value={draft.notes || ''}
          onChange={(e) => update('notes', e.target.value)}
          className="text-xs px-2 py-1 rounded outline-none w-full"
          style={{ border: '1px solid var(--border)', background: 'white' }}
          placeholder="Optional note…"
        />
      </td>
    </tr>
  )
}

export default function NewVendorsModal({
  clientSlug,
  clientName,
  newVendors,            // list of vendor objects that need profiling
  onComplete,            // called after the user saves & dismisses
  onSkip,                // called if user clicks "Skip for now" (no profiles saved)
  getSourceClientName,   // (sourceSlug) => human display name
}) {
  // Build initial drafts. If a suggestion exists, prefill with it.
  const initialState = {}
  const suggestionMap = {}
  for (const vendor of newVendors) {
    const suggestion = autoSuggestProfile(vendor.name, clientSlug)
    suggestionMap[vendor.name] = suggestion
    initialState[vendor.name] = {
      draft: suggestion ? { ...suggestion.profile } : emptyProfile(),
      suggestionDismissed: false,
    }
  }

  const [state, setState] = useState(initialState)

  const updateDraft = (vendorName, draft) => {
    setState(s => ({ ...s, [vendorName]: { ...s[vendorName], draft } }))
  }

  const acceptSuggestion = (vendorName) => {
    const suggestion = suggestionMap[vendorName]
    if (!suggestion) return
    setState(s => ({ ...s, [vendorName]: { draft: { ...suggestion.profile }, suggestionDismissed: false } }))
  }

  const dismissSuggestion = (vendorName) => {
    setState(s => ({ ...s, [vendorName]: { ...s[vendorName], suggestionDismissed: true } }))
  }

  const handleSaveAll = () => {
    for (const [vendorName, { draft }] of Object.entries(state)) {
      saveVendorProfile(clientSlug, vendorName, draft)
    }
    onComplete()
  }

  if (!newVendors || newVendors.length === 0) {
    // Nothing to review — close immediately
    onComplete()
    return null
  }

  // How many vendors actually have a suggestion?
  const suggestionCount = Object.values(suggestionMap).filter(s => s).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(15,17,23,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="bg-white rounded-xl my-8 mx-4 w-full"
        style={{ maxWidth: '1100px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 rounded-t-xl" style={{ background: 'var(--ink)' }}>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Review New Vendors</p>
          <h2 className="text-xl font-bold" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
            {newVendors.length} new vendor{newVendors.length !== 1 ? 's' : ''} for {clientName}
          </h2>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            Set quick defaults for each. You can edit details later from Configure Vendors.
            {suggestionCount > 0 && ` · ${suggestionCount} have suggestions from prior clients.`}
          </p>
        </div>

        {/* Intro tip */}
        <div className="px-6 py-3" style={{ background: '#fffbeb', borderBottom: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: '#78350f' }}>
            <strong>Why this matters:</strong> Setting the payment method and criticality lets the AI write practical narratives —
            it won't tell you to "urgently pay" a vendor that's on standing instructions, or de-prioritize rent.
          </p>
        </div>

        {/* Vendor table */}
        <div className="px-6 py-5" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-xs" style={{ minWidth: '1100px' }}>
                <thead style={{ background: 'var(--ink)' }}>
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)', minWidth: '240px' }}>Vendor</th>
                    <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Payment Method</th>
                    <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Criticality</th>
                    <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Nature</th>
                    <th className="text-center px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>1099</th>
                    <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Action Flag</th>
                    <th className="text-left px-3 py-2.5 font-semibold" style={{ color: 'var(--paper)' }}>Quick Note</th>
                  </tr>
                </thead>
                <tbody>
                  {newVendors.map((vendor) => {
                    const suggestion = suggestionMap[vendor.name]
                    return (
                      <VendorReviewRow
                        key={vendor.name}
                        vendor={vendor}
                        draft={state[vendor.name].draft}
                        onChange={(d) => updateDraft(vendor.name, d)}
                        suggestion={suggestion}
                        sourceClientName={suggestion ? (getSourceClientName ? getSourceClientName(suggestion.sourceClientSlug) : suggestion.sourceClientSlug) : null}
                        onAcceptSuggestion={() => acceptSuggestion(vendor.name)}
                        onDismissSuggestion={() => dismissSuggestion(vendor.name)}
                        suggestionDismissed={state[vendor.name].suggestionDismissed}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center justify-between rounded-b-xl" style={{ background: '#faf9f7', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onSkip}
            className="text-xs px-3 py-2 rounded transition-all"
            style={{ color: 'var(--muted)', background: 'transparent' }}
          >
            Skip for now (use defaults)
          </button>
          <button
            onClick={handleSaveAll}
            className="text-sm px-5 py-2 rounded font-medium transition-all"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Save and Continue →
          </button>
        </div>
      </div>
    </div>
  )
}