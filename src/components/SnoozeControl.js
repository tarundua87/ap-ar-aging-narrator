import { useState } from 'react'

// Helper: format a date as YYYY-MM-DD
function toIsoDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Helper: add N days from today, return YYYY-MM-DD
function addDaysFromToday(n) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return toIsoDate(d)
}

// Helper: combine date + time strings into ISO timestamp
function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return null
  // Default time to 09:00 if blank
  const t = timeStr || '09:00'
  // Construct a local-timezone date
  const iso = new Date(`${dateStr}T${t}:00`).toISOString()
  return iso
}

const QUICK_OPTIONS = [
  { label: 'Tomorrow',  days: 1 },
  { label: '+3 days',   days: 3 },
  { label: '+1 week',   days: 7 },
  { label: '+2 weeks',  days: 14 },
  { label: '+1 month',  days: 30 },
]

export default function SnoozeControl({ item, onSnooze, onClose }) {
  const todayIso = toIsoDate(new Date())
  const [customDate, setCustomDate] = useState(addDaysFromToday(7))
  const [customTime, setCustomTime] = useState('09:00')
  const [note, setNote] = useState('')

  const handleQuickSnooze = (days) => {
    const date = addDaysFromToday(days)
    const iso = combineDateTime(date, customTime)
    onSnooze({ snoozeUntil: iso, note })
  }

  const handleCustomSnooze = () => {
    if (!customDate) return
    const iso = combineDateTime(customDate, customTime)
    onSnooze({ snoozeUntil: iso, note })
  }

  if (!item) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(15,17,23,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full"
        style={{ maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 rounded-t-xl" style={{ background: 'var(--ink)' }}>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Snooze</p>
          <h2 className="text-base font-bold mt-0.5 truncate" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
            {item.title}
          </h2>
          {item.vendorName && (
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              {item.vendorName}
              {item.invoiceNumber && ` · Invoice ${item.invoiceNumber}`}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {/* Quick options */}
          <div className="mb-5">
            <p className="text-xs uppercase tracking-widest mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
              Quick Snooze
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => handleQuickSnooze(opt.days)}
                  className="text-sm px-3 py-1.5 rounded transition-all hover:opacity-90"
                  style={{ background: '#faf9f7', color: 'var(--ink)', border: '1px solid var(--border)', fontWeight: 500 }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date + time */}
          <div className="mb-5">
            <p className="text-xs uppercase tracking-widest mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
              Or Choose Custom Date & Time
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>Date</label>
                <input
                  type="date"
                  value={customDate}
                  min={todayIso}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded outline-none"
                  style={{ border: '1px solid var(--border)', background: 'white' }}
                />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>Time</label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded outline-none"
                  style={{ border: '1px solid var(--border)', background: 'white' }}
                />
              </div>
            </div>
          </div>

          {/* Optional note */}
          <div className="mb-5">
            <label className="text-xs uppercase tracking-widest block mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why are you snoozing this? (e.g., 'Waiting for vendor reply')"
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ border: '1px solid var(--border)', background: 'white' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between gap-2 rounded-b-xl" style={{ background: '#faf9f7', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded transition-all"
            style={{ color: 'var(--muted)', background: 'transparent' }}
          >
            Cancel
          </button>
          <button
            onClick={handleCustomSnooze}
            disabled={!customDate}
            className="text-sm px-4 py-2 rounded font-medium transition-all"
            style={{
              background: customDate ? 'var(--accent)' : '#d1d5db',
              color: 'white',
              cursor: customDate ? 'pointer' : 'not-allowed',
            }}
          >
            Snooze until {customDate ? new Date(customDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '...'} at {customTime}
          </button>
        </div>
      </div>
    </div>
  )
}