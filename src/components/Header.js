export default function Header() {
  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--ink)' }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--paper)', fontFamily: 'Playfair Display, serif' }}>
            AR/AP Aging Narrator
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
            AI-powered aging narratives for US client portfolios
          </p>
        </div>
        <div className="text-xs px-3 py-1 rounded-full" style={{ background: '#1a7a4a22', color: '#4ade80', border: '1px solid #1a7a4a' }}>
          QBO · US Clients
        </div>
      </div>
    </header>
  )
}
