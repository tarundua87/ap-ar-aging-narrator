export default function Header({ onOpenSettings }) {
  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--ink)' }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
            AR/AP Aging Narrator
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
            AI-powered aging narratives
          </p>
        </div>

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
    </header>
  )
}