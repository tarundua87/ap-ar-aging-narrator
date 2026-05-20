import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const DARK = [15, 17, 23]
const PAPER = [253, 251, 247]
const ACCENT = [200, 64, 26]
const MUTED = [107, 114, 128]
const BORDER = [229, 224, 215]

function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function safeFilename(s) {
  return String(s).replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'report'
}

// Escape a value for CSV format
function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// Convert a 2D array of rows to a CSV string
function arrayToCsv(rows) {
  return rows.map(row => row.map(csvEscape).join(',')).join('\n')
}

// Copy a CSV string to the clipboard
export async function copyTableAsCSV(rows) {
  const csv = arrayToCsv(rows)
  try {
    await navigator.clipboard.writeText(csv)
    return true
  } catch (err) {
    // Fallback for older browsers
    const ta = document.createElement('textarea')
    ta.value = csv
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      document.body.removeChild(ta)
      return false
    }
  }
}

// Convert rows to TSV (tab-separated) — pastes directly into Excel cells.
function arrayToTsv(rows) {
  // For TSV, replace tabs in content with spaces and strip newlines so the row structure stays clean
  return rows
    .map(row => row.map(v => (v === null || v === undefined ? '' : String(v).replace(/\t/g, ' ').replace(/[\r\n]+/g, ' '))).join('\t'))
    .join('\n')
}

// Copy a TSV string to the clipboard. Excel pastes this cleanly across columns.
export async function copyTableAsTSV(rows) {
  const tsv = arrayToTsv(rows)
  try {
    await navigator.clipboard.writeText(tsv)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = tsv
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      document.body.removeChild(ta)
      return false
    }
  }
}

// ── CLIENT VIEW — vendor aging table ──────────────────
export function buildClientAgingTable(parsedData) {
  const vendors = parsedData?.vendors || []
  const aggregate = parsedData?.aggregate || {}

  const header = [
    'Vendor', 'Current', '1–30 days', '31–60 days', '61–90 days', 'Over 90 days', 'Total A/P', 'Invoices',
  ]

  const rows = vendors.map(v => [
    v.name,
    fmt(v.aging.current),
    fmt(v.aging.days1_30),
    fmt(v.aging.days31_60),
    fmt(v.aging.days61_90),
    fmt(v.aging.over90),
    fmt(v.aging.totalAP),
    String(v.invoiceCount),
  ])

  const totals = [
    'TOTAL',
    fmt(aggregate.current || 0),
    fmt(aggregate.days1_30 || 0),
    fmt(aggregate.days31_60 || 0),
    fmt(aggregate.days61_90 || 0),
    fmt(aggregate.over90 || 0),
    fmt(aggregate.totalAP || 0),
    String(aggregate.invoiceCount || 0),
  ]

  return { header, rows, totals }
}

// ── VENDOR VIEW — invoice aging table for one vendor ──
// Each invoice gets placed in exactly one aging bucket column based on its days past due.
export function buildVendorAgingTable(vendor) {
  const header = [
    'Invoice #', 'Date', 'Due Date', 'Days Past Due',
    'Current', '1–30 days', '31–60 days', '61–90 days', 'Over 90 days',
    'Open Balance',
  ]

  const rows = (vendor.invoices || []).map(inv => {
    const dpd = Number(inv.daysPastDue || 0)
    const bal = Number(inv.openBalance || 0)
    // Place balance in the correct bucket; other buckets show empty
    const current = dpd <= 0 ? bal : 0
    const d1_30 = dpd > 0 && dpd <= 30 ? bal : 0
    const d31_60 = dpd > 30 && dpd <= 60 ? bal : 0
    const d61_90 = dpd > 60 && dpd <= 90 ? bal : 0
    const over90 = dpd > 90 ? bal : 0

    return [
      inv.invoiceNumber || '',
      inv.date || '',
      inv.dueDate || '',
      dpd > 0 ? String(dpd) + 'd' : '—',
      current !== 0 ? fmt(current) : '',
      d1_30 !== 0 ? fmt(d1_30) : '',
      d31_60 !== 0 ? fmt(d31_60) : '',
      d61_90 !== 0 ? fmt(d61_90) : '',
      over90 !== 0 ? fmt(over90) : '',
      fmt(bal),
    ]
  })

  // Totals row
  const totals = [
    'TOTAL', '', '', '',
    fmt(vendor.aging.current),
    fmt(vendor.aging.days1_30),
    fmt(vendor.aging.days31_60),
    fmt(vendor.aging.days61_90),
    fmt(vendor.aging.over90),
    fmt(vendor.aging.totalAP),
  ]

  return { header, rows, totals }
}

