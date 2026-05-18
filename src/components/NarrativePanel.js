import { useState } from 'react'

const BUCKET_LABELS = [
  { key: 'current',   label: 'Current',      color: '#1a7a4a' },
  { key: 'days1_30',  label: '1–30 Days',    color: '#b87d00' },
  { key: 'days31_60', label: '31–60 Days',   color: '#d97706' },
  { key: 'days61_90', label: '61–90 Days',   color: '#ea580c' },
  { key: 'over90',    label: 'Over 90 Days', color: '#c8401a' },
]

function AgingBar({ aging }) {
  const total = aging.totalAR || 1
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-3 mb-2">
        {BUCKET_LABELS.map(b => {
          const pct = (aging[b.key] / total) * 100
          return pct > 0 ? (
            <div key={b.key} style={{ width: `${pct}%`, background: b.color }} title={`${b.label}: $${aging[b.key].toLocaleString()}`} />
          ) : null
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {BUCKET_LABELS.map(b => aging[b.key] > 0 && (
          <div key={b.key} className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: b.color }} />
            <span style={{ color: '#9ca3af' }}>{b.label}:</span>
            <span className="font-medium" style={{ color: 'var(--paper)' }}>${aging[b.key].toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NarrativeText({ text }) {
  const sections = ['ASSESSMENT', 'KEY CONCERNS', 'RECOMMENDED ACTIONS', 'DRAFT FOLLOW-UP EMAIL']
  let remaining = text
  const parts = []

  sections.forEach((section) => {
    const idx = remaining.toUpperCase().indexOf(section)
    if (idx === -1) return
    if (idx > 0) parts.push({ type: 'text', content: remaining.slice(0, idx) })
    const nextIdx = sections.map(s => {
      const i = remaining.toUpperCase().indexOf(s, idx + section.length)
      return i === -1 ? Infinity : i
    }).filter(i => i > idx).reduce((a, b) => Math.min(a, b), Infinity)
    parts.push({ type: 'section', label: section, content: remaining.slice(idx + section.length, nextIdx === Infinity ? undefined : nextIdx).replace(/^[:\s]+/, '') })
    remaining = nextIdx === Infinity ? '' : remaining.slice(nextIdx)
  })
  if (remaining.trim()) parts.push({ type: 'text', content: remaining })

  if (parts.length === 0) return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>

  return (
    <div className="space-y-4">
      {parts.map((part, i) => part.type === 'section' ? (
        <div key={i}>
          <h4 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>{part.label}</h4>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink)' }} dangerouslySetInnerHTML={{ __html: part.content.trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
        </div>
      ) : (
        <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">{part.content.trim()}</p>
      ))}
    </div>
  )
}

export default function NarrativePanel({ client, narrative, loading }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(narrative || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!client) {
    return (
      <div className="rounded-xl flex items-center justify-center" style={{ border: '1px dashed var(--border)', background: 'white', minHeight: '400px' }}>
        <div className="text-center" style={{ color: 'var(--muted)' }}>
          <div className="text-4xl mb-3">←</div>
          <p className="text-sm">Select a client from the triage queue</p>
          <p className="text-xs mt-1">to generate an AI narrative</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'white' }}>
      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--ink)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
              {client.name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              Total AR: ${client.aging.totalAR.toLocaleString()} · Overdue: ${client.aging.overdueTotal.toLocaleString()}
            </p>
          </div>
          {narrative && (
            <button onClick={handleCopy} className="text-xs px-3 py-1.5 rounded-lg transition-all" style={{ background: copied ? '#1a7a4a' : '#374151', color: 'white' }}>
              {copied ? '✓ Copied' : 'Copy Narrative'}
            </button>
          )}
        </div>
        <div className="mt-4">
          <AgingBar aging={client.aging} />
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--muted)' }}>
            <div className="w-8 h-8 rounded-full border-2 animate-spin mb-4" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <p className="text-sm">Generating narrative…</p>
            <p className="text-xs mt-1">Analyzing aging buckets and drafting recommendations</p>
          </div>
        ) : narrative ? (
          <NarrativeText text={narrative} />
        ) : (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
            Narrative will appear here once generated.
          </p>
        )}
      </div>
    </div>
  )
}
