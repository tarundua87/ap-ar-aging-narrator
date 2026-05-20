import { profileIsConfigured } from '../lib/vendorProfiles'
import { getItemById } from '../lib/masterConfig'

// Render one labeled chip. Optional icon shown first.
function Chip({ icon, label, value, valueColor, bg, border }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded"
      style={{
        background: bg || '#faf9f7',
        border: '1px solid ' + (border || 'var(--border)'),
        fontSize: '0.75rem',
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <span style={{ fontSize: '0.85rem' }}>{icon}</span>}
      <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{label}:</span>
      <span style={{ color: valueColor || 'var(--ink)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

export default function VendorProfileStrip({ vendorName, profile, onEdit }) {
  // If no profile or it's all defaults, show a minimal "Not configured" state with edit link
  if (!profile || !profileIsConfigured(profile)) {
    return (
      <div
        className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: '#faf9f7', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: 'var(--muted)' }}>Vendor Profile</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No profile configured for this vendor — narratives use defaults.
          </p>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs px-3 py-1.5 rounded transition-all hover:opacity-90 shrink-0"
            style={{ background: 'var(--accent)', color: 'white', fontWeight: 500 }}
          >
            ⚙ Set Up Profile
          </button>
        )}
      </div>
    )
  }

  // Resolve each field
  const paymentMethod = getItemById('paymentMethods', profile.paymentMethodId)
  const criticality = getItemById('criticalityLevels', profile.criticalityId)
  const nature = getItemById('vendorNatures', profile.natureId)
  const paymentTerms = getItemById('paymentTerms', profile.paymentTermsId)
  const actionFlag = getItemById('actionFlags', profile.actionFlagId)
  const status = getItemById('statuses', profile.statusId)

  // Decide which chips to show — only show non-default values
  const chips = []

  if (nature && profile.natureId !== 'other') {
    chips.push({ key: 'nature', icon: nature.meta?.icon, label: 'Nature', value: nature.label })
  }

  if (profile.is1099Eligible) {
    chips.push({
      key: '1099', icon: '🇺🇸', label: '1099', value: 'Eligible',
      bg: '#dbeafe', border: '#bfdbfe', valueColor: '#1e3a8a',
    })
  }

  if (criticality && profile.criticalityId !== 'standard') {
    const isCritical = profile.criticalityId === 'critical'
    chips.push({
      key: 'criticality', icon: isCritical ? '🔴' : '🟢', label: 'Criticality', value: criticality.label,
      bg: isCritical ? '#fef2f2' : '#f0fdf4',
      border: isCritical ? '#fecaca' : '#bbf7d0',
      valueColor: isCritical ? '#991b1b' : '#15803d',
    })
  }

  if (paymentMethod && profile.paymentMethodId !== 'manual') {
    chips.push({ key: 'payment', icon: '💳', label: 'Payment', value: paymentMethod.label })
  }

  if (paymentTerms && profile.paymentTermsId !== 'default') {
    const termsValue = profile.paymentTermsId === 'custom' && profile.customTermsDays
      ? `Custom (${profile.customTermsDays} days)`
      : paymentTerms.label
    chips.push({ key: 'terms', icon: '📅', label: 'Terms', value: termsValue })
  }

  if (actionFlag && profile.actionFlagId !== 'none') {
    chips.push({
      key: 'flag', icon: actionFlag.meta?.icon || '🏷', label: 'Flag', value: actionFlag.label,
      bg: '#fffbeb', border: '#fcd34d', valueColor: '#78350f',
    })
  }

  if (status && profile.statusId !== 'pending') {
    chips.push({
      key: 'status', icon: '📍', label: 'Status', value: status.label,
      valueColor: status.meta?.color,
    })
  }

  if (profile.reminderDate) {
    chips.push({
      key: 'reminder', icon: '⏰', label: 'Reminder', value: profile.reminderDate,
      bg: '#fef3c7', border: '#fcd34d', valueColor: '#78350f',
    })
  }

  return (
    <div
      className="px-5 py-3"
      style={{ background: '#faf9f7', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Vendor Profile</p>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs px-2.5 py-1 rounded transition-all hover:opacity-90 shrink-0"
            style={{ color: 'var(--accent)', border: '1px solid var(--border)', background: 'white', fontWeight: 500 }}
          >
            ⚙ Edit
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map(c => (
            <Chip
              key={c.key}
              icon={c.icon}
              label={c.label}
              value={c.value}
              valueColor={c.valueColor}
              bg={c.bg}
              border={c.border}
            />
          ))}
        </div>
      )}

      {profile.notes && profile.notes.trim() && (
        <div className="mt-2 px-2.5 py-1.5 rounded" style={{ background: 'white', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)', fontWeight: 500 }}>📝 Notes</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{profile.notes.trim()}</p>
        </div>
      )}
    </div>
  )
}