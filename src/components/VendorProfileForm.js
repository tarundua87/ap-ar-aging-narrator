import { useState, useEffect } from 'react'
import { emptyProfile } from '../lib/vendorProfiles'
import { getEnabledItems } from '../lib/masterConfig'

function Field({ label, hint, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </div>
  )
}

function Select({ value, onChange, options, withMeta = false }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm px-3 py-2 rounded outline-none"
      style={{ border: '1px solid var(--border)', background: 'white' }}
    >
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>
          {withMeta && opt.meta?.icon ? opt.meta.icon + ' ' : ''}{opt.label}
        </option>
      ))}
    </select>
  )
}

export default function VendorProfileForm({
  vendorName,
  initialProfile,
  suggestion,                  // optional { profile, sourceClientSlug, sourceClientName }
  onSave,
  onCancel,
  onApplySuggestion,           // optional callback if user accepts suggestion
  compact = false,             // if true, render without the surrounding card
}) {
  const [profile, setProfile] = useState(initialProfile || emptyProfile())
  const [showSuggestion, setShowSuggestion] = useState(!!suggestion)

  useEffect(() => {
    setProfile(initialProfile || emptyProfile())
    setShowSuggestion(!!suggestion)
  }, [vendorName, initialProfile, suggestion])

  const paymentMethods = getEnabledItems('paymentMethods')
  const criticalityLevels = getEnabledItems('criticalityLevels')
  const paymentTerms = getEnabledItems('paymentTerms')
  const actionFlags = getEnabledItems('actionFlags')
  const statuses = getEnabledItems('statuses')

  const update = (key, value) => setProfile(p => ({ ...p, [key]: value }))

  const handleAcceptSuggestion = () => {
    if (suggestion?.profile) {
      setProfile(suggestion.profile)
      setShowSuggestion(false)
      if (onApplySuggestion) onApplySuggestion(suggestion)
    }
  }

  const isCustomTerms = profile.paymentTermsId === 'custom'

  const formBody = (
    <div>
      {/* Suggestion banner */}
      {showSuggestion && suggestion?.profile && (
        <div
          className="mb-4 rounded-lg p-3"
          style={{ background: '#eef6ff', border: '1px solid #bfdbfe' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold mb-1" style={{ color: '#1e40af' }}>
                💡 Prior settings found
              </p>
              <p className="text-xs" style={{ color: '#1e3a8a' }}>
                You set up "<strong>{vendorName}</strong>" earlier for
                <strong> {suggestion.sourceClientName || suggestion.sourceClientSlug}</strong>.
                Use those settings as a starting point?
              </p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={handleAcceptSuggestion}
                className="text-xs px-3 py-1 rounded font-medium transition-all"
                style={{ background: '#1e40af', color: 'white' }}
              >
                Use these
              </button>
              <button
                onClick={() => setShowSuggestion(false)}
                className="text-xs px-3 py-1 rounded transition-all"
                style={{ color: '#1e40af', background: 'transparent' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two-column grid on wider screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
        <Field label="Payment Method" hint="How this vendor is typically paid">
          <Select value={profile.paymentMethodId} onChange={(v) => update('paymentMethodId', v)} options={paymentMethods} />
        </Field>

        <Field label="Criticality" hint="How urgent is this vendor">
          <Select value={profile.criticalityId} onChange={(v) => update('criticalityId', v)} options={criticalityLevels} />
        </Field>

        <Field label="Payment Terms" hint="Override the invoice due date logic">
          <Select value={profile.paymentTermsId} onChange={(v) => update('paymentTermsId', v)} options={paymentTerms} />
        </Field>

        {isCustomTerms && (
          <Field label="Custom Days" hint="e.g., 75 for Net 75">
            <input
              type="number"
              min="0"
              value={profile.customTermsDays || ''}
              onChange={(e) => update('customTermsDays', e.target.value === '' ? null : parseInt(e.target.value, 10))}
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ border: '1px solid var(--border)' }}
              placeholder="Enter days (e.g., 75)"
            />
          </Field>
        )}

        <Field label="Action Flag" hint="Current state of this vendor">
          <Select value={profile.actionFlagId} onChange={(v) => update('actionFlagId', v)} options={actionFlags} withMeta />
        </Field>

        <Field label="Status" hint="Workflow state">
          <Select value={profile.statusId} onChange={(v) => update('statusId', v)} options={statuses} />
        </Field>

        <Field label="Reminder Date" hint="When to follow up next">
          <input
            type="date"
            value={profile.reminderDate || ''}
            onChange={(e) => update('reminderDate', e.target.value)}
            className="w-full text-sm px-3 py-2 rounded outline-none"
            style={{ border: '1px solid var(--border)' }}
          />
        </Field>
      </div>

      <Field label="Notes" hint="Internal context — disputes, history, special instructions">
        <textarea
          value={profile.notes || ''}
          onChange={(e) => update('notes', e.target.value)}
          rows={3}
          className="w-full text-sm px-3 py-2 rounded outline-none resize-none"
          style={{ border: '1px solid var(--border)' }}
          placeholder="e.g., Quarterly auto-debit; ongoing dispute on Inv #1247; family connection..."
        />
      </Field>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-4">
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm px-4 py-2 rounded transition-all"
            style={{ color: 'var(--muted)', background: 'transparent' }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => onSave(profile)}
          className="text-sm px-5 py-2 rounded font-medium transition-all"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          Save Profile
        </button>
      </div>
    </div>
  )

  if (compact) return formBody

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--border)' }}>
      <div className="px-6 py-4" style={{ background: 'var(--ink)' }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
          Vendor Profile
        </p>
        <h3 className="text-lg font-bold mt-0.5" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
          {vendorName}
        </h3>
      </div>
      <div className="px-6 py-5">
        {formBody}
      </div>
    </div>
  )
}