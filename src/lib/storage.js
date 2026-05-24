// localStorage wrapper for client reports library
// Schema:
// {
//   "clients": {
//     "franklin-dental-centre": {
//       "slug": "franklin-dental-centre",
//       "displayName": "Franklin Dental Centre",
//       "lastUpdated": "2026-05-19T10:00:00Z",
//       "reports": [
//         {
//           "id": "2026-05-18",
//           "asOfDate": "May 18, 2026",
//           "uploadedAt": "2026-05-19T10:00:00Z",
//           "parsedData": { vendors, aggregate, invoiceCount },
//           "clientNarrative": "...",
//           "vendorNarratives": { "Sinclair Dental (CC - M)": "..." }
//         }
//       ]
//     }
//   }
// }

const STORAGE_KEY = 'ap-narrator:clients'

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function readAll() {
  if (!isBrowser()) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch (err) {
    console.error('Storage read failed', err)
    return {}
  }
}

function writeAll(data) {
  if (!isBrowser()) return false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (err) {
    console.error('Storage write failed', err)
    return false
  }
}

// Public API ──────────────────────────────────────────────

export function listClients() {
  const all = readAll()
  return Object.values(all).sort((a, b) =>
    new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0)
  )
}

export function getClient(slug) {
  const all = readAll()
  return all[slug] || null
}

export function getReport(slug, reportId) {
  const client = getClient(slug)
  if (!client) return null
  return client.reports.find(r => r.id === reportId) || null
}

export function getLatestReport(slug) {
  const client = getClient(slug)
  if (!client || client.reports.length === 0) return null
  return [...client.reports].sort((a, b) =>
    new Date(b.uploadedAt) - new Date(a.uploadedAt)
  )[0]
}

// Save a freshly parsed report (creates client if new, adds new period if new)
// Returns { slug, reportId, isNewClient, isNewPeriod }
export function saveReport({ clientName, asOfDate, parsedData, clientNarrative, rawCsv }) {
  const all = readAll()
  const slug = slugify(clientName)
  const reportId = slugify(asOfDate || 'unknown-period')
  const now = new Date().toISOString()

  const isNewClient = !all[slug]
  if (isNewClient) {
    all[slug] = {
      slug,
      displayName: clientName,
      lastUpdated: now,
      reports: [],
    }
  }

  // Check if this period already exists
  const existingIdx = all[slug].reports.findIndex(r => r.id === reportId)

  const reportRecord = {
    id: reportId,
    asOfDate: asOfDate || 'Unknown period',
    uploadedAt: now,
    parsedData,
    rawCsv: rawCsv || null,
    clientNarrative: clientNarrative || null,
    vendorNarratives: {},
  }

  if (existingIdx >= 0) {
    // Replace existing period (keep vendorNarratives if any)
    reportRecord.vendorNarratives = all[slug].reports[existingIdx].vendorNarratives || {}
    all[slug].reports[existingIdx] = reportRecord
  } else {
    all[slug].reports.push(reportRecord)
  }

  all[slug].lastUpdated = now
  all[slug].displayName = clientName // keep latest name

  const success = writeAll(all)
  return { slug, reportId, isNewClient, isNewPeriod: existingIdx < 0, success }
}

// Save vendor narrative into cache
export function saveVendorNarrative(slug, reportId, vendorName, narrative) {
  const all = readAll()
  if (!all[slug]) return false
  const report = all[slug].reports.find(r => r.id === reportId)
  if (!report) return false
  if (!report.vendorNarratives) report.vendorNarratives = {}
  report.vendorNarratives[vendorName] = narrative
  return writeAll(all)
}

// Save (or overwrite) the client-level narrative
export function saveClientNarrative(slug, reportId, narrative) {
  const all = readAll()
  if (!all[slug]) return false
  const report = all[slug].reports.find(r => r.id === reportId)
  if (!report) return false
  report.clientNarrative = narrative
  return writeAll(all)
}

// Find the report immediately before the given report (by uploadedAt).
// Used by reconciliation to compare a new upload against the prior period.
// Returns null if there's no earlier report.
export function getPreviousReport(slug, currentReportId) {
  const client = getClient(slug)
  if (!client || !client.reports || client.reports.length < 2) return null
  const current = client.reports.find(r => r.id === currentReportId)
  if (!current) return null
  const currentUploadedAt = new Date(current.uploadedAt).getTime()
  // All reports earlier than the current one, sorted newest first
  const earlier = client.reports
    .filter(r => r.id !== currentReportId && new Date(r.uploadedAt).getTime() < currentUploadedAt)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
  return earlier[0] || null
}

// Save reconciliation findings onto a report. Called after upload completes.
// Findings can be null (no previous period to compare against).
export function saveReconciliationFindings(slug, reportId, findings) {
  const all = readAll()
  if (!all[slug]) return false
  const report = all[slug].reports.find(r => r.id === reportId)
  if (!report) return false
  report.reconciliationFindings = findings
  return writeAll(all)
}

export function deleteReport(slug, reportId) {
  const all = readAll()
  if (!all[slug]) return false
  all[slug].reports = all[slug].reports.filter(r => r.id !== reportId)
  if (all[slug].reports.length === 0) {
    delete all[slug]
  }
  return writeAll(all)
}

export function deleteClient(slug) {
  const all = readAll()
  if (!all[slug]) return false
  delete all[slug]
  return writeAll(all)
}

export function getStorageStats() {
  if (!isBrowser()) return { used: 0, percent: 0 }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || ''
    const bytes = new Blob([raw]).size
    const max = 5 * 1024 * 1024 // 5MB approx
    return { used: bytes, percent: (bytes / max) * 100 }
  } catch {
    return { used: 0, percent: 0 }
  }
}

export { slugify }