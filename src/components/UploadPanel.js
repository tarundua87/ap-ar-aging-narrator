import { useState, useRef } from 'react'
import { parseAPAgingDetail } from '../lib/parseAPAging'

// Normalize a client name for comparison
function normalizeName(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export default function UploadPanel({ onDataLoaded, onCancel, expectedClient }) {
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

        // If scoped to a specific client, validate the name matches
        if (expectedClient) {
          const uploadedName = normalizeName(result.clientName)
          const expected = normalizeName(expectedClient)
          if (uploadedName !== expected) {
            setError(
              `This CSV is for "${result.clientName}", but you're uploading to "${expectedClient}". ` +
              `To upload a different client, go back to the Library and use "+ New Upload".`
            )
            setLoading(false)
            return
          }
        }

        onDataLoaded(result)
      } catch (err) {
        console.error(err)
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
      {onCancel && (
        <button onClick={onCancel} className="text-xs mb-4 flex items-center gap-1.5 transition-all hover:opacity-80" style={{ color: 'var(--muted)' }}>
          ← {expectedClient ? `Back to ${expectedClient}` : 'Back to Library'}
        </button>
      )}

      <div className="text-center mb-10">
        {expectedClient && (
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>
            Upload New Period
          </p>
        )}
        <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
          {expectedClient ? `Add a New Period for ${expectedClient}` : 'Upload A/P Aging Detail'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {expectedClient
            ? `Export the latest A/P Aging Detail Report for ${expectedClient} from QuickBooks Online. The system will verify the CSV matches this client.`
            : 'Export the A/P Aging Detail Report from QuickBooks Online as CSV. The client name and as-of date will be detected automatically.'}
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
          <li>Set your aging buckets (default 30/60/90 works)</li>
          <li>Click <strong>Export</strong> → <strong>Export to CSV</strong></li>
          <li>Upload the CSV directly — no cleanup needed</li>
        </ol>
      </div>
    </div>
  )
}