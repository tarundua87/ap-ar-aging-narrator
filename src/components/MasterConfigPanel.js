import { useState } from 'react'
import {
  getMasterConfig, addCustomItem, updateItemLabel,
  toggleItemEnabled, deleteCustomItem, resetToDefaults,
  CONFIG_CATEGORIES,
} from '../lib/masterConfig'

function CategorySection({ category, items, onAdd, onToggle, onRelabel, onDelete }) {
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')

  const handleAdd = () => {
    if (!newLabel.trim()) return
    onAdd(category.key, newLabel)
    setNewLabel('')
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditLabel(item.label)
  }

  const saveEdit = () => {
    if (editLabel.trim() && editingId) {
      onRelabel(category.key, editingId, editLabel.trim())
    }
    setEditingId(null)
    setEditLabel('')
  }

  return (
    <div className="mb-8">
      <div className="mb-3">
        <h3 className="text-base font-semibold" style={{ fontFamily: 'Playfair Display, serif' }}>{category.label}</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{category.description}</p>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'white' }}>
        {items.map((item, idx) => {
          const isEditing = editingId === item.id
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              {/* Enable toggle */}
              <button
                onClick={() => onToggle(category.key, item.id)}
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
                {isEditing ? (
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') { setEditingId(null); setEditLabel('') }
                    }}
                    autoFocus
                    className="w-full text-sm px-2 py-1 rounded outline-none"
                    style={{ border: '1px solid var(--accent)', background: 'white' }}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    {item.meta?.icon && <span>{item.meta.icon}</span>}
                    <span className="text-sm" style={{ color: item.enabled ? 'var(--ink)' : 'var(--muted)' }}>
                      {item.label}
                    </span>
                    {item.meta?.description && (
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>· {item.meta.description}</span>
                    )}
                    {item.meta?.days !== undefined && item.meta?.days !== null && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f0ece6', color: 'var(--muted)' }}>
                        {item.meta.days}d
                      </span>
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
                {!isEditing && (
                  <button
                    onClick={() => startEdit(item)}
                    className="text-xs px-2 py-1 rounded transition-all"
                    style={{ color: 'var(--muted)', background: 'transparent' }}
                  >
                    Edit
                  </button>
                )}
                {!item.isDefault && !isEditing && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${item.label}"? This cannot be undone.`)) {
                        onDelete(category.key, item.id)
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
  // Use a counter trick to force re-renders after each storage change
  const [, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)

  const config = getMasterConfig()

  const handleAdd = (categoryKey, label) => {
    addCustomItem(categoryKey, label)
    refresh()
  }
  const handleToggle = (categoryKey, id) => {
    toggleItemEnabled(categoryKey, id)
    refresh()
  }
  const handleRelabel = (categoryKey, id, label) => {
    updateItemLabel(categoryKey, id, label)
    refresh()
  }
  const handleDelete = (categoryKey, id) => {
    deleteCustomItem(categoryKey, id)
    refresh()
  }
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
            <strong>Defaults are pre-loaded.</strong> Disable items you don't need, edit labels to match your firm's language,
            or add new options (e.g., "BACS" for UK clients). Disabling hides items from dropdowns without losing existing data.
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
              onAdd={handleAdd}
              onToggle={handleToggle}
              onRelabel={handleRelabel}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  )
}