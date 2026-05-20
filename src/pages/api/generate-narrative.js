export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { mode, clientName, vendors, aggregate, vendor, vendorProfiles, invoiceOverrides } = req.body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  const prompt = mode === 'vendor'
    ? buildVendorPrompt(clientName, vendor, vendorProfiles, invoiceOverrides)
    : buildClientPrompt(clientName, vendors, aggregate, vendorProfiles, invoiceOverrides)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    if (data.type === 'error') {
      return res.status(500).json({ error: data.error?.message || 'API error', narrative: 'AI error: ' + (data.error?.message || 'unknown') })
    }
    const narrative = data.content?.[0]?.text || 'No narrative generated.'
    return res.status(200).json({ narrative })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate narrative', detail: err.message })
  }
}

function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Build a compact profile summary string for a vendor
function summarizeVendorProfile(profile) {
  if (!profile) return null
  const parts = []
  if (profile.paymentMethod && profile.paymentMethod !== 'Manual') {
    parts.push(`Payment: ${profile.paymentMethod}`)
  }
  if (profile.criticality && profile.criticality !== 'Standard') {
    parts.push(`Criticality: ${profile.criticality}`)
  }
  if (profile.paymentTerms && profile.paymentTerms !== 'Default (use due date)') {
    parts.push(`Terms: ${profile.paymentTerms}${profile.customTermsDays ? ' (' + profile.customTermsDays + ' days)' : ''}`)
  }
  if (profile.actionFlag && profile.actionFlag !== 'None') {
    parts.push(`Flag: ${profile.actionFlag}`)
  }
  if (profile.status && profile.status !== 'Pending') {
    parts.push(`Status: ${profile.status}`)
  }
  if (profile.reminderDate) {
    parts.push(`Reminder: ${profile.reminderDate}`)
  }
  if (profile.notes && profile.notes.trim()) {
    parts.push(`Notes: "${profile.notes.trim()}"`)
  }
  return parts.length > 0 ? parts.join(' | ') : null
}

// Build invoice-level override summary for an invoice
function summarizeInvoiceOverride(override) {
  if (!override) return null
  const parts = []
  if (override.flag && override.flag !== 'None') parts.push(`Flag: ${override.flag}`)
  if (override.status && override.status !== 'Open') parts.push(`Status: ${override.status}`)
  if (override.notes && override.notes.trim()) parts.push(`Note: "${override.notes.trim()}"`)
  return parts.length > 0 ? ' [' + parts.join(' | ') + ']' : ''
}

