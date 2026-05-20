import { getItemById } from '../lib/masterConfig'
import { profileIsConfigured } from '../lib/vendorProfiles'

const STATUS_CONFIG = {
  critical: { label: 'Critical', bg: '#c8401a15', border: '#c8401a40', dot: '#c8401a' },
  warning:  { label: 'Review',   bg: '#b87d0015', border: '#b87d0040', dot: '#b87d00' },
  ok:       { label: 'On Track', bg: '#1a7a4a15', border: '#1a7a4a40', dot: '#1a7a4a' },
}

// Compact icons summarizing the vendor's profile.
// Shows: action-flag icon, criticality dot, payment-method short code, configured tick.
function ProfileIndicators({ profile, isSelected }) {
  if (!profile) return null

  const actionFlag = getItemById('actionFlags', profile.actionFlagId)
  const criticality = getItemById('criticalityLevels', profile.criticalityId)
  const paymentMethod = getItemById('paymentMethods', profile.paymentMethodId)

  const indicators = []

  // Action flag (only if not "none")
  if (actionFlag && actionFlag.id !== 'none' && actionFlag.meta?.icon) {
    indicators.push({
      key: 'flag',
      content: actionFlag.meta.icon,
      title: actionFlag.label,
    })
  }

  // Criticality dot (only if Critical)
  if (criticality && criticality.id === 'critical') {
    indicators.push({
      key: 'crit',
      content: '🔴',
      title: 'Critical: ' + (criticality.meta?.description || 'Cannot be delayed'),
    })
  } else if (criticality && criticality.id === 'flexible') {
    indicators.push({
      key: 'crit',
      content: '🟢',
      title: 'Flexible: ' + (criticality.meta?.description || 'Can be delayed if needed'),
    })
  }

  // Payment method abbreviation (just first letters for compactness)
  if (paymentMethod && paymentMethod.id !== 'manual') {
    const abbr = paymentMethod.label
      .split(/[\s/]+/)
      .map(w => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase()
    indicators.push({
      key: 'pm',
      content: abbr,
      title: paymentMethod.label,
      isText: true,
    })
  }

  if (indicators.length === 0) return null

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {indicators.map(ind => (
        <span
          key={ind.key}
          title={ind.title}
          className="text-xs"
          style={{
            background: ind.isText ? (isSelected ? '#374151' : '#f0ece6') : 'transparent',
            color: ind.isText ? (isSelected ? '#d1d5db' : '#6b7280') : 'inherit',
            padding: ind.isText ? '1px 5px' : '0',
            borderRadius: ind.isText ? '3px' : '0',
            fontWeight: ind.isText ? 600 : 'normal',
            fontSize: ind.isText ? '0.65rem' : '0.75rem',
            letterSpacing: ind.isText ? '0.04em' : 'normal',
          }}
        >
          {ind.content}
        </span>
      ))}
    </div>
  )
}

