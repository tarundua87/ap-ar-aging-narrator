import { useState, useEffect } from 'react'
import { countUrgentItems, countActiveItems } from '../lib/actionItems'

export default function Header({ onOpenSettings, onOpenAllActionItems }) {
  const [tick, setTick] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Mark as mounted once we're on the client (after hydration)
  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  // Only compute counts once mounted (avoids SSR/client mismatch since localStorage is client-only)
  const urgentCount = mounted ? countUrgentItems(null) : 0
  const activeCount = mounted ? countActiveItems(null) : 0

  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--ink)' }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
            AR/AP Aging Narrator
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
            AI-powered aging narratives
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Notification bell */}
          {onOpenAllActionItems && (
            <button
              onClick={onOpenAllActionItems}
              title={
                urgentCount > 0
                  ? `${urgentCount} urgent action item${urgentCount !== 1 ? 's' : ''}`
                  : activeCount > 0
                  ? `${activeCount} active action item${activeCount !== 1 ? 's' : ''}`
                  : 'View action items'
              }
              className="relative transition-all hover:opacity-90"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#d1d5db',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '1.05em' }}>🔔</span>
              <span>Action Items</span>
              {urgentCount > 0 ? (
                <span
                  className="rounded-full"
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    fontSize: '0.7rem',
                    padding: '1px 7px',
                    minWidth: '20px',
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                >
                  {urgentCount}
                </span>
              ) : activeCount > 0 ? (
                <span
                  className="rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.18)',
                    color: '#d1d5db',
                    fontSize: '0.7rem',
                    padding: '1px 7px',
                    minWidth: '20px',
                    textAlign: 'center',
                    fontWeight: 600,
                  }}
                >
                  {activeCount}
                </span>
              ) : null}
            </button>
          )}

          {/* Settings */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Settings"
              className="transition-all hover:opacity-90"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#d1d5db',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '1.05em' }}>⚙</span>
              <span>Settings</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}