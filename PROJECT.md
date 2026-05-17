# AP/AR Aging Narrator — Project Context

## What This Is
An AI-powered web application for outsourced bookkeeping firms (based in India) that serve US SMB clients via QuickBooks Online. The app ingests AR aging data, triages a client portfolio by urgency, and generates professional action narratives + email drafts for each client.

## Product Owner
Tarun Dua — Chartered Accountant. Non-technical. Dual purpose: (1) internal deployment in current org, (2) PM portfolio showcase project.

## GitHub
https://github.com/tarundua87/ap-ar-aging-narrator

## Tech Stack
- **Framework:** Next.js 14 (React, file-based routing)
- **Styling:** Tailwind CSS + custom CSS variables
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **CSV Parsing:** PapaParse
- **Deployment Target:** Vercel (free tier)

## Current Build Status
**Phase 1 MVP — In Progress**

### Completed
- [x] Project scaffold (Next.js + Tailwind)
- [x] CSV upload + QBO aging data parser
- [x] Portfolio triage queue (sorted by urgency score)
- [x] AI narrative generation via Claude API
- [x] Narrative panel with aging bar visualization
- [x] Sample data for demo without QBO export
- [x] Copy narrative to clipboard

### Next Up (Phase 1 remaining)
- [ ] Anthropic API key setup and test
- [ ] QA pass by product owner
- [ ] Bug fixes from QA
- [ ] Export narrative as PDF or Word doc

### Phase 2 (Planned)
- [ ] AP Aging support (not just AR)
- [ ] Multi-period trend comparison
- [ ] Escalation memo template
- [ ] Team lead / bookkeeper role separation
- [ ] Client notes / history per client

### Phase 3 (Planned)
- [ ] QBO OAuth live integration (auto-pull aging data)
- [ ] Xero integration

## Data Flow
1. User exports AR Aging Summary CSV from QBO
2. Uploads CSV to the app
3. App parses CSV → builds client portfolio
4. Urgency score calculated per client (weighted by aging bucket)
5. Triage queue displayed, sorted by urgency
6. User clicks client → POST to /api/generate-narrative
7. API calls Claude with structured prompt
8. Narrative rendered in panel with sections: Assessment, Key Concerns, Recommended Actions, Draft Follow-Up Email

## Urgency Score Formula
urgencyScore = (over90 × 4) + (days61_90 × 3) + (days31_60 × 2) + (days1_30 × 1)

## Status Classification
- **Critical:** over90 > 0 OR days61_90 > 0
- **Warning:** days31_60 > 0 OR days1_30 > 30% of totalAR
- **OK:** everything else

## Narrative Prompt Design
Prompt instructs Claude to act as an expert accounting advisor, output in US business English, structured in 4 sections:
1. ASSESSMENT — one-sentence health summary
2. KEY CONCERNS — most urgent aging buckets
3. RECOMMENDED ACTIONS — 2-3 prioritized actions
4. DRAFT FOLLOW-UP EMAIL — ready-to-send email to overdue customer

## Environment Variables Required
- ANTHROPIC_API_KEY — from console.anthropic.com

## Key Files
- src/pages/index.js — main dashboard
- src/pages/api/generate-narrative.js — AI API route
- src/components/UploadPanel.js — CSV upload + parsing
- src/components/TriageQueue.js — portfolio sidebar
- src/components/NarrativePanel.js — narrative display
- src/components/Header.js — app header
