import { useState } from 'react'

function formatMoney(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateRelative(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ClientCard({ client, onOpen, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const latestReport = [...client.reports].sort((a, b) =>
    new Date(b.uploadedAt) - new Date(a.uploadedAt)
  )[0]

  const aggregate = latestReport?.parsedData?.aggregate
  const overduePercent = aggregate && aggregate.totalAP > 0
    ? ((aggregate.overdueTotal / aggregate.totalAP) * 100).toFixed(1)
    : '0.0'

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    if (confirming) {
      onDelete(client.slug)
    } else {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
    }
  }

  return (
    <button
      onClick={() => onOpen(client.slug)}
      className="text-left rounded-xl overflow-hidden transition-all hover:shadow-lg"
      style={{ border: '1px solid var(--border)', background: 'white' }}
    >
      <div className="px-5 py-4" style={{ background: 'var(--ink)' }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
          A/P Aging
        </p>
        <h3 className="text-lg font-bold leading-tight" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
          {client.displayName}
        </h3>
        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
          As of {latestReport?.asOfDate || 'Unknown'}
        </p>
      </div>

      <div className="px-5 py-4">
        {aggregate && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Total A/P</p>
              <p className="text-sm font-bold mt-0.5">{formatMoney(aggregate.totalAP)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Overdue</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: parseFloat(overduePercent) > 50 ? '#c8401a' : parseFloat(overduePercent) > 20 ? '#b87d00' : '#1a7a4a' }}>
                {overduePercent}%
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <span className="px-2 py-0.5 rounded-full" style={{ background: '#f0ece6' }}>
              {client.reports.length} period{client.reports.length !== 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span>Updated {formatDateRelative(client.lastUpdated)}</span>
          </div>
          <span
            onClick={handleDeleteClick}
            className="text-xs px-2 py-1 rounded transition-all cursor-pointer"
            style={{
              color: confirming ? 'white' : 'var(--muted)',
              background: confirming ? '#c8401a' : 'transparent',
              border: '1px solid ' + (confirming ? '#c8401a' : 'var(--border)'),
            }}
          >
            {confirming ? 'Confirm Delete' : '×'}
          </span>
        </div>
      </div>
    </button>
  )
}

export default function ClientLibrary({ clients, onOpenClient, onNewUpload, onDeleteClient }) {
  if (clients.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center">
        <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
          Welcome to your Aging Narrator
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          No client reports yet. Upload your first QBO A/P Aging Detail CSV to get started.
        </p>
        <button
          onClick={onNewUpload}
          className="px-6 py-3 rounded-lg text-sm font-medium transition-all hover:opacity-90"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          + Upload your first CSV
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
            Client Library
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {clients.length} client{clients.length !== 1 ? 's' : ''} · {clients.reduce((sum, c) => sum + c.reports.length, 0)} period{clients.reduce((sum, c) => sum + c.reports.length, 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onNewUpload}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          + New Upload
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map(client => (
          <ClientCard
            key={client.slug}
            client={client}
            onOpen={onOpenClient}
            onDelete={onDeleteClient}
          />
        ))}
      </div>
    </div>
  )
}