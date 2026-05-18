import { useState, useRef } from 'react'
import { parseAPAgingDetail } from '../lib/parseAPAging'

export default function UploadPanel({ onDataLoaded }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    setError(null)
    setLoading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const result = parseAPAgingDetail(e.target.result)
        if (result.vendors.length === 0) {
          setError('No vendor data found. Please ensure this is a QBO A/P Aging Detail Report CSV.')
          setLoading(false)
          return
        }
        onDataLoaded(result)
      } catch (err) {
        setError('Failed to parse CSV. Please ensure it is a QBO A/P Aging Detail Report export.')
        setLoading(false)
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
          Upload A/P Aging Detail
        </h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Export the <strong>A/P Aging Detail Report</strong> from QuickBooks Online as CSV.
          The client name and all vendor data will be detected automatically — no cleanup required.
        </p>
      </div>

      <div
        onClick={() => !loading && fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`${loading ? '' : 'cursor-pointer'} rounded-xl p-12 text-center transition-all`}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          background: dragging ? '#c8401a08' : 'white',
          opacity: loading ? 0.6 : 1,
        }}
      >
        <div className="text-4xl mb-4">{loading ? '⏳' : '📂'}</div>
        <p className="font-medium mb-1">
          {loading ? 'Parsing CSV…' : 'Drop your QBO A/P Aging Detail CSV here'}
        </p>
        {!loading && <p className="text-sm" style={{ color: 'var(--muted)' }}>or click to browse files</p>}
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: '#c8401a15', color: 'var(--danger)', border: '1px solid #c8401a40' }}>
          {error}
        </div>
      )}

      <div className="mt-8 p-4 rounded-lg text-xs" style={{ background: '#f0ece6', border: '1px solid var(--border)' }}>
        <p className="font-semibold mb-2">How to export from QBO:</p>
        <ol className="space-y-1 ml-4" style={{ listStyle: 'decimal' }}>
          <li>Go to <strong>Reports</strong> → search <strong>"A/P Aging Detail"</strong></li>
          <li>Click <strong>Export</strong> → <strong>Export to CSV</strong></li>
          <li>Upload the CSV directly — no cleanup needed</li>
        </ol>
      </div>
    </div>
  )
}