// ── CLIENT-LEVEL PROMPT ──────────────────────────────────
function buildClientPrompt(clientName, vendors, aggregate, vendorProfiles = {}, invoiceOverrides = {}) {
  // Build top 5 vendors block with profile context
  const topVendors = vendors.slice(0, 5).map((v, i) => {
    const profileSummary = summarizeVendorProfile(vendorProfiles[v.name])
    let line = `${i + 1}. ${v.name} — total ${fmt(v.aging.totalAP)}, ${v.invoiceCount} invoice(s), oldest ${v.oldestDays}d past due. Status: ${v.status}.`
    line += `\n   Aging: Current ${fmt(v.aging.current)} | 1–30 ${fmt(v.aging.days1_30)} | 31–60 ${fmt(v.aging.days31_60)} | 61–90 ${fmt(v.aging.days61_90)} | Over 90 ${fmt(v.aging.over90)}.`
    if (profileSummary) line += `\n   PROFILE: ${profileSummary}`
    return line
  }).join('\n\n')

  // Top oldest invoices with overrides
  const topOldest = aggregate.topOldestInvoices.slice(0, 5).map((inv, i) => {
    const overrideStr = summarizeInvoiceOverride(invoiceOverrides[inv.vendor + '||' + inv.invoiceNumber])
    return `${i + 1}. ${inv.vendor} — Invoice ${inv.invoiceNumber} — ${inv.daysPastDue}d past due — ${fmt(inv.openBalance)}${overrideStr}`
  }).join('\n')

  // Build a profiled vendors overview — those with non-default profiles
  const profiledVendorsList = Object.entries(vendorProfiles)
    .filter(([_, p]) => p && (p.paymentMethod !== 'Manual' || p.criticality !== 'Standard' || p.paymentTerms !== 'Default (use due date)' || (p.actionFlag && p.actionFlag !== 'None') || (p.notes && p.notes.trim())))
    .map(([name, p]) => `- ${name}: ${summarizeVendorProfile(p)}`)
    .join('\n')

  const overduePercent = aggregate.totalAP > 0 ? ((aggregate.overdueTotal / aggregate.totalAP) * 100).toFixed(1) : '0.0'

  return `You are an expert accounting advisor at an outsourced bookkeeping firm in India serving a US-based small business client. Generate a concise, professional A/P aging memo for the client's controller or business owner.

CRITICAL INSTRUCTIONS:
- Each vendor may have a PROFILE describing payment method, criticality, payment terms, action flags, and notes. ALWAYS factor profile context into your recommendations.
- A vendor on "Standing Instruction" or "Auto-Debit" does NOT need manual follow-up — explicitly say so.
- A vendor marked "Critical" criticality (utilities, rent, taxes) must be prioritized even if its aging looks moderate.
- A vendor with custom payment terms (e.g., Net 90, Net 120) may show as overdue in aging buckets but is actually within terms — call this out and DO NOT recommend chasing it.
- Vendors with "Hold", "Disputed", or "Awaiting approval" flags require different actions than just paying — respect those flags.
- Invoice-level overrides override vendor-level guidance. If a specific invoice is flagged "Disputed" or "Cancelled (credit received)", treat it accordingly.
- If profile notes contain context (e.g., "ongoing dispute on Inv #1247"), incorporate that into your recommendations.

CLIENT: ${clientName}
TOTAL A/P: ${fmt(aggregate.totalAP)} across ${aggregate.vendorCount} vendors and ${aggregate.invoiceCount} open invoices.
OVERDUE: ${fmt(aggregate.overdueTotal)} (${overduePercent}% of total).
OLDEST INVOICE: ${aggregate.oldestInvoiceDays} days past due.

AGING BUCKETS:
- Current (not yet due): ${fmt(aggregate.current)}
- 1–30 days past due: ${fmt(aggregate.days1_30)}
- 31–60 days past due: ${fmt(aggregate.days31_60)}
- 61–90 days past due: ${fmt(aggregate.days61_90)}
- Over 90 days past due: ${fmt(aggregate.over90)}

VENDOR STATUS COUNT:
- Critical (61+ days overdue): ${aggregate.criticalVendors}
- Review (31–60 days): ${aggregate.warningVendors}
- On Track: ${aggregate.okVendors}

TOP 5 VENDORS BY URGENCY (with profiles):
${topVendors}

TOP 5 OLDEST OPEN INVOICES (with any overrides):
${topOldest}

${profiledVendorsList ? `\nVENDORS WITH CONFIGURED PROFILES (full list):\n${profiledVendorsList}\n` : ''}

Generate a memo with these clearly labelled sections in order:

ASSESSMENT — One to two sentences on overall A/P health. Reference overdue % and oldest invoice. Factor in how many vendors are critical/auto-paying.

KEY CONCERNS — 2–4 specific concerns. Reference vendors by name and exact dollar amounts. Distinguish vendors that need attention from those that are auto-paying or under hold/dispute.

CASH FLOW PRIORITIES — Rank the 3–5 most urgent payments needed this week, with specific vendor names and invoice references. Skip vendors that are on standing instructions, auto-debit, or held/disputed. Prioritize Critical-criticality vendors (rent, utilities, taxes) even if their aging looks moderate. Explain priority basis.

RECOMMENDED ACTIONS — 2–3 broader actions beyond payments: contact disputed vendors, review payment terms with specific suppliers, address supplier credits, follow up on awaiting-approval invoices, etc.

DRAFT MEMO — A concise email memo from the bookkeeping firm to the client's controller, summarizing the A/P situation and recommended action. Ready to copy and send. Use professional US business English.

Constraints:
- Plain US business English. No markdown symbols (no **, no ##, no _).
- Use exact dollar amounts and vendor names from the data provided.
- Keep the entire output under 700 words.
- Do not invent data — only use what is provided.
- When vendor profiles indicate auto-payment or special handling, EXPLICITLY ACKNOWLEDGE THIS in the narrative (e.g., "Sinclair Dental's $14,861 balance is on standing instruction and will auto-clear — no action needed").`
}

