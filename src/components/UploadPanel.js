import { useState, useRef } from 'react'
import Papa from 'papaparse'

function parseAgingCSV(csvText) {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  const rows = result.data

  return rows.map((row) => {
    const get = (keys) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase().includes(k.toLowerCase()))
        if (found) return parseFloat(String(row[found]).replace(/[$,]/g, '')) || 0
      }
      return 0
    }

    const name = row['Client Name'] || row['Customer'] || row['Name'] || Object.values(row)[0] || 'Unknown'
    const current   = get(['current'])
    const days1_30  = get(['1-30', '1 - 30', '1–30'])
    const days31_60 = get(['31-60', '31 - 60', '31–60'])
    const days61_90 = get(['61-90', '61 - 90', '61–90'])
    const over90    = get(['over 90', '90+', '>90', '91'])
    const totalAR   = get(['total']) || current + days1_30 + days31_60 + days61_90 + over90

    const overdueTotal = days1_30 + days31_60 + days61_90 + over90
    const urgencyScore = (over90 * 4) + (days61_90 * 3) + (days31_60 * 2) + (days1_30 * 1)

    let status = 'ok'
    if (over90 > 0 || days61_90 > 0) status = 'critical'
    else if (days31_60 > 0 || days1_30 > totalAR * 0.3) status = 'warning'

    return { name, currency: 'USD', aging: { current, days1_30, days31_60, days61_90, over90, totalAR, overdueTotal }, urgencyScore, status }
  }).filter(c => c.aging.totalAR > 0)
   .sort((a, b) => b.urgencyScore - a.urgencyScore)
}

export default function UploadPanel({ onDataLoaded }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const clients = parseAgingCSV(e.target.result)
        if (clients.length === 0) {
          setError('No valid client data found. Please check your CSV format.')
          return
        }
        onDataLoaded(clients)
      } catch (err) {
        setError('Failed to parse CSV. Please use a QBO AR Aging Summary export.')
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="max-w-2xl mx-auto mt-16">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
          Upload Your Aging Report
        </h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Export the AR Aging Summary from QuickBooks Online as CSV and upload it here.
          The AI will triage your portfolio and generate action narratives for each client.
        </p>
      </div>

      <div
        onClick={() => fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="cursor-pointer rounded-xl p-12 text-center transition-all"
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          background: dragging ? '#c8401a08' : 'white',
        }}
      >
        <div className="text-4xl mb-4">📂</div>
        <p className="font-medium mb-1">Drop your QBO CSV here</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>or click to browse files</p>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: '#c8401a15', color: 'var(--danger)', border: '1px solid #c8401a40' }}>
          {error}
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Don't have a CSV yet? Try with sample data:</p>
        <button
          onClick={() => onDataLoaded(getSampleData())}
          className="text-sm px-4 py-2 rounded-lg transition-all hover:opacity-80"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          Load Sample Portfolio
        </button>
      </div>

      <div className="mt-8 p-4 rounded-lg text-xs" style={{ background: '#f0ece6', border: '1px solid var(--border)' }}>
        <p className="font-semibold mb-2">Expected CSV columns (QBO AR Aging Summary):</p>
        <code style={{ color: 'var(--muted)' }}>Client Name, Current, 1-30, 31-60, 61-90, Over 90, Total</code>
      </div>
    </div>
  )
}

function getSampleData() {
  return [
    { name: 'Maple Street Diner LLC', currency: 'USD', aging: { current: 4200, days1_30: 1800, days31_60: 3200, days61_90: 0, over90: 5400, totalAR: 14600, overdueTotal: 10400 }, urgencyScore: 28600, status: 'critical' },
    { name: 'BlueLine Construction Inc.', currency: 'USD', aging: { current: 12000, days1_30: 8500, days31_60: 4200, days61_90: 6100, over90: 0, totalAR: 30800, overdueTotal: 18800 }, urgencyScore: 29900, status: 'critical' },
    { name: 'Sunrise Pediatrics PLLC', currency: 'USD', aging: { current: 9800, days1_30: 2100, days31_60: 0, days61_90: 0, over90: 0, totalAR: 11900, overdueTotal: 2100 }, urgencyScore: 2100, status: 'ok' },
    { name: 'Harbor Tech Solutions', currency: 'USD', aging: { current: 22000, days1_30: 7400, days31_60: 3100, days61_90: 0, over90: 0, totalAR: 32500, overdueTotal: 10500 }, urgencyScore: 13800, status: 'warning' },
    { name: 'Green Valley Farms', currency: 'USD', aging: { current: 5600, days1_30: 0, days31_60: 0, days61_90: 0, over90: 2200, totalAR: 7800, overdueTotal: 2200 }, urgencyScore: 8800, status: 'critical' },
  ].sort((a, b) => b.urgencyScore - a.urgencyScore)
}
