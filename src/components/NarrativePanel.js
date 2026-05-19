import { useState } from 'react'

const BUCKET_COLORS = {
  current:    '#1a7a4a',
  days1_30:   '#b87d00',
  days31_60:  '#d97706',
  days61_90:  '#ea580c',
  over90:     '#c8401a',
}

function formatMoney(n) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function VendorAgingBar({ aging }) {
  const total = Math.abs(aging.totalAP) || 1
  const segments = [
    { key: 'current',   label: 'Current',  value: aging.current },
    { key: 'days1_30',  label: '1–30',     value: aging.days1_30 },
    { key: 'days31_60', label: '31–60',    value: aging.days31_60 },
    { key: 'days61_90', label: '61–90',    value: aging.days61_90 },
    { key: 'over90',    label: 'Over 90',  value: aging.over90 },
  ]
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-3 mb-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {segments.map(s => {
          const pct = (Math.abs(s.value) / total) * 100
          return pct > 0 ? (
            <div key={s.key} style={{ width: `${pct}%`, background: BUCKET_COLORS[s.key] }} title={`${s.label}: ${formatMoney(s.value)}`} />
          ) : null
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map(s => Math.abs(s.value) > 0.01 && (
          <div key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: BUCKET_COLORS[s.key] }} />
            <span style={{ color: '#9ca3af' }}>{s.label}:</span>
            <span className="font-medium" style={{ color: 'var(--paper)' }}>{formatMoney(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NarrativeText({ text }) {
  const sections = ['ASSESSMENT', 'KEY CONCERNS', 'CASH FLOW PRIORITIES', 'RECOMMENDED ACTIONS', 'DRAFT MEMO', 'DRAFT FOLLOW-UP EMAIL']
  let remaining = text || ''
  const parts = []

  sections.forEach((section) => {
    const idx = remaining.toUpperCase().indexOf(section)
    if (idx === -1) return
    if (idx > 0) parts.push({ type: 'text', content: remaining.slice(0, idx) })
    const nextIdx = sections.map(s => {
      const i = remaining.toUpperCase().indexOf(s, idx + section.length)
      return i === -1 ? Infinity : i
    }).filter(i => i > idx).reduce((a, b) => Math.min(a, b), Infinity)
    parts.push({
      type: 'section',
      label: section,
      content: remaining.slice(idx + section.length, nextIdx === Infinity ? undefined : nextIdx).replace(/^[:\s]+/, ''),
    })
    remaining = nextIdx === Infinity ? '' : remaining.slice(nextIdx)
  })
  if (remaining.trim()) parts.push({ type: 'text', content: remaining })

  if (parts.length === 0) return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>

  return (
    <div className="space-y-5">
      {parts.map((part, i) => part.type === 'section' ? (
        <div key={i}>
          <h4 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>{part.label}</h4>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>{part.content.trim()}</p>
        </div>
      ) : (
        <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">{part.content.trim()}</p>
      ))}
    </div>
  )
}

function InvoiceTable({ invoices }) {
  if (!invoices || invoices.length === 0) return null
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <table className="w-full text-xs">
        <thead style={{ background: '#faf9f7' }}>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Invoice #</th>
            <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Date</th>
            <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Due Date</th>
            <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Days Past Due</th>
            <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Open Balance</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv, idx) => {
            const isCredit = inv.openBalance < 0
            const isOverdue = inv.daysPastDue > 0
            return (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-3 py-2 font-medium">{inv.invoiceNumber}</td>
                <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{inv.date}</td>
                <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{inv.dueDate || '—'}</td>
                <td className="px-3 py-2 text-right font-medium" style={{ color: inv.daysPastDue > 90 ? '#c8401a' : inv.daysPastDue > 60 ? '#ea580c' : inv.daysPastDue > 30 ? '#d97706' : isOverdue ? '#b87d00' : 'var(--muted)' }}>
                  {inv.daysPastDue > 0 ? `${inv.daysPastDue}d` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-semibold" style={{ color: isCredit ? '#1a7a4a' : 'var(--ink)' }}>
                  {formatMoney(inv.openBalance)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TopOldestInvoices({ invoices }) {
  if (!invoices || invoices.length === 0) return null
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>Top 10 Oldest Open Invoices</h4>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-xs">
          <thead style={{ background: '#faf9f7' }}>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Vendor</th>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Invoice #</th>
              <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Days Past Due</th>
              <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--muted)' }}>Open Balance</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-3 py-2 font-medium" style={{ maxWidth: '200px' }}>
                  <div className="truncate" title={inv.vendor}>{inv.vendor}</div>
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{inv.invoiceNumber}</td>
                <td className="px-3 py-2 text-right font-medium" style={{ color: inv.daysPastDue > 90 ? '#c8401a' : '#ea580c' }}>
                  {inv.daysPastDue}d
                </td>
                <td className="px-3 py-2 text-right font-semibold">{formatMoney(inv.openBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ActionButton({ onClick, label, variant = 'default', disabled = false }) {
  const styles = {
    default: { background: '#374151', color: 'white' },
    primary: { background: 'var(--accent)', color: 'white' },
    success: { background: '#1a7a4a', color: 'white' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-3 py-1.5 rounded-lg transition-all shrink-0"
      style={{ ...styles[variant], opacity: disabled ? 0.5 : 1 }}
    >
      {label}
    </button>
  )
}

export default function NarrativePanel({
  clientName,
  asOfDate,
  vendor,
  aggregate,
  narrative,
  loading,
  onRefresh,
  onExportPDF,
  onExportWord,
  exportPreparing,
  exportProgress,
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(narrative || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isVendorView = !!vendor

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'white' }}>
      {/* Export preparation banner — sticky at top, always visible */}
      {exportPreparing && (
        <div
          className="px-6 py-3 flex items-center gap-4"
          style={{
            background: 'linear-gradient(90deg, #c8401a, #ea580c)',
            color: 'white',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div className="w-5 h-5 rounded-full border-2 animate-spin shrink-0" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Preparing export — please don't navigate away</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Generating vendor narratives ({exportProgress?.done || 0} of {exportProgress?.total || 0})
            </p>
          </div>
          <div className="w-32 h-2 rounded-full overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.25)' }}>
            <div
              className="h-full transition-all"
              style={{
                background: 'white',
                width: exportProgress?.total > 0 ? `${(exportProgress.done / exportProgress.total) * 100}%` : '0%',
              }}
            />
          </div>
        </div>
      )}
      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--ink)' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
              {isVendorView ? 'Vendor Detail' : 'Client Narrative'}
            </p>
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
              {isVendorView ? vendor.name : clientName}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              {isVendorView
                ? `${formatMoney(vendor.aging.totalAP)} · ${vendor.invoiceCount} invoices`
                : `${formatMoney(aggregate.totalAP)} total · ${aggregate.vendorCount} vendors`
              }
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {narrative && !loading && (
              <>
                {onRefresh && (
                  <ActionButton onClick={onRefresh} label="↻ Refresh" />
                )}
                <ActionButton onClick={handleCopy} label={copied ? '✓ Copied' : 'Copy'} variant={copied ? 'success' : 'default'} />
                {onExportPDF && (
                  <ActionButton onClick={onExportPDF} label={exportPreparing ? '⏳ Preparing…' : '⬇ PDF'} variant="primary" disabled={exportPreparing} />
                )}
                {onExportWord && (
                  <ActionButton onClick={onExportWord} label={exportPreparing ? '⏳ Preparing…' : '⬇ Word'} variant="primary" disabled={exportPreparing} />
                )}
              </>
            )}
          </div>
        </div>

        {isVendorView && (
          <div className="mt-4">
            <VendorAgingBar aging={vendor.aging} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--muted)' }}>
            <div className="w-8 h-8 rounded-full border-2 animate-spin mb-4" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <p className="text-sm">Generating narrative…</p>
            <p className="text-xs mt-1">
              {isVendorView ? 'Analyzing vendor invoices' : 'Analyzing entire client portfolio'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {narrative ? <NarrativeText text={narrative} /> : (
              <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
                Narrative will appear here once generated.
              </p>
            )}

            {!isVendorView && aggregate?.topOldestInvoices?.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <TopOldestInvoices invoices={aggregate.topOldestInvoices} />
              </div>
            )}

            {isVendorView && vendor.invoices?.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <h4 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>
                  All Invoices ({vendor.invoiceCount})
                </h4>
                <InvoiceTable invoices={vendor.invoices} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}