const STATUS_CONFIG = {
    critical: { label: 'Critical', bg: '#c8401a15', border: '#c8401a40', dot: '#c8401a' },
    warning:  { label: 'Review',   bg: '#b87d0015', border: '#b87d0040', dot: '#b87d00' },
    ok:       { label: 'On Track', bg: '#1a7a4a15', border: '#1a7a4a40', dot: '#1a7a4a' },
  }
  
  export default function VendorTriage({ vendors, selectedVendor, onSelectVendor, onBackToClient }) {
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
            return (
              <button
                key={vendor.name}
                onClick={() => onSelectVendor(vendor)}
                className="w-full text-left px-4 py-3 transition-all"
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: isSelected ? 'var(--ink)' : 'white',
                  color: isSelected ? 'var(--paper)' : 'var(--ink)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{vendor.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: isSelected ? '#9ca3af' : 'var(--muted)' }}>
                      ${vendor.aging.totalAP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {vendor.invoiceCount} invoice{vendor.invoiceCount !== 1 ? 's' : ''}
                    </p>
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
            )
          })}
        </div>
      </div>
    )
  }