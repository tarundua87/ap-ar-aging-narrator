import { useState } from 'react'
import {
  getMasterConfig, addCustomItem, updateItemLabel, updateItemMeta,
  toggleItemEnabled, deleteCustomItem, resetToDefaults,
  CONFIG_CATEGORIES,
} from '../lib/masterConfig'

function CategorySection({ category, items, refresh }) {
  const [newLabel, setNewLabel] = useState('')
  const [newDays, setNewDays] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editingMetaId, setEditingMetaId] = useState(null)
  const [editDays, setEditDays] = useState('')

  // Categories that have items with numeric "days" meta — show day editors
  const supportsDays = category.key === 'actionItemSettings' || category.key === 'paymentTerms'

  const handleAdd = () => {
    if (!newLabel.trim()) return
    const meta = {}
    if (supportsDays && newDays.trim() !== '') {
      const n = parseInt(newDays, 10)
      if (!isNaN(n) && n >= 0) meta.days = n
    }
    addCustomItem(category.key, newLabel.trim(), meta)
    setNewLabel('')
    setNewDays('')
    refresh()
  }

  const startLabelEdit = (item) => {
    setEditingId(item.id)
    setEditLabel(item.label)
  }

  const saveLabelEdit = () => {
    if (editLabel.trim() && editingId) {
      updateItemLabel(category.key, editingId, editLabel.trim())
    }
    setEditingId(null)
    setEditLabel('')
    refresh()
  }

  const startDaysEdit = (item) => {
    setEditingMetaId(item.id)
    setEditDays(String(item.meta?.days ?? ''))
  }

  const saveDaysEdit = (item) => {
    const n = parseInt(editDays, 10)
    if (!isNaN(n) && n >= 0) {
      updateItemMeta(category.key, item.id, { ...(item.meta || {}), days: n })
    }
    setEditingMetaId(null)
    setEditDays('')
    refresh()
  }

  return (
    <div className="mb-8">
      <div className="mb-3">
        <h3 className="text-base font-semibold" style={{ fontFamily: 'Playfair Display, serif' }}>{category.label}</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{category.description}</p>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'white' }}>
        {items.map((item, idx) => {
          const isEditingLabel = editingId === item.id
          const isEditingDays = editingMetaId === item.id
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              {/* Enable toggle */}
              <button
                onClick={() => { toggleItemEnabled(category.key, item.id); refresh() }}
                className="text-xs px-2 py-1 rounded transition-all shrink-0"
                style={{
                  background: item.enabled ? '#dcfce7' : '#f3f4f6',
                  color: item.enabled ? '#14532d' : '#6b7280',
                  border: '1px solid ' + (item.enabled ? '#86efac' : '#d1d5db'),
                  fontWeight: 500,
                  minWidth: '72px',
                }}
              >
                {item.enabled ? 'Enabled' : 'Disabled'}
              </button>

              {/* Label / editor */}
              <div className="flex-1 min-w-0">
                {isEditingLabel ? (
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={saveLabelEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveLabelEdit()
                      if (e.key === 'Escape') { setEditingId(null); setEditLabel('') }
                    }}
                    autoFocus
                    className="w-full text-sm px-2 py-1 rounded outline-none"
                    style={{ border: '1px solid var(--accent)', background: 'white' }}
                  />
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.meta?.icon && <span>{item.meta.icon}</span>}
                    <span className="text-sm" style={{ color: item.enabled ? 'var(--ink)' : 'var(--muted)' }}>
                      {item.label}
                    </span>
                    {item.meta?.description && (
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>· {item.meta.description}</span>
                    )}
                    {/* Days display / editor for items that support it */}
                    {item.meta?.days !== undefined && item.meta?.days !== null && !isEditingDays && (
                      <button
                        onClick={() => startDaysEdit(item)}
                        className="text-xs px-1.5 py-0.5 rounded transition-all hover:opacity-90"
                        style={{ background: '#fef3c7', color: '#78350f', fontWeight: 600 }}
                        title="Click to edit"
                      >
                        {item.meta.days}d ✎
                      </button>
                    )}
                    {isEditingDays && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={editDays}
                          onChange={(e) => setEditDays(e.target.value)}
                          onBlur={() => saveDaysEdit(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveDaysEdit(item)
                            if (e.key === 'Escape') { setEditingMetaId(null); setEditDays('') }
                          }}
                          autoFocus
                          className="text-xs px-1.5 py-0.5 rounded outline-none"
                          style={{ border: '1px solid var(--accent)', width: '70px' }}
                        />
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>days</span>
                      </div>
                    )}
                    {!item.isDefault && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#78350f' }}>
                        custom
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {!isEditingLabel && !isEditingDays && (
                  <button
                    onClick={() => startLabelEdit(item)}
                    className="text-xs px-2 py-1 rounded transition-all"
                    style={{ color: 'var(--muted)', background: 'transparent' }}
                  >
                    Edit name
                  </button>
                )}
                {!item.isDefault && !isEditingLabel && !isEditingDays && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${item.label}"? This cannot be undone.`)) {
                        deleteCustomItem(category.key, item.id)
                        refresh()
                      }
                    }}
                    className="text-xs px-2 py-1 rounded transition-all"
                    style={{ color: 'var(--danger)', background: 'transparent' }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Add new */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderTop: '1px solid var(--border)', background: '#faf9f7' }}
        >
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder={`Add new ${category.label.toLowerCase()}…`}
            className="flex-1 text-sm px-3 py-1.5 rounded outline-none"
            style={{ border: '1px solid var(--border)', background: 'white' }}
          />
          {supportsDays && (
            <input
              type="number"
              min="0"
              value={newDays}
              onChange={(e) => setNewDays(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder="days"
              className="text-sm px-2 py-1.5 rounded outline-none"
              style={{ border: '1px solid var(--border)', background: 'white', width: '80px' }}
            />
          )}
          <button
            onClick={handleAdd}
            disabled={!newLabel.trim()}
            className="text-xs px-3 py-1.5 rounded transition-all"
            style={{
              background: newLabel.trim() ? 'var(--accent)' : '#d1d5db',
              color: 'white',
              cursor: newLabel.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MasterConfigPanel({ onClose }) {
  const [, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)

  const config = getMasterConfig()

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? Your custom items will be deleted. This cannot be undone.')) {
      resetToDefaults()
      refresh()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(15,17,23,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl my-8 mx-4 w-full"
        style={{ maxWidth: '900px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between rounded-t-xl" style={{ background: 'var(--ink)' }}>
          <div>
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Settings</p>
            <h2 className="text-xl font-bold" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
              Master Configuration
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="text-xs px-3 py-1.5 rounded transition-all"
              style={{ color: '#fca5a5', border: '1px solid #7f1d1d', background: 'transparent' }}
            >
              Reset to Defaults
            </button>
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded transition-all"
              style={{ color: 'var(--paper)', background: '#374151' }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Intro */}
        <div className="px-6 py-4" style={{ background: '#fffbeb', borderBottom: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: '#78350f' }}>
            <strong>Defaults are pre-loaded.</strong> Disable items you don't need, edit labels and day counts to match your firm's workflow,
            or add new options. Disabling hides items from dropdowns without losing existing data.
            Custom items can be deleted; default items can only be disabled.
          </p>
        </div>

        {/* Categories */}
        <div className="px-6 py-6" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {CONFIG_CATEGORIES.map(cat => (
            <CategorySection
              key={cat.key}
              category={cat}
              items={config[cat.key] || []}
              refresh={refresh}
            />
          ))}
        </div>
      </div>
    </div>
  )
}