import { useState, useRef, useEffect } from 'react'
import { getGroupForClient } from '../lib/clientGroups'

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

// Convert an as-of date string to a Date for comparison.
// Handles "May 18, 2026", "05/18/2026", "May 18 2026", etc.
function parseAsOfDate(asOfDate) {
  if (!asOfDate) return new Date(0)
  const d = new Date(asOfDate)
  if (!isNaN(d.getTime())) return d
  // Try cleaning common separators
  const cleaned = String(asOfDate).replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim()
  const d2 = new Date(cleaned)
  return isNaN(d2.getTime()) ? new Date(0) : d2
}

// Sort reports — newest as-of date first.
function sortReportsByAsOfDate(reports) {
  return [...reports].sort((a, b) => parseAsOfDate(b.asOfDate) - parseAsOfDate(a.asOfDate))
}

function getHealthTier(overduePercent) {
  if (overduePercent > 50) {
    return {
      tier: 'critical',
      label: 'Critical',
      headerBg: '#991b1b',
      headerAccent: '#fecaca',
      bodyBg: '#fef2f2',
      cardBorder: '#fca5a5',
      overdueColor: '#b91c1c',
      badgeBg: '#fee2e2',
      badgeText: '#7f1d1d',
    }
  }
  if (overduePercent >= 25) {
    return {
      tier: 'warning',
      label: 'Needs Attention',
      headerBg: '#b45309',
      headerAccent: '#fde68a',
      bodyBg: '#fffbeb',
      cardBorder: '#fcd34d',
      overdueColor: '#b45309',
      badgeBg: '#fef3c7',
      badgeText: '#78350f',
    }
  }
  return {
    tier: 'healthy',
    label: 'On Track',
    headerBg: '#15803d',
    headerAccent: '#bbf7d0',
    bodyBg: '#f0fdf4',
    cardBorder: '#86efac',
    overdueColor: '#15803d',
    badgeBg: '#dcfce7',
    badgeText: '#14532d',
  }
}

