import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
    LevelFormat, PageBreak, Header, Footer, PageNumber, TabStopType, TabStopPosition,
  } from 'docx'
  
  const DARK    = '0F1117'
  const ACCENT  = 'C8401A'
  const MID     = '374151'
  const PAPER   = 'F7F5F0'
  const BORDER  = 'E2DDD6'
  
  function fmt(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  
  function safeFilename(s) {
    return String(s).replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '')
  }
  
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
  
  // ── Style helpers ──────────────────────────────
  const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER }
  const borders = { top: border, bottom: border, left: border, right: border }
  
  function h1(text) {
    return new Paragraph({
      spacing: { before: 400, after: 160 },
      children: [new TextRun({ text, bold: true, size: 36, color: DARK, font: 'Arial' })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 4 } },
    })
  }
  
  function h2(text) {
    return new Paragraph({
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text, bold: true, size: 24, color: ACCENT, font: 'Arial' })],
    })
  }
  
  function sectionLabel(text) {
    return new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [new TextRun({ text, bold: true, size: 18, color: ACCENT, font: 'Arial' })],
    })
  }
  
  function bodyPara(text) {
    return new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text, size: 22, color: DARK, font: 'Arial' })],
    })
  }
  
  function vendorHeaderBar(name, subtitle) {
    return new Table({
      width: { size: 9360, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 9360, type: WidthType.DXA },
              borders: { top: border, bottom: border, left: border, right: border },
              shading: { fill: DARK, type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: name, bold: true, size: 26, color: PAPER, font: 'Arial' })],
                }),
                new Paragraph({
                  spacing: { before: 60 },
                  children: [new TextRun({ text: subtitle, size: 18, color: '9CA3AF', font: 'Arial' })],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  }
  
  function pageBreak() {
    return new Paragraph({ children: [new PageBreak()] })
  }
  
  function spacer() {
    return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun('')] })
  }
  
  function tableHeaderCell(text, width) {
    return new TableCell({
      width: { size: width, type: WidthType.DXA }, borders,
      shading: { fill: DARK, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, color: PAPER, font: 'Arial' })] })],
    })
  }
  
  function tableCell(text, width, shade = false, opts = {}) {
    return new TableCell({
      width: { size: width, type: WidthType.DXA }, borders,
      shading: { fill: shade ? 'FAF9F7' : 'FFFFFF', type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        children: [new TextRun({ text, size: 18, color: DARK, font: 'Arial', bold: opts.bold || false })],
      })],
    })
  }
  
  // ── Document Builder ───────────────────────────
  export async function exportReportWord({ clientName, asOfDate, parsedData, clientNarrative, vendorNarratives }) {
    const { vendors, aggregate } = parsedData
    const vendorsWithNarratives = vendors.filter(v => vendorNarratives && vendorNarratives[v.name])
  
    const sections = []
  
    // ── COVER PAGE ──
    sections.push(
      new Paragraph({ spacing: { before: 1440 }, children: [new TextRun('')] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: 'A/P AGING NARRATIVE REPORT', size: 20, bold: true, color: ACCENT, font: 'Arial' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 160 },
        children: [new TextRun({ text: clientName, size: 56, bold: true, color: DARK, font: 'Arial' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 480 },
        children: [new TextRun({ text: `As of ${asOfDate || 'Unknown period'}`, size: 26, color: MID, font: 'Arial', italics: true })],
      }),
    )
  
    // Executive summary stats table
    const overduePercent = aggregate.totalAP > 0 ? ((aggregate.overdueTotal / aggregate.totalAP) * 100).toFixed(1) : '0.0'
    sections.push(
      new Table({
        width: { size: 7920, type: WidthType.DXA },
        alignment: AlignmentType.CENTER,
        columnWidths: [2640, 2640, 2640],
        rows: [
          new TableRow({
            children: [
              tableHeaderCell('Metric', 2640),
              tableHeaderCell('Value', 2640),
              tableHeaderCell('Detail', 2640),
            ],
          }),
          new TableRow({
            children: [
              tableCell('Total A/P', 2640, false, { bold: true }),
              tableCell(fmt(aggregate.totalAP), 2640, true, { bold: true }),
              tableCell(`${aggregate.invoiceCount} invoices`, 2640, false),
            ],
          }),
          new TableRow({
            children: [
              tableCell('Overdue', 2640, true, { bold: true }),
              tableCell(fmt(aggregate.overdueTotal), 2640, false, { bold: true }),
              tableCell(`${overduePercent}% of total`, 2640, true),
            ],
          }),
          new TableRow({
            children: [
              tableCell('Vendors', 2640, false, { bold: true }),
              tableCell(String(aggregate.vendorCount), 2640, true, { bold: true }),
              tableCell(`${aggregate.criticalVendors} critical`, 2640, false),
            ],
          }),
          new TableRow({
            children: [
              tableCell('Oldest Invoice', 2640, true, { bold: true }),
              tableCell(`${aggregate.oldestInvoiceDays} days`, 2640, false, { bold: true }),
              tableCell('past due', 2640, true),
            ],
          }),
          new TableRow({
            children: [
              tableCell('Over 90 Days', 2640, false, { bold: true }),
              tableCell(fmt(aggregate.over90), 2640, true, { bold: true }),
              tableCell('highest risk', 2640, false),
            ],
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 720 },
        children: [new TextRun({
          text: `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
          size: 18, color: MID, font: 'Arial',
        })],
      }),
      pageBreak(),
    )
  
    // ── CLIENT NARRATIVE ──
    sections.push(h1('Client Narrative'))
    const clientSections = parseNarrativeSections(clientNarrative)
    if (clientSections.length === 0 && clientNarrative) {
      sections.push(bodyPara(clientNarrative))
    } else {
      clientSections.forEach(sec => {
        sections.push(sectionLabel(sec.label))
        sec.content.split('\n').forEach(line => {
          if (line.trim()) sections.push(bodyPara(line.trim()))
        })
      })
    }
  
    // ── TOP OLDEST INVOICES ──
    if (aggregate.topOldestInvoices && aggregate.topOldestInvoices.length > 0) {
      sections.push(pageBreak(), h1('Top Oldest Open Invoices'))
      sections.push(
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3360, 2400, 1800, 1800],
          rows: [
            new TableRow({
              children: [
                tableHeaderCell('Vendor', 3360),
                tableHeaderCell('Invoice #', 2400),
                tableHeaderCell('Days Past Due', 1800),
                tableHeaderCell('Open Balance', 1800),
              ],
            }),
            ...aggregate.topOldestInvoices.map((inv, i) => new TableRow({
              children: [
                tableCell(inv.vendor, 3360, i % 2 === 1),
                tableCell(inv.invoiceNumber, 2400, i % 2 === 1),
                tableCell(`${inv.daysPastDue}d`, 1800, i % 2 === 1, { align: AlignmentType.RIGHT }),
                tableCell(fmt(inv.openBalance), 1800, i % 2 === 1, { align: AlignmentType.RIGHT, bold: true }),
              ],
            })),
          ],
        }),
      )
    }
  
    // ── VENDOR DRILL-DOWNS ──
    if (vendorsWithNarratives.length > 0) {
      sections.push(pageBreak(), h1('Vendor Drill-Downs'))
      sections.push(new Paragraph({
        spacing: { before: 80, after: 240 },
        children: [new TextRun({
          text: `${vendorsWithNarratives.length} vendor narrative${vendorsWithNarratives.length !== 1 ? 's' : ''} generated`,
          size: 20, color: MID, font: 'Arial', italics: true,
        })],
      }))
  
      vendorsWithNarratives.forEach((vendor, idx) => {
        if (idx > 0) sections.push(pageBreak())
  
        sections.push(vendorHeaderBar(
          vendor.name,
          `${fmt(vendor.aging.totalAP)}  |  ${vendor.invoiceCount} invoices  |  Status: ${vendor.status}`,
        ))
        sections.push(spacer())
  
        // Narrative
        const vSections = parseNarrativeSections(vendorNarratives[vendor.name])
        vSections.forEach(sec => {
          sections.push(sectionLabel(sec.label))
          sec.content.split('\n').forEach(line => {
            if (line.trim()) sections.push(bodyPara(line.trim()))
          })
        })
  
        // Invoice table
        if (vendor.invoices && vendor.invoices.length > 0) {
          sections.push(spacer())
          sections.push(new Paragraph({
            spacing: { before: 120, after: 80 },
            children: [new TextRun({ text: `All Invoices (${vendor.invoiceCount})`, bold: true, size: 20, color: MID, font: 'Arial' })],
          }))
          sections.push(
            new Table({
              width: { size: 9360, type: WidthType.DXA },
              columnWidths: [1800, 1680, 1680, 1800, 2400],
              rows: [
                new TableRow({
                  children: [
                    tableHeaderCell('Invoice #', 1800),
                    tableHeaderCell('Date', 1680),
                    tableHeaderCell('Due Date', 1680),
                    tableHeaderCell('Days Past Due', 1800),
                    tableHeaderCell('Open Balance', 2400),
                  ],
                }),
                ...vendor.invoices.map((inv, i) => new TableRow({
                  children: [
                    tableCell(inv.invoiceNumber, 1800, i % 2 === 1),
                    tableCell(inv.date, 1680, i % 2 === 1),
                    tableCell(inv.dueDate || '—', 1680, i % 2 === 1),
                    tableCell(inv.daysPastDue > 0 ? `${inv.daysPastDue}d` : '—', 1800, i % 2 === 1, { align: AlignmentType.RIGHT }),
                    tableCell(fmt(inv.openBalance), 2400, i % 2 === 1, { align: AlignmentType.RIGHT, bold: true }),
                  ],
                })),
              ],
            }),
          )
        }
      })
    }
  
    // ── Build document ──
    const doc = new Document({
      styles: {
        default: { document: { run: { font: 'Arial', size: 22 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 4 } },
              children: [
                new TextRun({ text: `${clientName}  |  As of ${asOfDate || 'Unknown'}`, size: 16, font: 'Arial', color: MID }),
                new TextRun({ text: '\t\t', size: 16 }),
                new TextRun({ text: 'A/P AGING NARRATIVE', size: 16, font: 'Arial', color: ACCENT, bold: true }),
              ],
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 4 } },
              children: [
                new TextRun({ text: 'AR/AP Aging Narrator  |  Generated ' + new Date().toLocaleDateString(), size: 16, font: 'Arial', color: MID }),
                new TextRun({ text: '\tPage ', size: 16, font: 'Arial', color: MID }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: MID }),
              ],
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            })],
          }),
        },
        children: sections,
      }],
    })
  
    const blob = await Packer.toBlob(doc)
    const filename = `${safeFilename(clientName)}-${safeFilename(asOfDate || 'report')}.docx`
  
    // Trigger download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ───────────────────────────────────────────────────
// Single-vendor focused Word export
// ───────────────────────────────────────────────────
export async function exportVendorWord({ clientName, asOfDate, vendor, vendorNarrative }) {
  const sections = []

  // ── COVER ──
  sections.push(
    new Paragraph({ spacing: { before: 1440 }, children: [new TextRun('')] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: 'VENDOR ANALYSIS', size: 20, bold: true, color: ACCENT, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: vendor.name, size: 48, bold: true, color: DARK, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [new TextRun({ text: `Client: ${clientName}`, size: 24, color: MID, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 480 },
      children: [new TextRun({ text: `As of ${asOfDate || 'Unknown period'}`, size: 24, color: MID, font: 'Arial', italics: true })],
    }),
  )

  // Vendor stats table
  sections.push(
    new Table({
      width: { size: 7920, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      columnWidths: [2640, 2640, 2640],
      rows: [
        new TableRow({
          children: [
            tableHeaderCell('Metric', 2640),
            tableHeaderCell('Value', 2640),
            tableHeaderCell('Detail', 2640),
          ],
        }),
        new TableRow({
          children: [
            tableCell('Total Owed', 2640, false, { bold: true }),
            tableCell(fmt(vendor.aging.totalAP), 2640, true, { bold: true }),
            tableCell(`${vendor.invoiceCount} invoices`, 2640, false),
          ],
        }),
        new TableRow({
          children: [
            tableCell('Overdue', 2640, true, { bold: true }),
            tableCell(fmt(vendor.overdueTotal), 2640, false, { bold: true }),
            tableCell(`Status: ${vendor.status}`, 2640, true),
          ],
        }),
        new TableRow({
          children: [
            tableCell('Oldest Invoice', 2640, false, { bold: true }),
            tableCell(`${vendor.oldestDays} days`, 2640, true, { bold: true }),
            tableCell('past due', 2640, false),
          ],
        }),
        new TableRow({
          children: [
            tableCell('Over 90 Days', 2640, true, { bold: true }),
            tableCell(fmt(vendor.aging.over90), 2640, false, { bold: true }),
            tableCell(vendor.hasCredits ? 'Has supplier credits' : 'No credits', 2640, true),
          ],
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720 },
      children: [new TextRun({
        text: `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        size: 18, color: MID, font: 'Arial',
      })],
    }),
    pageBreak(),
  )

  // ── NARRATIVE ──
  sections.push(h1('Vendor Narrative'))
  const narrSections = parseNarrativeSections(vendorNarrative)
  if (narrSections.length === 0 && vendorNarrative) {
    sections.push(bodyPara(vendorNarrative))
  } else {
    narrSections.forEach(sec => {
      sections.push(sectionLabel(sec.label))
      sec.content.split('\n').forEach(line => {
        if (line.trim()) sections.push(bodyPara(line.trim()))
      })
    })
  }

  // ── INVOICE TABLE ──
  if (vendor.invoices && vendor.invoices.length > 0) {
    sections.push(pageBreak(), h1(`All Invoices (${vendor.invoiceCount})`))
    sections.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1800, 1680, 1680, 1800, 2400],
        rows: [
          new TableRow({
            children: [
              tableHeaderCell('Invoice #', 1800),
              tableHeaderCell('Date', 1680),
              tableHeaderCell('Due Date', 1680),
              tableHeaderCell('Days Past Due', 1800),
              tableHeaderCell('Open Balance', 2400),
            ],
          }),
          ...vendor.invoices.map((inv, i) => new TableRow({
            children: [
              tableCell(inv.invoiceNumber, 1800, i % 2 === 1),
              tableCell(inv.date, 1680, i % 2 === 1),
              tableCell(inv.dueDate || '—', 1680, i % 2 === 1),
              tableCell(inv.daysPastDue > 0 ? `${inv.daysPastDue}d` : '—', 1800, i % 2 === 1, { align: AlignmentType.RIGHT }),
              tableCell(fmt(inv.openBalance), 2400, i % 2 === 1, { align: AlignmentType.RIGHT, bold: true }),
            ],
          })),
        ],
      }),
    )
  }

  // ── Build document ──
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 4 } },
            children: [
              new TextRun({ text: `${clientName}  |  ${vendor.name}  |  As of ${asOfDate || 'Unknown'}`, size: 16, font: 'Arial', color: MID }),
              new TextRun({ text: '\t\t', size: 16 }),
              new TextRun({ text: 'VENDOR ANALYSIS', size: 16, font: 'Arial', color: ACCENT, bold: true }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 4 } },
            children: [
              new TextRun({ text: 'AR/AP Aging Narrator  |  Generated ' + new Date().toLocaleDateString(), size: 16, font: 'Arial', color: MID }),
              new TextRun({ text: '\tPage ', size: 16, font: 'Arial', color: MID }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: MID }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          })],
        }),
      },
      children: sections,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `${safeFilename(clientName)}-${safeFilename(vendor.name)}-${safeFilename(asOfDate || 'report')}.docx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}