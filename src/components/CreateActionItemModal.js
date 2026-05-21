import { useState } from 'react'
import { ACTION_TYPES, TYPE_METADATA, createActionItem } from '../lib/actionItems'

// Helper: format a date as YYYY-MM-DD
function toIsoDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addDaysFromToday(n) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return toIsoDate(d)
}

const TYPE_OPTIONS = [
  { value: ACTION_TYPES.MANUAL, ...TYPE_METADATA.manual },
  { value: ACTION_TYPES.REMINDER, ...TYPE_METADATA.reminder },
  { value: ACTION_TYPES.HOLD_EXPIRY, ...TYPE_METADATA['hold-expiry'] },
  { value: ACTION_TYPES.DISPUTE_FOLLOWUP, ...TYPE_METADATA['dispute-followup'] },
]

export default function CreateActionItemModal({
  clientSlug,
  reportId = null,
  vendors = [],          // optional: vendor list to pick from
  prefilledVendorName = null,
  prefilledInvoiceNumber = null,
  onCreated,
  onClose,
}) {
  const [type, setType] = useState(ACTION_TYPES.MANUAL)
  const [title, setTitle] = useState('')
  const [vendorName, setVendorName] = useState(prefilledVendorName || '')
  const [invoiceNumber, setInvoiceNumber] = useState(prefilledInvoiceNumber || '')
  const [dueDate, setDueDate] = useState(addDaysFromToday(7))
  const [dueTime, setDueTime] = useState('09:00')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)

  const todayIso = toIsoDate(new Date())

  // Find invoices for the selected vendor (if vendor list provided)
  const selectedVendor = vendors.find(v => v.name === vendorName)
  const vendorInvoices = selectedVendor?.invoices || []

  const handleCreate = () => {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (!dueDate) {
      setError('Due date is required.')
      return
    }
    const created = createActionItem({
      clientSlug,
      reportId,
      type,
      title: title.trim(),
      vendorName: vendorName || null,
      invoiceNumber: invoiceNumber || null,
      dueDate,
      dueTime,
      notes: notes.trim(),
      createdBy: 'user',
    })
    if (created) {
      if (onCreated) onCreated(created)
      onClose()
    } else {
      setError('Failed to create action item.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(15,17,23,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full"
        style={{ maxWidth: '640px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 rounded-t-xl" style={{ background: 'var(--ink)' }}>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>New Action Item</p>
          <h2 className="text-lg font-bold mt-0.5" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
            Create Action Item
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-5" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

          {/* Type selector */}
          <div className="mb-4">
            <label className="text-xs uppercase tracking-widest block mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className="text-sm px-3 py-2 rounded transition-all text-left"
                  style={{
                    background: type === opt.value ? opt.color + '15' : 'white',
                    border: '1px solid ' + (type === opt.value ? opt.color : 'var(--border)'),
                    color: type === opt.value ? opt.color : 'var(--ink)',
                    fontWeight: type === opt.value ? 600 : 500,
                  }}
                >
                  <span className="mr-1.5">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="text-xs uppercase tracking-widest block mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Call Sinclair Dental about overdue invoices"
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ border: '1px solid var(--border)', background: 'white' }}
              autoFocus
            />
          </div>

          {/* Vendor + Invoice */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs uppercase tracking-widest block mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
                Vendor (optional)
              </label>
              {vendors.length > 0 ? (
                <select
                  value={vendorName}
                  onChange={(e) => { setVendorName(e.target.value); setInvoiceNumber('') }}
                  className="w-full text-sm px-3 py-2 rounded outline-none"
                  style={{ border: '1px solid var(--border)', background: 'white' }}
                >
                  <option value="">— None —</option>
                  {vendors.map(v => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Vendor name"
                  className="w-full text-sm px-3 py-2 rounded outline-none"
                  style={{ border: '1px solid var(--border)', background: 'white' }}
                />
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest block mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
                Invoice # (optional)
              </label>
              {vendorInvoices.length > 0 ? (
                <select
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded outline-none"
                  style={{ border: '1px solid var(--border)', background: 'white' }}
                >
                  <option value="">— None —</option>
                  {vendorInvoices.map(inv => (
                    <option key={inv.invoiceNumber} value={inv.invoiceNumber}>{inv.invoiceNumber}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Invoice number"
                  className="w-full text-sm px-3 py-2 rounded outline-none"
                  style={{ border: '1px solid var(--border)', background: 'white' }}
                  disabled={!vendorName}
                />
              )}
            </div>
          </div>

          {/* Due date + time */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs uppercase tracking-widest block mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
                Due Date *
              </label>
              <input
                type="date"
                value={dueDate}
                min={todayIso}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ border: '1px solid var(--border)', background: 'white' }}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest block mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
                Time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ border: '1px solid var(--border)', background: 'white' }}
              />
            </div>
          </div>

          {/* Quick date shortcuts */}
          <div className="mb-4">
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Quick set:</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Today', days: 0 },
                { label: 'Tomorrow', days: 1 },
                { label: '+3 days', days: 3 },
                { label: '+1 week', days: 7 },
                { label: '+2 weeks', days: 14 },
                { label: '+1 month', days: 30 },
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setDueDate(addDaysFromToday(opt.days))}
                  className="text-xs px-2 py-1 rounded transition-all hover:opacity-90"
                  style={{ background: '#faf9f7', color: 'var(--ink)', border: '1px solid var(--border)' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className="text-xs uppercase tracking-widest block mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any context for this action item…"
              className="w-full text-sm px-3 py-2 rounded outline-none resize-none"
              style={{ border: '1px solid var(--border)', background: 'white' }}
            />
          </div>

          {error && (
            <div className="mt-3 p-2 rounded text-sm" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}
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
            onClick={handleCreate}
            disabled={!title.trim() || !dueDate}
            className="text-sm px-5 py-2 rounded font-medium transition-all"
            style={{
              background: (title.trim() && dueDate) ? 'var(--accent)' : '#d1d5db',
              color: 'white',
              cursor: (title.trim() && dueDate) ? 'pointer' : 'not-allowed',
            }}
          >
            + Create Action Item
          </button>
        </div>
      </div>
    </div>
  )
}