// ── VENDOR-LEVEL PROMPT ──────────────────────────────────
function buildVendorPrompt(clientName, vendor, vendorProfiles = {}, invoiceOverrides = {}) {
  const profile = vendorProfiles[vendor.name] || null
  const profileSummary = summarizeVendorProfile(profile)

  // Build invoice lines with overrides
  const invoiceLines = vendor.invoices.map(inv => {
    const overrideStr = summarizeInvoiceOverride(invoiceOverrides[vendor.name + '||' + inv.invoiceNumber])
    return `- ${inv.date} · Invoice ${inv.invoiceNumber} · Due ${inv.dueDate || 'n/a'} · ${inv.daysPastDue > 0 ? inv.daysPastDue + ' days past due' : 'not yet due'} · Open balance: ${fmt(inv.openBalance)}${overrideStr}`
  }).join('\n')

  // Check for any invoices with overrides for highlighting
  const overriddenInvoices = vendor.invoices.filter(inv =>
    invoiceOverrides[vendor.name + '||' + inv.invoiceNumber] &&
    (invoiceOverrides[vendor.name + '||' + inv.invoiceNumber].flag !== 'None' ||
     invoiceOverrides[vendor.name + '||' + inv.invoiceNumber].status !== 'Open' ||
     (invoiceOverrides[vendor.name + '||' + inv.invoiceNumber].notes || '').trim())
  )

  return `You are an expert accounting advisor at an outsourced bookkeeping firm in India serving the US-based client "${clientName}". Generate a concise vendor-specific A/P analysis.

CRITICAL INSTRUCTIONS:
- This vendor may have a PROFILE describing how they're paid and how critical they are.
- If profile indicates auto-payment (standing instruction, auto-debit), do NOT recommend chasing — acknowledge it's auto-clearing.
- If criticality is "Critical" (rent, utilities), elevate urgency even if aging looks moderate.
- If payment terms are non-default (e.g., Net 90), invoices may LOOK overdue in standard aging but actually be within terms.
- Invoice-level overrides describe specific invoice situations (disputes, cancellations, holds) — handle accordingly.
- If profile or invoice notes contain context, incorporate it into recommendations.

CLIENT: ${clientName}
VENDOR: ${vendor.name}
TOTAL OWED: ${fmt(vendor.aging.totalAP)}
INVOICE COUNT: ${vendor.invoiceCount}
OLDEST INVOICE: ${vendor.oldestDays} days past due
DEFAULT STATUS: ${vendor.status}
HAS SUPPLIER CREDITS: ${vendor.hasCredits ? 'Yes' : 'No'}

${profileSummary ? `VENDOR PROFILE: ${profileSummary}\n` : 'VENDOR PROFILE: Default (no overrides configured)\n'}

AGING BREAKDOWN:
- Current: ${fmt(vendor.aging.current)}
- 1–30 days past due: ${fmt(vendor.aging.days1_30)}
- 31–60 days past due: ${fmt(vendor.aging.days31_60)}
- 61–90 days past due: ${fmt(vendor.aging.days61_90)}
- Over 90 days past due: ${fmt(vendor.aging.over90)}

ALL INVOICES (sorted by age, with any overrides):
${invoiceLines}

${overriddenInvoices.length > 0 ? `\nNOTE: ${overriddenInvoices.length} invoice(s) have specific overrides — see [bracketed notes] above. These take precedence over default treatment.\n` : ''}

Generate a vendor analysis with these clearly labelled sections in order:

ASSESSMENT — One to two sentences on this vendor's status. Factor in profile context: is this an auto-pay vendor that needs no action, or a high-priority one requiring immediate attention?

KEY CONCERNS — 2–3 specific concerns. Reference exact invoice numbers and amounts. Note patterns (e.g., multiple invoices stacked, partial payments, unused credits, disputed invoices).

RECOMMENDED ACTIONS — Rank 2–3 specific actions in priority order. For each: which exact invoice to pay first (or NOT to chase if auto-paying), whether to contact the vendor, whether to apply supplier credits, how to handle disputed/cancelled invoices.

DRAFT FOLLOW-UP EMAIL — A short professional email from the client to this vendor. Choose the right tone based on context: request payment plan, confirm intent to pay, apply credits, resolve dispute, or no email needed if this vendor is auto-paying. Ready to copy and send.

Constraints:
- Plain US business English. No markdown symbols.
- Use exact dollar amounts and invoice numbers.
- Keep the entire output under 500 words.
- Do not invent data.
- If the profile indicates this vendor doesn't need follow-up (auto-pay, hold), say so explicitly in the narrative and skip the draft email or write a brief internal note instead.`
}