// ── CLIENT VIEW (Input Data tab) — full invoice-level table ──
// Same aging-bucket layout as the vendor view, but with a Vendor column
// so every invoice from every vendor is visible. Mirrors the QBO raw data.
export function buildClientInvoiceTable(parsedData) {
  const vendors = parsedData?.vendors || []
  const aggregate = parsedData?.aggregate || {}

  const header = [
    'Vendor', 'Invoice #', 'Date', 'Due Date', 'Days Past Due',
    'Current', '1–30 days', '31–60 days', '61–90 days', 'Over 90 days',
    'Open Balance',
  ]

  const rows = []
  for (const vendor of vendors) {
    for (const inv of (vendor.invoices || [])) {
      const dpd = Number(inv.daysPastDue || 0)
      const bal = Number(inv.openBalance || 0)
      const current = dpd <= 0 ? bal : 0
      const d1_30 = dpd > 0 && dpd <= 30 ? bal : 0
      const d31_60 = dpd > 30 && dpd <= 60 ? bal : 0
      const d61_90 = dpd > 60 && dpd <= 90 ? bal : 0
      const over90 = dpd > 90 ? bal : 0

      rows.push([
        vendor.name,
        inv.invoiceNumber || '',
        inv.date || '',
        inv.dueDate || '',
        dpd > 0 ? String(dpd) + 'd' : '—',
        current !== 0 ? fmt(current) : '',
        d1_30 !== 0 ? fmt(d1_30) : '',
        d31_60 !== 0 ? fmt(d31_60) : '',
        d61_90 !== 0 ? fmt(d61_90) : '',
        over90 !== 0 ? fmt(over90) : '',
        fmt(bal),
      ])
    }
  }

  const totals = [
    'TOTAL', '', '', '', '',
    fmt(aggregate.current || 0),
    fmt(aggregate.days1_30 || 0),
    fmt(aggregate.days31_60 || 0),
    fmt(aggregate.days61_90 || 0),
    fmt(aggregate.over90 || 0),
    fmt(aggregate.totalAP || 0),
  ]

  return { header, rows, totals }
}

// ── Build the rows array (header + body + totals) for clipboard ─────
export function tableToRowsArray(table) {
  return [table.header, ...table.rows, table.totals]
}

// ── PDF EXPORT ────────────────────────────────────────
export function exportTableAsPDF({ clientName, asOfDate, table, mode, vendorName }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40

  // Header band
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 70, 'F')

  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.text(mode === 'vendor' ? 'VENDOR AGING REPORT' : 'A/P AGING REPORT', margin, 26)

  doc.setFontSize(16)
  doc.setTextColor(...PAPER)
  doc.setFont('helvetica', 'bold')
  const titleText = mode === 'vendor' ? `${vendorName || 'Vendor'} — ${clientName}` : clientName
  doc.text(titleText, margin, 50)

  doc.setFontSize(9)
  doc.setTextColor(156, 163, 175)
  doc.setFont('helvetica', 'normal')
  doc.text(`As of ${asOfDate || 'Unknown'}  |  Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, 64)

  // Table body
  autoTable(doc, {
    startY: 90,
    head: [table.header],
    body: [...table.rows, table.totals],
    headStyles: { fillColor: DARK, textColor: PAPER, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      // Highlight the totals row
      if (data.row.index === table.rows.length) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [240, 236, 230]
      }
    },
  })

  // Footer with page numbers
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 20, { align: 'right' })
    doc.text('AR/AP Aging Narrator', margin, pageH - 20)
  }

  const filenameBase = mode === 'vendor'
    ? `${safeFilename(clientName)}-${safeFilename(vendorName)}-aging`
    : `${safeFilename(clientName)}-aging`
  const filename = `${filenameBase}-${safeFilename(asOfDate || 'report')}.pdf`

  doc.save(filename)
}