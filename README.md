# AR/AP Aging Narrator

> AI-powered aging narrative engine for outsourced accounting firms serving US clients.

## What It Does

Outsourced bookkeeping firms managing 20–80 US SMB clients on QuickBooks Online face a daily challenge: turning raw AR aging reports into clear, actionable communication for their clients. This tool solves that.

**Upload → Triage → Narrate → Send.**

1. Export your AR Aging Summary from QBO as CSV
2. Upload it — the app instantly triages your entire portfolio by urgency
3. Click any client to generate a professional AI narrative
4. Copy the ready-to-send email draft directly to your client

## Key Features

- **Portfolio Triage Dashboard** — all clients ranked by urgency score (weighted aging formula)
- **AI Narrative Engine** — powered by Claude, generates structured narratives in US business English
- **Aging Visualization** — color-coded aging bar per client
- **Draft Email Output** — professional follow-up email ready to send to overdue customers
- **Sample Data** — demo the app without a QBO export

## Tech Stack

- Next.js 14
- Tailwind CSS
- Anthropic Claude API
- PapaParse (CSV parsing)
- Vercel (deployment)

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

### CSV Format

Export **AR Aging Summary** from QBO. Expected columns:

| Client Name | Current | 1-30 | 31-60 | 61-90 | Over 90 | Total |
|-------------|---------|------|-------|-------|---------|-------|

## Project Background

Built as a PM portfolio project by a Chartered Accountant with deep domain expertise in outsourced accounting operations. Designed to address a real gap in the tooling available to offshore accounting teams serving US clients.

## Roadmap

- [ ] AP Aging support
- [ ] Multi-period trend analysis
- [ ] QBO OAuth live integration
- [ ] Xero integration
- [ ] Escalation memo generator
- [ ] Team roles (Team Lead / Bookkeeper)

## License

MIT
