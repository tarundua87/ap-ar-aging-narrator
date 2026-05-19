# AR/AP Aging Narrator

> AI-powered aging narrative library for outsourced accounting firms serving US clients.

## What It Does

Outsourced bookkeeping firms managing 20–80 US SMB clients on QuickBooks Online face a daily challenge: turning raw A/P aging reports into clear, actionable communication for their clients. This tool solves that — and saves every report so they're never lost.

**Upload → Auto-narrate → Save → Export → Send.**

1. Export your A/P Aging Detail Report from QBO as CSV
2. Upload it — client name, as-of date, vendors, and invoices auto-detected
3. AI generates a client-level narrative instantly
4. Click any vendor for a drill-down narrative (cached forever after first generation)
5. Export the full report as PDF or Word
6. Send to your US client — done

## Key Features

### Persistent Client Library
- Multi-client dashboard with cards for each stored client
- Period history per client — keep May, June, July reports for the same client
- Reports persist across browser sessions (localStorage)

### AI Narrative Engine
- Client-level narratives auto-generate on upload
- Vendor narratives generate on first click, then cached forever
- Refresh button to manually regenerate any narrative
- Powered by Anthropic Claude (claude-sonnet-4-5)

### Professional Outputs
- **PDF Export** — cover page, executive summary, client narrative, top oldest invoices, vendor drill-downs
- **Word Export** — same structure, fully editable for the team to customize before sending

### Smart Parsing
- Handles QBO A/P Aging Detail Report CSV directly — no cleanup required
- Auto-detects client name and as-of date
- Three-level data model: Client → Vendor → Invoice
- Identifies supplier credits and concentration risk

## Tech Stack

- Next.js 14
- Tailwind CSS
- Anthropic Claude API
- PapaParse (CSV parsing)
- jsPDF + jspdf-autotable (PDF export)
- docx (Word export)
- Browser localStorage (persistence)

## Getting Started

### Prerequisites
- Node.js 18+
- Anthropic API key ([get one here](https://console.anthropic.com))

### Setup

```bash
git clone https://github.com/tarundua87/ap-ar-aging-narrator.git
cd ap-ar-aging-narrator
npm install
cp .env.local.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Usage

1. Click **"+ Upload your first CSV"**
2. Drop your QBO A/P Aging Detail Report CSV
3. Wait ~10 seconds for the client narrative to generate
4. Click any vendor in the triage queue to drill down
5. Click **⬇ PDF** or **⬇ Word** to export the full report

## Project Background

Built as a PM portfolio project by a Chartered Accountant with deep domain expertise in outsourced accounting operations. The product evolved across three versions in three days — from a single-session triage tool (v1.0) to a detailed AP analyzer (v1.5) to a full persistent library with professional exports (v2.0) — demonstrating iterative product thinking based on user feedback.

## Roadmap

### v3.0 (Planned — Jul–Aug 2026)
- AR aging support
- Multi-period trend analysis
- QBO OAuth live integration
- Xero support

### v4.0 (Future — Q4 2026)
- Cloud sync (multi-device)
- Multi-user team accounts
- Multi-jurisdiction (CA, UK, IL)
- Client-facing portal

## Documentation

See [PROJECT.md](./PROJECT.md) for detailed architecture, data model, and project context.

## License

MIT