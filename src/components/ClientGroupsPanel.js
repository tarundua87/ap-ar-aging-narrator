import { useState } from 'react'
import {
  listGroups, createGroup, updateGroup, deleteGroup,
  setClientGroup, getGroupForClient,
} from '../lib/clientGroups'

export default function ClientGroupsPanel({ clients, onClose }) {
  const [, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)

  const groups = listGroups()

  // Create form state
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const handleCreate = () => {
    if (!newName.trim()) return
    createGroup(newName.trim(), newDesc.trim())
    setNewName('')
    setNewDesc('')
    refresh()
  }

  const startEdit = (group) => {
    setEditingId(group.id)
    setEditName(group.name)
    setEditDesc(group.description || '')
  }

  const saveEdit = () => {
    if (editName.trim() && editingId) {
      updateGroup(editingId, { name: editName.trim(), description: editDesc.trim() })
    }
    setEditingId(null)
    refresh()
  }

  const handleDelete = (group) => {
    if (confirm(`Delete the group "${group.name}"? Member clients will not be deleted — they'll just be removed from this group.`)) {
      deleteGroup(group.id)
      refresh()
    }
  }

  const handleAssignClient = (clientSlug, targetGroupId) => {
    setClientGroup(clientSlug, targetGroupId || null)
    refresh()
  }

  // Build a map: client slug → current group (if any)
  const clientGroupMap = {}
  for (const client of clients) {
    clientGroupMap[client.slug] = getGroupForClient(client.slug)
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
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Organization</p>
            <h2 className="text-xl font-bold" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
              Manage Client Groups
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded transition-all"
            style={{ color: 'var(--paper)', background: '#374151' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Intro */}
        <div className="px-6 py-3" style={{ background: '#eef6ff', borderBottom: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: '#1e3a8a' }}>
            Group related client entities together (e.g., parent + subsidiaries). For now, groups are structural only —
            they organize your library without affecting reports. Group-level reporting can be added later.
          </p>
        </div>

        <div className="px-6 py-5" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>

          {/* Create new group */}
          <div className="mb-6 rounded-lg p-4" style={{ background: '#faf9f7', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Create New Group</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="Group name (e.g., Franklin Dental Holdings)"
                className="text-sm px-3 py-2 rounded outline-none"
                style={{ border: '1px solid var(--border)', background: 'white' }}
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="Description (optional)"
                className="text-sm px-3 py-2 rounded outline-none"
                style={{ border: '1px solid var(--border)', background: 'white' }}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="text-sm px-4 py-2 rounded font-medium transition-all"
              style={{
                background: newName.trim() ? 'var(--accent)' : '#d1d5db',
                color: 'white',
                cursor: newName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              + Create Group
            </button>
          </div>

          {/* Existing groups */}
          {groups.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                Existing Groups ({groups.length})
              </h3>
              <div className="space-y-3">
                {groups.map(group => {
                  const memberClients = clients.filter(c => group.clientSlugs.includes(c.slug))
                  const isEditing = editingId === group.id
                  return (
                    <div key={group.id} className="rounded-lg p-4" style={{ border: '1px solid var(--border)' }}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                                className="w-full text-sm px-2 py-1 rounded outline-none font-semibold"
                                style={{ border: '1px solid var(--accent)' }}
                                autoFocus
                              />
                              <input
                                type="text"
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit() }}
                                placeholder="Description"
                                className="w-full text-xs px-2 py-1 rounded outline-none"
                                style={{ border: '1px solid var(--border)' }}
                              />
                            </div>
                          ) : (
                            <div>
                              <h4 className="text-base font-semibold" style={{ fontFamily: 'Playfair Display, serif' }}>
                                👥 {group.name}
                              </h4>
                              {group.description && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{group.description}</p>
                              )}
                              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                                {memberClients.length} member{memberClients.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveEdit}
                                className="text-xs px-2 py-1 rounded transition-all font-medium"
                                style={{ background: '#15803d', color: 'white' }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs px-2 py-1 rounded transition-all"
                                style={{ color: 'var(--muted)' }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(group)}
                                className="text-xs px-2 py-1 rounded transition-all"
                                style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(group)}
                                className="text-xs px-2 py-1 rounded transition-all"
                                style={{ color: 'var(--danger)', border: '1px solid var(--border)' }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {memberClients.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {memberClients.map(c => (
                            <span
                              key={c.slug}
                              className="text-xs px-2 py-1 rounded-full flex items-center gap-1.5"
                              style={{ background: '#f0ece6', color: 'var(--ink)' }}
                            >
                              {c.displayName}
                              <button
                                onClick={() => handleAssignClient(c.slug, null)}
                                title="Remove from group"
                                style={{ color: 'var(--muted)', fontWeight: 'bold' }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Assign clients to groups */}
          {clients.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                Assign Clients to Groups
              </h3>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--ink)' }}>
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold" style={{ color: 'var(--paper)' }}>Client</th>
                      <th className="text-left px-4 py-2 font-semibold" style={{ color: 'var(--paper)' }}>Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client, idx) => {
                      const currentGroup = clientGroupMap[client.slug]
                      return (
                        <tr key={client.slug} style={{ borderBottom: idx < clients.length - 1 ? '1px solid var(--border)' : 'none', background: idx % 2 === 1 ? '#faf9f7' : 'white' }}>
                          <td className="px-4 py-2 font-medium">{client.displayName}</td>
                          <td className="px-4 py-2">
                            <select
                              value={currentGroup?.id || ''}
                              onChange={(e) => handleAssignClient(client.slug, e.target.value || null)}
                              className="text-sm px-2 py-1 rounded outline-none w-full"
                              style={{ border: '1px solid var(--border)', background: 'white' }}
                            >
                              <option value="">— No group —</option>
                              {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {groups.length === 0 && (
                <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                  Create your first group above to start assigning clients.
                </p>
              )}
            </div>
          )}

          {clients.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
              No clients yet. Upload a CSV first, then come back to organize them into groups.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}