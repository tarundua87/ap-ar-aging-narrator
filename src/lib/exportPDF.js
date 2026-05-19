import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const DARK    = [15, 17, 23]
const ACCENT  = [200, 64, 26]
const MID     = [55, 65, 81]
const MUTED   = [107, 107, 107]
const BORDER  = [226, 221, 214]
const PAPER   = [247, 245, 240]

function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function safeFilename(s) {
  return String(s).replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '')
}

// Parse narrative text into labeled sections
function parseNarrativeSections(text) {
  if (!text) return []
  const sections = ['ASSESSMENT', 'KEY CONCERNS', 'CASH FLOW PRIORITIES', 'RECOMMENDED ACTIONS', 'DRAFT MEMO', 'DRAFT FOLLOW-UP EMAIL']
  let remaining = text
  const parts = []
  sections.forEach((section) => {
    const idx = remaining.toUpperCase().indexOf(section)
    if (idx === -1) return
    const nextIdx = sections.map(s => {
      const i = remaining.toUpperCase().indexOf(s, idx + section.length)
      return i === -1 ? Infinity : i
    }).filter(i => i > idx).reduce((a, b) => Math.min(a, b), Infinity)
    parts.push({
      label: section,
      content: remaining.slice(idx + section.length, nextIdx === Infinity ? undefined : nextIdx).replace(/^[:\s]+/, '').trim(),
    })
    remaining = nextIdx === Infinity ? '' : remaining.slice(nextIdx)
  })
  return parts
}