function PeriodDropdown({ reports, slug, onOpenPeriod, badgeBg, badgeText }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!reports || reports.length === 0) return null

  const sorted = sortReportsByAsOfDate(reports)

  if (sorted.length === 1) {
    return (
      <span className="px-2 py-0.5 rounded-full font-medium text-xs" style={{ background: badgeBg, color: badgeText }}>
        1 period
      </span>
    )
  }

  const handleToggle = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setOpen(!open)
  }

  const handleSelect = (e, reportId) => {
    e.stopPropagation()
    e.preventDefault()
    setOpen(false)
    onOpenPeriod(slug, reportId)
  }

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <span
        onClick={handleToggle}
        className="px-2 py-0.5 rounded-full font-medium text-xs cursor-pointer inline-flex items-center gap-1 transition-all hover:opacity-80"
        style={{ background: badgeBg, color: badgeText }}
      >
        {sorted.length} periods
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: '0.7em' }}>▾</span>
      </span>

      {open && (
        <div
          className="absolute left-0 rounded-lg overflow-hidden"
          style={{
            top: 'calc(100% + 6px)',
            background: 'white',
            border: '1px solid var(--border)',
            minWidth: '240px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            zIndex: 50,
          }}
        >
          <div className="px-3 py-2 text-xs uppercase tracking-widest" style={{ background: '#faf9f7', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
            Open Period
          </div>
          {sorted.map((report, idx) => (
            <div
              key={report.id}
              onClick={(e) => handleSelect(e, report.id)}
              className="px-3 py-2.5 transition-all cursor-pointer hover:bg-gray-50"
              style={{ borderBottom: idx < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{report.asOfDate}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Uploaded {new Date(report.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {idx === 0 && ' · latest'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClientCard({ client, onOpen, onOpenPeriod, onDelete }) {
  const group = getGroupForClient(client.slug)
  const [confirming, setConfirming] = useState(false)

  // Latest report = the one with the newest AS-OF DATE (not upload time)
  const latestReport = sortReportsByAsOfDate(client.reports)[0]

  const aggregate = latestReport?.parsedData?.aggregate
  const overduePercent = aggregate && aggregate.totalAP > 0
    ? (aggregate.overdueTotal / aggregate.totalAP) * 100
    : 0
  const overduePercentStr = overduePercent.toFixed(1)

  const health = getHealthTier(overduePercent)

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (confirming) {
      onDelete(client.slug)
    } else {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
    }
  }

  // Card-level click opens the latest period
  const handleCardClick = () => {
    if (latestReport) onOpenPeriod(client.slug, latestReport.id)
    else onOpen(client.slug)
  }

  return (
    <div
      onClick={handleCardClick}
      className="text-left rounded-xl transition-all hover:shadow-lg cursor-pointer"
      style={{ border: `1px solid ${health.cardBorder}`, background: 'white', position: 'relative' }}
    >
      {/* Card header */}
      <div className="px-5 py-4" style={{ background: health.headerBg, borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: health.headerAccent }}>
              A/P Aging
            </p>
            <h3 className="text-lg font-bold leading-tight truncate" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
              {client.displayName}
            </h3>
            {group && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: health.headerAccent }}>
                <span style={{ opacity: 0.7 }}>👥</span>
                <span className="truncate">{group.name}</span>
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: '#e5e7eb' }}>
              As of {latestReport?.asOfDate || 'Unknown'}
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full shrink-0 font-semibold" style={{
            background: 'rgba(255,255,255,0.18)',
            color: health.headerAccent,
            border: `1px solid ${health.headerAccent}40`,
          }}>
            {health.label}
          </span>
        </div>
      </div>

      {/* Card body — NO overflow-hidden here so dropdown can extend */}
      <div
        className="px-5 py-4"
        style={{
          background: health.bodyBg,
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
        }}
      >
        {aggregate && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Total A/P</p>
              <p className="text-sm font-bold mt-0.5">{formatMoney(aggregate.totalAP)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Overdue</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: health.overdueColor }}>
                {overduePercentStr}%
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 gap-2" style={{ borderTop: `1px solid ${health.cardBorder}` }}>
          <div className="flex items-center gap-2 text-xs min-w-0" style={{ color: 'var(--muted)' }}>
            <PeriodDropdown
              reports={client.reports}
              slug={client.slug}
              onOpenPeriod={onOpenPeriod}
              badgeBg={health.badgeBg}
              badgeText={health.badgeText}
            />
            <span>·</span>
            <span className="truncate">Updated {formatDateRelative(client.lastUpdated)}</span>
          </div>
          <span
            onClick={handleDeleteClick}
            className="text-xs px-2 py-1 rounded transition-all cursor-pointer shrink-0"
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
    </div>
  )
}

export default function ClientLibrary({ clients, onOpenClient, onOpenPeriod, onNewUpload, onDeleteClient, onManageGroups, onOpenAllActionItems }) {
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

  const tierCounts = clients.reduce((acc, c) => {
    const latest = sortReportsByAsOfDate(c.reports)[0]
    const agg = latest?.parsedData?.aggregate
    const pct = agg && agg.totalAP > 0 ? (agg.overdueTotal / agg.totalAP) * 100 : 0
    const tier = pct > 50 ? 'critical' : pct >= 25 ? 'warning' : 'healthy'
    acc[tier] = (acc[tier] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
            Client Library
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {clients.length} client{clients.length !== 1 ? 's' : ''} · {clients.reduce((sum, c) => sum + c.reports.length, 0)} period{clients.reduce((sum, c) => sum + c.reports.length, 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenAllActionItems && (
            <button
              onClick={onOpenAllActionItems}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 flex items-center gap-1.5"
              style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)' }}
            >
              🔔 All Action Items
            </button>
          )}
          {onManageGroups && (
            <button
              onClick={onManageGroups}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 flex items-center gap-1.5"
              style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)' }}
            >
              👥 Manage Groups
            </button>
          )}
          <button
            onClick={onNewUpload}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            + New Upload
          </button>
        </div>
      </div>

      {clients.length > 1 && (
        <div className="flex gap-2 mb-6 text-xs">
          {tierCounts.critical > 0 && (
            <span className="px-3 py-1.5 rounded-full font-medium" style={{ background: '#fee2e2', color: '#991b1b' }}>
              {tierCounts.critical} Critical
            </span>
          )}
          {tierCounts.warning > 0 && (
            <span className="px-3 py-1.5 rounded-full font-medium" style={{ background: '#fef3c7', color: '#78350f' }}>
              {tierCounts.warning} Needs Attention
            </span>
          )}
          {tierCounts.healthy > 0 && (
            <span className="px-3 py-1.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#14532d' }}>
              {tierCounts.healthy} On Track
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ alignItems: 'start' }}>
        {clients.map(client => (
          <ClientCard
            key={client.slug}
            client={client}
            onOpen={onOpenClient}
            onOpenPeriod={onOpenPeriod}
            onDelete={onDeleteClient}
          />
        ))}
      </div>
    </div>
  )
}