# AP Aging Narrator — Project Context

## What This Is
An AI-powered web application that converts QuickBooks Online A/P Aging Detail Reports into structured, board-ready narrative reports. Designed for outsourced bookkeeping firms in India serving US SMB clients, the app maintains a persistent library of all client reports across periods, generates AI narratives at both client and vendor levels, and produces professional PDF and Word deliverables.

## Product Owner
Tarun Dua — Chartered Accountant. Non-technical. Dual purpose: (1) internal deployment in current org, (2) PM portfolio showcase project.

## GitHub
https://github.com/tarundua87/ap-ar-aging-narrator

## Current Version: v2.0 (May 19, 2026)

## Tech Stack
- **Framework:** Next.js 14 (React, file-based routing)
- **Styling:** Tailwind CSS + custom CSS variables (Playfair Display + DM Sans typography)
- **AI:** Anthropic Claude API (claude-sonnet-4-5)
- **CSV Parsing:** PapaParse
- **PDF Export:** jsPDF + jspdf-autotable
- **Word Export:** docx
- **Persistence:** Browser localStorage
- **Deployment Target:** Vercel (free tier)

## Version History

### v1.0 — Initial Release (May 17, 2026)
- CSV upload (QBO AR Aging Summary format)
- Single-session portfolio triage
- AI narrative generation per client
- Copy to clipboard

### v1.5 — Detailed AP Support (May 18, 2026)
- Switched to QBO A/P Aging Detail Report ingestion
- Auto-detect client name from CSV
- Three-level data model: Client → Vendor → Invoice
- Client + vendor narrative modes
- Top oldest invoices view
- Invoice-level recommendations from AI

### v2.0 — Library + Exports (May 19, 2026)
- Persistent client library using localStorage
- Multi-period history per client
- Hybrid narrative generation (client immediate, vendor on-demand, both cached)
- Refresh button to manually regenerate narratives
- PDF export with cover page, executive summary, vendor drill-downs
- Word export with same structure
- As-of date detection and display

## Data Model