export function exportReportPDF({ clientName, asOfDate, parsedData, clientNarrative, vendorNarratives }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 50

  const { vendors, aggregate } = parsedData

  // ── COVER PAGE ─────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, pageH, 'F')

  doc.setFontSize(11)
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.text('A/P AGING NARRATIVE REPORT', pageW / 2, 200, { align: 'center' })

  doc.setFontSize(32)
  doc.setTextColor(...PAPER)
  doc.text(clientName, pageW / 2, 260, { align: 'center' })

  doc.setFontSize(14)
  doc.setTextColor(156, 163, 175)
  doc.setFont('helvetica', 'normal')
  doc.text(`As of ${asOfDate || 'Unknown period'}`, pageW / 2, 290, { align: 'center' })

  // Stats box on cover
  const boxY = 380
  const boxH = 200
  const boxW = pageW - 2 * margin - 80
  const boxX = margin + 40
  doc.setFillColor(30, 33, 41)
  doc.roundedRect(boxX, boxY, boxW, boxH, 8, 8, 'F')

  doc.setFontSize(10)
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.text('EXECUTIVE SUMMARY', boxX + 24, boxY + 30)

  const stats = [
    ['Total A/P', fmt(aggregate.totalAP), `${aggregate.invoiceCount} invoices`],
    ['Overdue', fmt(aggregate.overdueTotal), `${aggregate.totalAP > 0 ? ((aggregate.overdueTotal / aggregate.totalAP) * 100).toFixed(1) : '0'}% of total`],
    ['Vendors', String(aggregate.vendorCount), `${aggregate.criticalVendors} critical`],
    ['Oldest Invoice', `${aggregate.oldestInvoiceDays} days`, 'past due'],
  ]
  stats.forEach((stat, i) => {
    const y = boxY + 60 + i * 32
    doc.setFontSize(10)
    doc.setTextColor(156, 163, 175)
    doc.setFont('helvetica', 'normal')
    doc.text(stat[0], boxX + 24, y)

    doc.setFontSize(13)
    doc.setTextColor(...PAPER)
    doc.setFont('helvetica', 'bold')
    doc.text(stat[1], boxX + 200, y)

    doc.setFontSize(9)
    doc.setTextColor(156, 163, 175)
    doc.setFont('helvetica', 'normal')
    doc.text(stat[2], boxX + 320, y)
  })

  // Footer on cover
  doc.setFontSize(9)
  doc.setTextColor(156, 163, 175)
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, pageW / 2, pageH - 50, { align: 'center' })

  // ── CLIENT NARRATIVE PAGE ──────────────────────────
  doc.addPage()
  doc.setFillColor(...PAPER)
  doc.rect(0, 0, pageW, pageH, 'F')

  let y = margin

  // Page header
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(`${clientName}  |  As of ${asOfDate || 'Unknown'}`, margin, y)
  doc.setDrawColor(...BORDER)
  doc.line(margin, y + 6, pageW - margin, y + 6)
  y += 30

  // Section title
  doc.setFontSize(18)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.text('Client Narrative', margin, y)
  y += 30

  const clientSections = parseNarrativeSections(clientNarrative)
  if (clientSections.length === 0 && clientNarrative) {
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(clientNarrative, pageW - 2 * margin)
    doc.text(lines, margin, y)
  } else {
    clientSections.forEach(sec => {
      if (y > pageH - 100) { doc.addPage(); y = margin }
      doc.setFontSize(9)
      doc.setTextColor(...ACCENT)
      doc.setFont('helvetica', 'bold')
      doc.text(sec.label, margin, y)
      y += 14
      doc.setFontSize(10)
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(sec.content, pageW - 2 * margin)
      lines.forEach(line => {
        if (y > pageH - 60) { doc.addPage(); y = margin }
        doc.text(line, margin, y)
        y += 14
      })
      y += 14
    })
  }

  // ── TOP OLDEST INVOICES ────────────────────────────
  if (aggregate.topOldestInvoices && aggregate.topOldestInvoices.length > 0) {
    doc.addPage()
    y = margin
    doc.setFontSize(18)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.text('Top Oldest Open Invoices', margin, y)
    y += 20

    autoTable(doc, {
      startY: y,
      head: [['Vendor', 'Invoice #', 'Days Past Due', 'Open Balance']],
      body: aggregate.topOldestInvoices.map(inv => [
        inv.vendor,
        inv.invoiceNumber,
        `${inv.daysPastDue}d`,
        fmt(inv.openBalance),
      ]),
      headStyles: { fillColor: DARK, textColor: PAPER, fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: DARK },
      alternateRowStyles: { fillColor: [250, 249, 247] },
      margin: { left: margin, right: margin },
    })
  }

  // ── VENDOR DRILL-DOWNS ─────────────────────────────
  const vendorsWithNarratives = vendors.filter(v => vendorNarratives && vendorNarratives[v.name])

  if (vendorsWithNarratives.length > 0) {
    doc.addPage()
    y = margin
    doc.setFontSize(18)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.text('Vendor Drill-Downs', margin, y)
    y += 8
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.text(`${vendorsWithNarratives.length} vendor narrative${vendorsWithNarratives.length !== 1 ? 's' : ''} generated`, margin, y + 12)
    y += 36

    vendorsWithNarratives.forEach((vendor) => {
      if (y > pageH - 200) { doc.addPage(); y = margin }

      // Vendor header bar
      doc.setFillColor(...DARK)
      doc.rect(margin, y, pageW - 2 * margin, 36, 'F')
      doc.setFontSize(12)
      doc.setTextColor(...PAPER)
      doc.setFont('helvetica', 'bold')
      doc.text(vendor.name, margin + 12, y + 16)
      doc.setFontSize(9)
      doc.setTextColor(156, 163, 175)
      doc.setFont('helvetica', 'normal')
      doc.text(`${fmt(vendor.aging.totalAP)}  |  ${vendor.invoiceCount} invoices  |  Status: ${vendor.status}`, margin + 12, y + 30)
      y += 50

      // Narrative
      const sections = parseNarrativeSections(vendorNarratives[vendor.name])
      sections.forEach(sec => {
        if (y > pageH - 60) { doc.addPage(); y = margin }
        doc.setFontSize(8)
        doc.setTextColor(...ACCENT)
        doc.setFont('helvetica', 'bold')
        doc.text(sec.label, margin, y)
        y += 12
        doc.setFontSize(9)
        doc.setTextColor(...DARK)
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(sec.content, pageW - 2 * margin)
        lines.forEach(line => {
          if (y > pageH - 50) { doc.addPage(); y = margin }
          doc.text(line, margin, y)
          y += 12
        })
        y += 10
      })

      // Invoice table for this vendor
      if (vendor.invoices && vendor.invoices.length > 0) {
        if (y > pageH - 150) { doc.addPage(); y = margin }
        autoTable(doc, {
          startY: y,
          head: [['Invoice #', 'Date', 'Due Date', 'Days Past Due', 'Open Balance']],
          body: vendor.invoices.map(inv => [
            inv.invoiceNumber,
            inv.date,
            inv.dueDate || '—',
            inv.daysPastDue > 0 ? `${inv.daysPastDue}d` : '—',
            fmt(inv.openBalance),
          ]),
          headStyles: { fillColor: MID, textColor: PAPER, fontSize: 8 },
          bodyStyles: { fontSize: 8, textColor: DARK },
          alternateRowStyles: { fillColor: [250, 249, 247] },
          margin: { left: margin, right: margin },
        })
        y = doc.lastAutoTable.finalY + 24
      }
    })
  }

  // ── PAGE NUMBERS ───────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`Page ${i - 1} of ${totalPages - 1}`, pageW - margin, pageH - 24, { align: 'right' })
  }

  // ── SAVE ───────────────────────────────────────────
  const filename = `${safeFilename(clientName)}-${safeFilename(asOfDate || 'report')}.pdf`
  doc.save(filename)
}