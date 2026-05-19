import { useState, useRef, useEffect } from 'react'

export default function PeriodSelector({ reports, activeReportId, onSelectPeriod }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!reports || reports.length <= 1) return null

  // Sort by as-of date (the report period), not upload timestamp
  const parseAsOfDate = (s) => {
    if (!s) return new Date(0)
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d
    const cleaned = String(s).replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim()
    const d2 = new Date(cleaned)
    return isNaN(d2.getTime()) ? new Date(0) : d2
  }
  const sorted = [...reports].sort((a, b) => parseAsOfDate(b.asOfDate) - parseAsOfDate(a.asOfDate))
  const active = sorted.find(r => r.id === activeReportId) || sorted[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all"
        style={{ color: '#9ca3af', border: '1px solid #374151', background: 'rgba(255,255,255,0.04)' }}
      >
        <span>Period History</span>
        <span style={{ color: 'var(--paper)' }}>·</span>
        <span style={{ color: 'var(--paper)' }}>{active.asOfDate}</span>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-lg overflow-hidden z-10"
          style={{
            background: 'white',
            border: '1px solid var(--border)',
            minWidth: '260px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          }}
        >
          <div className="px-3 py-2 text-xs uppercase tracking-widest" style={{ background: '#faf9f7', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
            Select Period
          </div>
          {sorted.map((report) => {
            const isActive = report.id === active.id
            return (
              <button
                key={report.id}
                onClick={() => { onSelectPeriod(report.id); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 transition-all"
                style={{
                  background: isActive ? 'var(--ink)' : 'white',
                  color: isActive ? 'var(--paper)' : 'var(--ink)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div className="text-sm font-medium">{report.asOfDate}</div>
                <div className="text-xs mt-0.5" style={{ color: isActive ? '#9ca3af' : 'var(--muted)' }}>
                  Uploaded {new Date(report.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {sorted[0].id === report.id && ' · latest'}
                  {isActive && sorted[0].id !== report.id && ' · current'}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}