import Papa from 'papaparse'

// Parses the QBO A/P Aging Detail Report CSV format
// Auto-detects client name, parses bucket-grouped invoices,
// groups by vendor, calculates client-level aggregate.

const BUCKET_PATTERNS = [
  { key: 'over90',    label: 'Over 90 Days',  match: /91\s*or\s*more|over\s*90|>\s*90|91\+/i },
  { key: 'days61_90', label: '61–90 Days',    match: /61\s*-\s*90|61\s*–\s*90/i },
  { key: 'days31_60', label: '31–60 Days',    match: /31\s*-\s*60|31\s*–\s*60/i },
  { key: 'days1_30',  label: '1–30 Days',     match: /1\s*-\s*30|1\s*–\s*30/i },
  { key: 'current',   label: 'Current',       match: /^current$/i },
]

function num(val) {
  if (val == null || val === '') return 0
  const cleaned = String(val).replace(/[$,"\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function detectBucket(row) {
  const firstCell = String(row[0] || '').trim()
  if (!firstCell || firstCell.toLowerCase().startsWith('total')) return null
  for (const b of BUCKET_PATTERNS) {
    if (b.match.test(firstCell)) return b
  }
  return null
}

function isSubtotalRow(row) {
  const firstCell = String(row[0] || '').trim().toLowerCase()
  return firstCell.startsWith('total for') || firstCell === 'total'
}

function isInvoiceRow(row) {
  // Invoice rows: empty col A, but have Date in [1] and Vendor in [4]
  return !row[0] && row[1] && row[4]
}

export function parseAPAgingDetail(csvText) {
  const result = Papa.parse(csvText, { skipEmptyLines: 'greedy' })
  const rows = result.data

  // 1. Auto-detect client name (first non-empty row that isn't aging/date metadata)
  let clientName = 'Client'
  for (const row of rows) {
    const first = String(row[0] || '').trim()
    if (first && !first.toLowerCase().includes('aging') && !first.toLowerCase().startsWith('as of')) {
      clientName = first
      break
    }
  }

  // 2. Walk rows, track current bucket, collect invoices
  let currentBucket = null
  const invoices = []

  for (const row of rows) {
    if (!row || row.length === 0) continue

    const bucket = detectBucket(row)
    if (bucket) { currentBucket = bucket; continue }

    if (isSubtotalRow(row)) continue

    if (isInvoiceRow(row) && currentBucket) {
      const invoice = {
        date: row[1] || '',
        transactionType: row[2] || '',
        invoiceNumber: String(row[3] || '(no number)').trim(),
        vendor: String(row[4] || '').trim(),
        dueDate: row[5] || '',
        daysPastDue: num(row[6]),
        amount: num(row[7]),
        openBalance: num(row[8]),
        bucket: currentBucket.key,
        bucketLabel: currentBucket.label,
      }
      if (invoice.vendor && invoice.openBalance !== 0) {
        invoices.push(invoice)
      }
    }
  }

  // 3. Group by vendor
  const vendorMap = {}
  for (const inv of invoices) {
    if (!vendorMap[inv.vendor]) {
      vendorMap[inv.vendor] = {
        name: inv.vendor,
        invoices: [],
        aging: { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0, totalAP: 0 },
        invoiceCount: 0,
        oldestDays: 0,
        hasCredits: false,
      }
    }
    const v = vendorMap[inv.vendor]
    v.invoices.push(inv)
    v.aging[inv.bucket] += inv.openBalance
    v.aging.totalAP += inv.openBalance
    v.invoiceCount += 1
    if (inv.daysPastDue > v.oldestDays) v.oldestDays = inv.daysPastDue
    if (inv.openBalance < 0) v.hasCredits = true
  }

  // 4. Calculate urgency score + status per vendor
  const vendors = Object.values(vendorMap).map((v) => {
    const urgencyScore =
      (v.aging.over90 * 4) +
      (v.aging.days61_90 * 3) +
      (v.aging.days31_60 * 2) +
      (v.aging.days1_30 * 1)

    let status = 'ok'
    if (v.aging.over90 > 0 || v.aging.days61_90 > 0) status = 'critical'
    else if (v.aging.days31_60 > 0 || v.aging.days1_30 > Math.abs(v.aging.totalAP) * 0.3) status = 'warning'

    v.invoices.sort((a, b) => b.daysPastDue - a.daysPastDue)

    const overdueTotal = v.aging.days1_30 + v.aging.days31_60 + v.aging.days61_90 + v.aging.over90

    return { ...v, urgencyScore, status, overdueTotal }
  }).sort((a, b) => b.urgencyScore - a.urgencyScore)

  // 5. Client-level aggregate
  const aggregate = {
    totalAP: 0,
    current: 0,
    days1_30: 0,
    days31_60: 0,
    days61_90: 0,
    over90: 0,
    overdueTotal: 0,
    vendorCount: vendors.length,
    invoiceCount: invoices.length,
    criticalVendors: vendors.filter(v => v.status === 'critical').length,
    warningVendors: vendors.filter(v => v.status === 'warning').length,
    okVendors: vendors.filter(v => v.status === 'ok').length,
    oldestInvoiceDays: 0,
    topOldestInvoices: [],
  }

  for (const v of vendors) {
    aggregate.totalAP += v.aging.totalAP
    aggregate.current += v.aging.current
    aggregate.days1_30 += v.aging.days1_30
    aggregate.days31_60 += v.aging.days31_60
    aggregate.days61_90 += v.aging.days61_90
    aggregate.over90 += v.aging.over90
  }
  aggregate.overdueTotal = aggregate.days1_30 + aggregate.days31_60 + aggregate.days61_90 + aggregate.over90

  aggregate.topOldestInvoices = invoices
    .filter(i => i.openBalance > 0)
    .sort((a, b) => b.daysPastDue - a.daysPastDue)
    .slice(0, 10)

  if (aggregate.topOldestInvoices.length > 0) {
    aggregate.oldestInvoiceDays = aggregate.topOldestInvoices[0].daysPastDue
  }

  return { clientName, vendors, aggregate, invoiceCount: invoices.length }
}