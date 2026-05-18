const BUCKET_LABELS = [
    { key: 'current',   label: 'Current',      color: '#1a7a4a' },
    { key: 'days1_30',  label: '1–30',         color: '#b87d00' },
    { key: 'days31_60', label: '31–60',        color: '#d97706' },
    { key: 'days61_90', label: '61–90',        color: '#ea580c' },
    { key: 'over90',    label: 'Over 90',      color: '#c8401a' },
  ]
  
  function StatCard({ label, value, sublabel, color = 'var(--ink)' }) {
    return (
      <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-xs uppercase tracking-wider" style={{ color: '#9ca3af' }}>{label}</div>
        <div className="text-xl font-bold mt-1" style={{ color, fontFamily: 'Playfair Display, serif' }}>{value}</div>
        {sublabel && <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{sublabel}</div>}
      </div>
    )
  }
  
  function AgingBar({ aggregate }) {
    const total = Math.abs(aggregate.totalAP) || 1
    return (
      <div>
        <div className="flex rounded-full overflow-hidden h-3 mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {BUCKET_LABELS.map(b => {
            const value = Math.abs(aggregate[b.key])
            const pct = (value / total) * 100
            return pct > 0 ? (
              <div key={b.key} style={{ width: `${pct}%`, background: b.color }} title={`${b.label}: $${value.toLocaleString()}`} />
            ) : null
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {BUCKET_LABELS.map(b => {
            const value = aggregate[b.key]
            if (Math.abs(value) < 0.01) return null
            return (
              <div key={b.key} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: b.color }} />
                <span style={{ color: '#9ca3af' }}>{b.label}:</span>
                <span className="font-medium" style={{ color: 'var(--paper)' }}>${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  
  export default function ClientSummary({ clientName, aggregate, onReset }) {
    const overduePercent = aggregate.totalAP > 0
      ? ((aggregate.overdueTotal / aggregate.totalAP) * 100).toFixed(1)
      : '0.0'
  
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--ink)', border: '1px solid var(--border)' }}>
        {/* Top row: client name + reset */}
        <div className="px-6 py-4 flex items-start justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>A/P Aging Detail · Client</p>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
              {clientName}
            </h1>
          </div>
          <button onClick={onReset} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#9ca3af', border: '1px solid #374151' }}>
            ↑ Upload New CSV
          </button>
        </div>
  
        {/* Stats grid */}
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="Total A/P"
            value={`$${aggregate.totalAP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sublabel={`${aggregate.invoiceCount} invoices`}
            color="var(--paper)"
          />
          <StatCard
            label="Overdue"
            value={`$${aggregate.overdueTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sublabel={`${overduePercent}% of total`}
            color="#fb923c"
          />
          <StatCard
            label="Vendors"
            value={aggregate.vendorCount}
            sublabel={`${aggregate.criticalVendors} critical`}
            color="var(--paper)"
          />
          <StatCard
            label="Oldest Invoice"
            value={`${aggregate.oldestInvoiceDays}d`}
            sublabel="days past due"
            color={aggregate.oldestInvoiceDays > 90 ? '#fb7185' : '#fb923c'}
          />
          <StatCard
            label="Over 90 Days"
            value={`$${aggregate.over90.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sublabel="highest risk"
            color="#fb7185"
          />
        </div>
  
        {/* Aging bar */}
        <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <AgingBar aggregate={aggregate} />
        </div>
      </div>
    )
  }