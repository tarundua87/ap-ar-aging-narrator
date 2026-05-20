// Client groups — purely structural for now (no reporting impact).
// Lets the user organize multiple client entities under a parent group
// (e.g., a holding company with several subsidiaries).
//
// Storage key: "ap-narrator:clientGroups"
// Schema:
// {
//   "[groupId]": {
//     id: "stable-uuid",
//     name: "Franklin Dental Holdings",
//     description: "",
//     clientSlugs: ["franklin-dental-centre", "franklin-toronto", ...],
//     createdAt: ISO timestamp,
//     updatedAt: ISO timestamp
//   }
// }

const STORAGE_KEY = 'ap-narrator:clientGroups'

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function makeGroupId() {
  return 'grp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

// ── Storage read / write ─────────────────────────────────

function readAll() {
  if (!isBrowser()) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) || {} : {}
  } catch {
    return {}
  }
}

function writeAll(data) {
  if (!isBrowser()) return false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (err) {
    console.error('Failed to write groups', err)
    return false
  }
}

// ── Public API ───────────────────────────────────────────

export function listGroups() {
  return Object.values(readAll()).sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  )
}

export function getGroup(groupId) {
  const all = readAll()
  return all[groupId] || null
}

// Create a new group; returns the created group or null.
export function createGroup(name, description = '') {
  if (!name || !name.trim()) return null
  const all = readAll()
  const id = makeGroupId()
  const now = new Date().toISOString()
  const group = {
    id,
    name: name.trim(),
    description: description.trim(),
    clientSlugs: [],
    createdAt: now,
    updatedAt: now,
  }
  all[id] = group
  return writeAll(all) ? group : null
}

export function updateGroup(groupId, updates) {
  const all = readAll()
  if (!all[groupId]) return false
  all[groupId] = {
    ...all[groupId],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  return writeAll(all)
}

export function deleteGroup(groupId) {
  const all = readAll()
  if (!all[groupId]) return false
  delete all[groupId]
  return writeAll(all)
}

// Add a client slug to a group. If client is already in another group,
// it stays there too (a client can belong to multiple groups if desired
// — but practically the UI will enforce single membership).
export function addClientToGroup(groupId, clientSlug) {
  const all = readAll()
  if (!all[groupId] || !clientSlug) return false
  if (!all[groupId].clientSlugs.includes(clientSlug)) {
    all[groupId].clientSlugs.push(clientSlug)
    all[groupId].updatedAt = new Date().toISOString()
    return writeAll(all)
  }
  return true
}

export function removeClientFromGroup(groupId, clientSlug) {
  const all = readAll()
  if (!all[groupId] || !clientSlug) return false
  all[groupId].clientSlugs = all[groupId].clientSlugs.filter(s => s !== clientSlug)
  all[groupId].updatedAt = new Date().toISOString()
  return writeAll(all)
}

// Move a client from one group to another (or set its group from "none").
// If targetGroupId is null/empty, the client is just removed from any group.
export function setClientGroup(clientSlug, targetGroupId) {
  if (!clientSlug) return false
  const all = readAll()
  // Remove from any existing group(s)
  for (const groupId of Object.keys(all)) {
    all[groupId].clientSlugs = all[groupId].clientSlugs.filter(s => s !== clientSlug)
  }
  // Add to target if specified
  if (targetGroupId && all[targetGroupId]) {
    all[targetGroupId].clientSlugs.push(clientSlug)
    all[targetGroupId].updatedAt = new Date().toISOString()
  }
  return writeAll(all)
}

// Returns the group a given client belongs to (or null if none).
export function getGroupForClient(clientSlug) {
  if (!clientSlug) return null
  const all = readAll()
  for (const group of Object.values(all)) {
    if (group.clientSlugs.includes(clientSlug)) return group
  }
  return null
}

// Returns all groups that include the client (in case of multi-membership).
export function getAllGroupsForClient(clientSlug) {
  if (!clientSlug) return []
  return Object.values(readAll()).filter(g => g.clientSlugs.includes(clientSlug))
}

// Helper: get all client slugs that are part of any group.
export function getAllGroupedClientSlugs() {
  const slugs = new Set()
  for (const group of Object.values(readAll())) {
    group.clientSlugs.forEach(s => slugs.add(s))
  }
  return Array.from(slugs)
}

// Helper: are these two client slugs in the same group?
// Used later when generating cross-entity recommendations.
export function areClientsInSameGroup(slugA, slugB) {
  if (!slugA || !slugB || slugA === slugB) return false
  const all = readAll()
  for (const group of Object.values(all)) {
    if (group.clientSlugs.includes(slugA) && group.clientSlugs.includes(slugB)) {
      return true
    }
  }
  return false
}