export default function VendorTriage({
  vendors,
  selectedVendor,
  onSelectVendor,
  onBackToClient,
  onConfigureVendor,    // NEW: opens quick-edit for one vendor (passed from parent)
  vendorProfiles,       // NEW: map { [vendorName]: profile }
}) {
  const critical = vendors.filter(v => v.status === 'critical')
  const warning  = vendors.filter(v => v.status === 'warning')
  const ok       = vendors.filter(v => v.status === 'ok')

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'white' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--ink)' }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
            Vendor Triage
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{vendors.length} vendors · ranked by urgency</p>
        </div>
        {selectedVendor && (
          <button onClick={onBackToClient} className="text-xs px-2 py-1 rounded" style={{ color: '#9ca3af', border: '1px solid #374151' }}>
            ← Client Summary
          </button>
        )}
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-2 p-3" style={{ borderBottom: '1px solid var(--border)', background: '#faf9f7' }}>
        {[
          { label: 'Critical', count: critical.length, color: '#c8401a' },
          { label: 'Review',   count: warning.length,  color: '#b87d00' },
          { label: 'On Track', count: ok.length,        color: '#1a7a4a' },
        ].map(s => (
          <div key={s.label} className="text-center py-2 rounded-lg" style={{ background: `${s.color}15` }}>
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.count}</div>
            <div className="text-xs" style={{ color: s.color }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Vendor list */}
      <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
        {vendors.map((vendor) => {
          const cfg = STATUS_CONFIG[vendor.status]
          const isSelected = selectedVendor?.name === vendor.name
          const profile = vendorProfiles ? vendorProfiles[vendor.name] : null
          const hasProfile = profileIsConfigured(profile)

          return (
            <div
              key={vendor.name}
              className="w-full transition-all"
              style={{
                borderBottom: '1px solid var(--border)',
                background: isSelected ? 'var(--ink)' : 'white',
                color: isSelected ? 'var(--paper)' : 'var(--ink)',
                position: 'relative',
              }}
            >
              {/* Main clickable area selects the vendor */}
              <button
                onClick={() => onSelectVendor(vendor)}
                className="w-full text-left px-4 py-3"
                style={{ color: 'inherit', paddingRight: '40px' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{vendor.name}</p>
                      {profile?.is1099Eligible && (
                        <span
                          title="1099 Eligible"
                          className="text-xs px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: isSelected ? '#1e3a8a' : '#dbeafe',
                            color: isSelected ? '#bfdbfe' : '#1e3a8a',
                            fontWeight: 600,
                            fontSize: '0.65rem',
                            letterSpacing: '0.04em',
                          }}
                        >
                          1099
                        </span>
                      )}
                    </div>
                    {(() => {
                      const natureItem = profile?.natureId ? getItemById('vendorNatures', profile.natureId) : null
                      const showNature = natureItem && profile.natureId !== 'other'
                      return (
                        <p className="text-xs mt-0.5" style={{ color: isSelected ? '#9ca3af' : 'var(--muted)' }}>
                          {showNature && (
                            <>
                              {natureItem.meta?.icon ? natureItem.meta.icon + ' ' : ''}
                              {natureItem.label}
                              {' · '}
                            </>
                          )}
                          ${vendor.aging.totalAP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {vendor.invoiceCount} invoice{vendor.invoiceCount !== 1 ? 's' : ''}
                        </p>
                      )
                    })()}
                    <ProfileIndicators profile={profile} isSelected={isSelected} />
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full shrink-0 mt-0.5" style={{
                    background: isSelected ? `${cfg.dot}30` : cfg.bg,
                    color: cfg.dot,
                    border: `1px solid ${cfg.border}`,
                  }}>
                    {cfg.label}
                  </span>
                </div>
                {vendor.oldestDays > 90 && (
                  <p className="text-xs mt-1" style={{ color: isSelected ? '#fca5a5' : '#c8401a' }}>
                    ⚠ Oldest invoice: {vendor.oldestDays} days past due
                  </p>
                )}
                {vendor.hasCredits && (
                  <p className="text-xs mt-1" style={{ color: isSelected ? '#86efac' : '#1a7a4a' }}>
                    ↩ Has supplier credit(s)
                  </p>
                )}
              </button>

              {/* Quick-edit gear button (separate from main click area) */}
              {onConfigureVendor && (
                <button
                  onClick={(e) => { e.stopPropagation(); onConfigureVendor(vendor.name) }}
                  title={hasProfile ? 'Edit vendor profile' : 'Set up vendor profile'}
                  className="absolute transition-all"
                  style={{
                    top: '10px',
                    right: '8px',
                    fontSize: '0.85rem',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    background: isSelected ? '#374151' : 'transparent',
                    color: isSelected ? '#d1d5db' : (hasProfile ? '#15803d' : '#9ca3af'),
                    border: '1px solid ' + (isSelected ? '#374151' : 'transparent'),
                  }}
                >
                  ⚙
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}