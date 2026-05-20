import { useState, useMemo } from 'react'
import VendorProfileStrip from './VendorProfileStrip'
import { extractDraftEmail, hasDraftEmail, narrativeWithoutDraft } from '../lib/narrativeParser'
import {
  buildClientAgingTable, buildVendorAgingTable, buildClientInvoiceTable,
  tableToRowsArray, copyTableAsTSV, exportTableAsPDF,
} from '../lib/exportTable'

const TAB_SUMMARY = 'summary'
const TAB_EMAIL = 'email'
const TAB_REPORT = 'report'
const TAB_INPUT = 'input'

function ActionButton({ onClick, label, variant = 'subtle', disabled = false, title, onDark = false }) {
  const styles = {
    subtle: onDark
      ? { background: 'rgba(255,255,255,0.08)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.15)' }
      : { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)' },
    primary: { background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--paper)' },
    accent:  { background: 'var(--accent)', color: 'white',     border: '1px solid var(--accent)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="text-xs px-3 py-1.5 rounded transition-all hover:opacity-90"
      style={{ ...styles[variant], opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500 }}
    >
      {label}
    </button>
  )
}

function PillTab({ label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className="text-sm px-3 py-1.5 rounded-full transition-all"
      style={{
        background: active ? 'var(--ink)' : 'transparent',
        color: active ? 'var(--paper)' : 'var(--muted)',
        border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border)'),
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
      {badge !== undefined && badge !== null && (
        <span
          className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
          style={{
            background: active ? 'rgba(255,255,255,0.15)' : 'var(--border)',
            color: active ? 'var(--paper)' : 'var(--muted)',
            fontSize: '0.65rem',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

// ── Tab 1: Summary (with draft section stripped) ───────────────
function SummaryTab({ narrative, loading, mode, hasDraft, onJumpToEmail }) {
  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block w-8 h-8 rounded-full border-3 animate-spin mb-3" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', borderWidth: '3px' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Generating narrative…</p>
      </div>
    )
  }
  if (!narrative) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>
        <p className="text-sm">No narrative yet. Click ↻ Refresh above to generate.</p>
      </div>
    )
  }

  const cleanedNarrative = narrativeWithoutDraft(narrative, mode)

  return (
    <div className="px-6 py-5">
      <pre
        className="text-sm whitespace-pre-wrap"
        style={{ fontFamily: 'Georgia, serif', lineHeight: '1.7', color: 'var(--ink)', margin: 0 }}
      >
        {cleanedNarrative}
      </pre>

      {hasDraft && onJumpToEmail && (
        <div
          className="mt-5 px-4 py-3 rounded-lg flex items-center justify-between gap-3"
          style={{ background: '#eef6ff', border: '1px solid #bfdbfe' }}
        >
          <p className="text-xs" style={{ color: '#1e3a8a' }}>
            📧 A draft {mode === 'vendor' ? 'follow-up email' : 'memo'} has been generated. View and copy it from the Draft Email tab.
          </p>
          <button
            onClick={onJumpToEmail}
            className="text-xs px-3 py-1 rounded font-medium transition-all shrink-0"
            style={{ background: '#1e40af', color: 'white' }}
          >
            Go to Draft Email →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Draft Email ─────────────────────────────────────────
function DraftEmailTab({ narrative, mode, loading, onRegenerateEmail, regeneratingEmail }) {
  const [copied, setCopied] = useState(false)

  const extracted = useMemo(() => extractDraftEmail(narrative, mode), [narrative, mode])

  const handleCopy = async () => {
    if (!extracted) return
    try {
      await navigator.clipboard.writeText(extracted)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = extracted
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block w-8 h-8 rounded-full border-3 animate-spin mb-3" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', borderWidth: '3px' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Generating narrative…</p>
      </div>
    )
  }

  if (!narrative) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>
        <p className="text-sm">No narrative yet. Click ↻ Refresh on the Summary tab to generate.</p>
      </div>
    )
  }

  if (!extracted) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Draft email section not found in this narrative.
        </p>
        {onRegenerateEmail && (
          <button
            onClick={onRegenerateEmail}
            disabled={regeneratingEmail}
            className="text-sm px-4 py-2 rounded font-medium transition-all"
            style={{
              background: regeneratingEmail ? '#d1d5db' : 'var(--accent)',
              color: 'white',
              cursor: regeneratingEmail ? 'not-allowed' : 'pointer',
            }}
          >
            {regeneratingEmail ? '⏳ Generating…' : '✨ Generate Draft Email'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            {mode === 'vendor' ? 'Draft Follow-Up Email' : 'Draft Memo'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Ready to copy and send. Review before sending.
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="text-sm px-4 py-2 rounded font-medium transition-all hover:opacity-90 shrink-0"
          style={{ background: copied ? '#15803d' : 'var(--accent)', color: 'white' }}
        >
          {copied ? '✓ Copied' : '📋 Copy Email'}
        </button>
      </div>

      <div
        className="rounded-lg p-5"
        style={{ background: '#faf9f7', border: '1px solid var(--border)' }}
      >
        <pre
          className="text-sm whitespace-pre-wrap"
          style={{ fontFamily: 'Georgia, serif', lineHeight: '1.7', color: 'var(--ink)', margin: 0 }}
        >
          {extracted}
        </pre>
      </div>
    </div>
  )
}

// ── Tab 3: A/P Aging Report (vendor rollup or invoice detail) ──
function AgingReportTab({ clientName, asOfDate, parsedData, vendor, mode }) {
  const [copied, setCopied] = useState(false)

  const table = useMemo(() => {
    if (mode === 'vendor' && vendor) return buildVendorAgingTable(vendor)
    if (parsedData) return buildClientAgingTable(parsedData)
    return null
  }, [parsedData, vendor, mode])

  if (!table) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>
        <p className="text-sm">No data available.</p>
      </div>
    )
  }

  const handleCopy = async () => {
    const rows = tableToRowsArray(table)
    const ok = await copyTableAsTSV(rows)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleExportPDF = () => {
    exportTableAsPDF({
      clientName,
      asOfDate,
      table,
      mode,
      vendorName: vendor?.name,
    })
  }

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            {mode === 'vendor' ? 'Vendor Aging Detail' : 'A/P Aging Report'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {mode === 'vendor'
              ? `Invoice-level aging for ${vendor.name}`
              : `Vendor-level aging summary · As of ${asOfDate}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="text-sm px-3 py-1.5 rounded transition-all hover:opacity-90"
            style={{ background: copied ? '#15803d' : 'var(--ink)', color: 'var(--paper)', fontWeight: 500 }}
          >
            {copied ? '✓ Copied' : '📋 Copy for Excel'}
          </button>
          <button
            onClick={handleExportPDF}
            className="text-sm px-3 py-1.5 rounded transition-all hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'white', fontWeight: 500 }}
          >
            ⬇ Download PDF
          </button>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-xs">
            <thead style={{ background: 'var(--ink)' }}>
              <tr>
                {table.header.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2.5 font-semibold"
                    style={{
                      color: 'var(--paper)',
                      textAlign: i === 0 ? 'left' : 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    background: idx % 2 === 1 ? '#faf9f7' : 'white',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="px-3 py-2"
                      style={{
                        textAlign: cellIdx === 0 ? 'left' : 'right',
                        whiteSpace: 'nowrap',
                        color: 'var(--ink)',
                      }}
                    >
                      {cell || (cellIdx > 0 ? '—' : '')}
                    </td>
                  ))}
                </tr>
              ))}
              <tr style={{ background: '#f0ece6', borderTop: '2px solid var(--ink)' }}>
                {table.totals.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-3 py-2.5 font-bold"
                    style={{
                      textAlign: cellIdx === 0 ? 'left' : 'right',
                      whiteSpace: 'nowrap',
                      color: 'var(--ink)',
                    }}
                  >
                    {cell || ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {mode !== 'vendor' && (
        <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
          Showing {table.rows.length} vendor{table.rows.length !== 1 ? 's' : ''}. Click a vendor on the left to drill into invoice-level detail.
        </p>
      )}
    </div>
  )
}

// ── Tab 4 (client only): Input Data — raw CSV viewer with collapsible buckets ─
function InputDataTab({ clientName, asOfDate, rawCsv }) {
  // Track which buckets are expanded. Default to all expanded.
  const [expanded, setExpanded] = useState({})

  // Parse the raw CSV into displayable sections (bucket headers + rows)
  const sections = useMemo(() => parseRawCsvIntoSections(rawCsv), [rawCsv])

  // Initialize expanded state once when sections are first computed
  useMemo(() => {
    if (sections.buckets.length > 0 && Object.keys(expanded).length === 0) {
      const initial = {}
      sections.buckets.forEach((_, idx) => { initial[idx] = true })
      setExpanded(initial)
    }
  }, [sections])

  if (!rawCsv) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>
        <p className="text-sm">No input data available. This report may have been uploaded before raw CSV preservation was added — re-upload the CSV to make it visible here.</p>
      </div>
    )
  }

  const toggleBucket = (idx) => {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const expandAll = () => {
    const next = {}
    sections.buckets.forEach((_, idx) => { next[idx] = true })
    setExpanded(next)
  }

  const collapseAll = () => {
    const next = {}
    sections.buckets.forEach((_, idx) => { next[idx] = false })
    setExpanded(next)
  }

  const handleDownload = () => {
    const blob = new Blob([rawCsv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeFilename = (s) => String(s || 'report').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80)
    a.download = `${safeFilename(clientName)}-AP-Aging-Detail-${safeFilename(asOfDate)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Input Data — Original CSV
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Exactly as uploaded · As of {asOfDate}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={expandAll}
            className="text-xs px-2.5 py-1 rounded transition-all"
            style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="text-xs px-2.5 py-1 rounded transition-all"
            style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            Collapse all
          </button>
          <button
            onClick={handleDownload}
            className="text-sm px-3 py-1.5 rounded transition-all hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'white', fontWeight: 500 }}
          >
            ⬇ Download CSV
          </button>
        </div>
      </div>

      {/* Report header (client name, title, as-of date) */}
      {sections.header.length > 0 && (
        <div className="mb-3 px-4 py-3 rounded-lg" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
          {sections.header.map((line, idx) => (
            <p key={idx} className={idx === 0 ? 'text-base font-bold' : 'text-xs mt-0.5'} style={{ fontFamily: idx === 0 ? 'Playfair Display, serif' : undefined }}>
              {line}
            </p>
          ))}
        </div>
      )}

      {/* Column headers — sticky across buckets */}
      {sections.columnHeaders.length > 0 && (
        <div className="rounded-t-lg overflow-hidden" style={{ background: 'var(--ink)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: '1000px' }}>
              <thead>
                <tr>
                  {sections.columnHeaders.map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 font-semibold"
                      style={{
                        color: 'var(--paper)',
                        textAlign: i >= sections.columnHeaders.length - 2 ? 'right' : 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
        </div>
      )}

      {/* Buckets */}
      <div className="rounded-b-lg overflow-hidden" style={{ border: '1px solid var(--border)', borderTop: 'none' }}>
        {sections.buckets.map((bucket, bIdx) => {
          const isOpen = !!expanded[bIdx]
          return (
            <div key={bIdx} style={{ borderBottom: bIdx < sections.buckets.length - 1 ? '1px solid var(--border)' : 'none' }}>
              {/* Bucket header — clickable; shows total when collapsed */}
              <button
                onClick={() => toggleBucket(bIdx)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left transition-all"
                style={{ background: '#f0ece6', color: 'var(--ink)', fontWeight: 600 }}
              >
                <span className="text-sm flex items-center gap-2">
                  <span style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block', fontSize: '0.7em' }}>▶</span>
                  {bucket.title}
                </span>
                <span className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>{bucket.rows.length} row{bucket.rows.length !== 1 ? 's' : ''}</span>
                  {bucket.total && bucket.total.length > 1 && (
                    <>
                      <span style={{ color: 'var(--muted)' }}>·</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 700 }}>
                        Open: {bucket.total[bucket.total.length - 1] || '—'}
                      </span>
                    </>
                  )}
                </span>
              </button>

              {/* Bucket rows */}
              {isOpen && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="w-full text-xs" style={{ minWidth: '1000px' }}>
                    <tbody>
                      {bucket.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          style={{
                            background: rIdx % 2 === 1 ? '#faf9f7' : 'white',
                            borderTop: rIdx === 0 ? '1px solid var(--border)' : 'none',
                          }}
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3 py-1.5"
                              style={{
                                textAlign: cIdx >= row.length - 2 ? 'right' : 'left',
                                whiteSpace: 'nowrap',
                                color: 'var(--ink)',
                              }}
                            >
                              {cell || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {bucket.total && (
                        <tr style={{ background: '#f0ece6', borderTop: '2px solid var(--ink)' }}>
                          {bucket.total.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3 py-2 font-bold"
                              style={{
                                textAlign: cIdx >= bucket.total.length - 2 ? 'right' : 'left',
                                whiteSpace: 'nowrap',
                                color: 'var(--ink)',
                              }}
                            >
                              {cell || ''}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Grand total */}
      {sections.grandTotal && (
        <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '2px solid var(--ink)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-xs" style={{ minWidth: '1000px' }}>
              <tbody>
                <tr style={{ background: 'var(--ink)' }}>
                  {sections.grandTotal.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-3 py-2.5 font-bold"
                      style={{
                        textAlign: cIdx >= sections.grandTotal.length - 2 ? 'right' : 'left',
                        whiteSpace: 'nowrap',
                        color: 'var(--paper)',
                      }}
                    >
                      {cell || ''}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Parse a CSV row into fields, respecting quoted fields with commas/quotes
function splitCsvLine(line) {
  const fields = []
  let current = ''
  let insideQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (insideQuotes) {
      if (ch === '"') {
        // Check for escaped quote
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          insideQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        insideQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

// Parse the raw CSV into structured sections for collapsible display.
// Returns: { header: string[], columnHeaders: string[], buckets: [{title, rows[][], total[]}], grandTotal[] }
function parseRawCsvIntoSections(rawCsv) {
  const result = { header: [], columnHeaders: [], buckets: [], grandTotal: null }
  if (!rawCsv) return result

  const lines = rawCsv.split(/\r?\n/)
  let currentBucket = null
  let foundColumnHeaders = false
  let inHeaderSection = true

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue
    const fields = splitCsvLine(rawLine)
    const firstField = (fields[0] || '').trim()
    const secondField = (fields[1] || '').trim()

    // Skip footer timestamp lines
    if (/^[A-Z][a-z]+,?\s+[A-Z][a-z]+\s+\d+,/.test(rawLine.trim())) continue
    if (/GMT/.test(firstField)) continue

    // Detect column headers row (the row containing "Date" in second column)
    if (!foundColumnHeaders && secondField.toLowerCase() === 'date') {
      result.columnHeaders = fields.slice(1).map(f => f.trim()).filter(f => f)
      foundColumnHeaders = true
      inHeaderSection = false
      continue
    }

    // While in the header section, collect non-empty rows for the report title block
    if (inHeaderSection) {
      // Use first non-empty field
      const headerText = fields.find(f => f && f.trim())
      if (headerText) result.header.push(headerText.trim())
      continue
    }

    // Detect grand total row
    if (firstField.toUpperCase() === 'TOTAL') {
      result.grandTotal = fields.map(f => f.trim())
      continue
    }

    // Detect bucket total row
    if (firstField.toLowerCase().startsWith('total for ')) {
      if (currentBucket) {
        currentBucket.total = fields.map(f => f.trim())
      }
      continue
    }

    // Detect bucket header row — first field has content, no values in the data columns
    if (firstField && !secondField) {
      // Start a new bucket
      currentBucket = { title: firstField, rows: [], total: null }
      result.buckets.push(currentBucket)
      continue
    }

    // Otherwise it's an invoice/data row (first field empty, second field is the date)
    if (currentBucket && !firstField && secondField) {
      // Strip the leading empty column when displaying
      currentBucket.rows.push(fields.slice(1).map(f => f.trim()))
    }
  }

  return result
}

// ── Main NarrativePanel ────────────────────────────────────────
export default function NarrativePanel({
  clientName,
  asOfDate,
  vendor,
  aggregate,
  parsedData,
  rawCsv,
  narrative,
  loading,
  onRefresh,
  onExportPDF,
  onExportWord,
  exportPreparing,
  exportProgress,
  vendorProfile,
  onEditVendorProfile,
  onRegenerateDraftEmail,
  regeneratingEmail,
}) {
  const [activeTab, setActiveTab] = useState(TAB_SUMMARY)
  const isVendorView = !!vendor
  const mode = isVendorView ? 'vendor' : 'client'

  const hasEmail = narrative ? hasDraftEmail(narrative, mode) : false

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'white' }}>

      {/* Export preparation banner */}
      {exportPreparing && (
        <div
          className="px-6 py-3 flex items-center gap-4"
          style={{ background: 'linear-gradient(90deg, #c8401a, #ea580c)', color: 'white', position: 'sticky', top: 0, zIndex: 100 }}
        >
          <div className="w-5 h-5 rounded-full border-2 animate-spin shrink-0" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Preparing export — please don't navigate away</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Generating vendor narratives ({exportProgress?.done || 0} of {exportProgress?.total || 0})
            </p>
          </div>
          <div className="w-32 h-2 rounded-full overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.25)' }}>
            <div
              className="h-full transition-all"
              style={{
                background: 'white',
                width: exportProgress?.total > 0 ? `${(exportProgress.done / exportProgress.total) * 100}%` : '0%',
              }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--ink)' }}>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: 'var(--accent)' }}>
            {isVendorView ? 'Vendor Analysis' : 'Client Narrative'}
          </p>
          <h2 className="text-lg font-bold leading-tight truncate" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
            {isVendorView ? vendor.name : clientName}
          </h2>
          {!isVendorView && (
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              As of {asOfDate} · ${aggregate?.totalAP?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total A/P
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onRefresh && (
            <ActionButton onClick={onRefresh} label="↻ Refresh" variant="subtle" onDark title="Regenerate narrative" />
          )}
          {onExportPDF && (
            <ActionButton onClick={onExportPDF} label={exportPreparing ? '⏳ Preparing…' : '⬇ PDF'} variant="primary" disabled={exportPreparing} />
          )}
          {onExportWord && (
            <ActionButton onClick={onExportWord} label={exportPreparing ? '⏳ Preparing…' : '⬇ Word'} variant="primary" disabled={exportPreparing} />
          )}
        </div>
      </div>

      {/* Vendor Profile Strip (only when a vendor is selected) */}
      {isVendorView && (
        <VendorProfileStrip
          vendorName={vendor.name}
          profile={vendorProfile}
          onEdit={onEditVendorProfile}
        />
      )}

      {/* Tab pills */}
      <div className="px-6 py-3 flex items-center gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--border)', background: 'white' }}>
        <PillTab label="Summary" active={activeTab === TAB_SUMMARY} onClick={() => setActiveTab(TAB_SUMMARY)} />
        <PillTab label="Draft Email" active={activeTab === TAB_EMAIL} onClick={() => setActiveTab(TAB_EMAIL)} badge={hasEmail ? '✓' : null} />
        <PillTab label="A/P Aging Report" active={activeTab === TAB_REPORT} onClick={() => setActiveTab(TAB_REPORT)} />
        {!isVendorView && (
          <PillTab label="Input Data" active={activeTab === TAB_INPUT} onClick={() => setActiveTab(TAB_INPUT)} />
        )}
      </div>

      {/* Tab content */}
      <div style={{ minHeight: '300px' }}>
        {activeTab === TAB_SUMMARY && (
          <SummaryTab
            narrative={narrative}
            loading={loading}
            mode={mode}
            hasDraft={hasEmail}
            onJumpToEmail={() => setActiveTab(TAB_EMAIL)}
          />
        )}
        {activeTab === TAB_EMAIL && (
          <DraftEmailTab
            narrative={narrative}
            mode={mode}
            loading={loading}
            onRegenerateEmail={onRegenerateDraftEmail}
            regeneratingEmail={regeneratingEmail}
          />
        )}
        {activeTab === TAB_REPORT && (
          <AgingReportTab
            clientName={clientName}
            asOfDate={asOfDate}
            parsedData={parsedData}
            vendor={vendor}
            mode={mode}
          />
        )}
        {activeTab === TAB_INPUT && !isVendorView && (
          <InputDataTab
            clientName={clientName}
            asOfDate={asOfDate}
            rawCsv={rawCsv}
          />
        )}
      </div>
    </div>
  )
}