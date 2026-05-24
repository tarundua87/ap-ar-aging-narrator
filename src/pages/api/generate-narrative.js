export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    mode, clientName, vendors, aggregate,
    vendor, vendorProfiles, invoiceOverrides,
    reconciliationFindings,
  } = req.body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  const prompt = mode === 'vendor'
    ? buildVendorPrompt(clientName, vendor, vendorProfiles, invoiceOverrides, reconciliationFindings)
    : buildClientPrompt(clientName, vendors, aggregate, vendorProfiles, invoiceOverrides, reconciliationFindings)

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

// Payment methods that mean "do not chase — vendor is on autopay"
const AUTO_PAY_METHODS = new Set(['Standing Instruction', 'Auto-Debit'])

function isAutoPay(profile) {
  return !!profile && AUTO_PAY_METHODS.has(profile.paymentMethod)
}

// Build a compact profile summary string for a vendor
function summarizeVendorProfile(profile) {
  if (!profile) return null
  const parts = []
  if (profile.nature && profile.nature !== 'Other') {
    parts.push(`Nature: ${profile.nature}`)
  }
  if (profile.is1099Eligible) {
    parts.push(`1099 Eligible: Yes`)
  }
  if (profile.paymentMethod && profile.paymentMethod !== 'Manual') {
    parts.push(`Payment: ${profile.paymentMethod}`)
  }
  if (profile.criticality && profile.criticality !== 'Standard') {
    parts.push(`Criticality: ${profile.criticality}`)
  }
  if (profile.paymentTerms && profile.paymentTerms !== 'Default (use due date)') {
    parts.push(`Terms: ${profile.paymentTerms}${profile.customTermsDays ? ' (' + profile.customTermsDays + ' days)' : ''}`)
  }
  if (profile.defaultTakeAction && profile.defaultTakeAction !== 'No decision') {
    parts.push(`Default Take Action: ${profile.defaultTakeAction}`)
  }
  if (profile.isFlagged) {
    parts.push(`Flagged for attention`)
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
  if (override.takeAction && override.takeActionId && override.takeActionId !== 'none') {
    let takeActionStr = `Take Action: ${override.takeAction}`
    if (override.takeActionId === 'part-pay' && override.partPaymentAmount) {
      takeActionStr += ` (intended: ${fmt(override.partPaymentAmount)})`
    }
    parts.push(takeActionStr)
  }
  if (override.isFlagged) parts.push(`Flagged`)
  if (override.status && override.status !== 'Open') parts.push(`Status: ${override.status}`)
  if (override.reminderDate) parts.push(`Reminder: ${override.reminderDate}`)
  if (override.notes && override.notes.trim()) parts.push(`Note: "${override.notes.trim()}"`)
  return parts.length > 0 ? ' [' + parts.join(' | ') + ']' : ''
}

// Build a block describing unexecuted pay decisions from the prior period.
// Returns null if there are no findings.
function buildReconciliationBlock(reconciliationFindings, vendorFilter = null) {
  if (!reconciliationFindings || !reconciliationFindings.unexecutedDecisions) return null
  let decisions = reconciliationFindings.unexecutedDecisions
  if (vendorFilter) {
    decisions = decisions.filter(d => d.vendorName === vendorFilter)
  }
  if (decisions.length === 0) return null

  const lines = decisions.map((d, i) => {
    const actionLabel = d.previousTakeAction === 'full-pay' ? 'Full Pay' : 'Part Pay'
    const intendedStr = d.previousTakeAction === 'part-pay' && d.previousIntendedAmount
      ? ` (intended ${fmt(d.previousIntendedAmount)})`
      : ''
    const reminderStr = d.previousReminderDate ? `, scheduled ${d.previousReminderDate}` : ''
    const noteStr = d.previousNotes ? ` — prior note: "${d.previousNotes}"` : ''
    return `${i + 1}. ${d.vendorName} — Invoice ${d.invoiceNumber}: decision was ${actionLabel}${intendedStr}${reminderStr}. Previous open balance ${fmt(d.previousOpenBalance)}, current open balance ${fmt(d.currentOpenBalance)}. Unexecuted amount: ${fmt(d.unexecutedAmount)}.${noteStr}`
  }).join('\n')

  const total = decisions.reduce((s, d) => s + (Number(d.unexecutedAmount) || 0), 0)
  const vendors = new Set(decisions.map(d => d.vendorName)).size

  return {
    block: lines,
    count: decisions.length,
    total,
    vendorsAffected: vendors,
    previousAsOfDate: reconciliationFindings.previousAsOfDate || 'prior period',
  }
}

// ── CLIENT-LEVEL PROMPT ──────────────────────────────────
function buildClientPrompt(clientName, vendors, aggregate, vendorProfiles = {}, invoiceOverrides = {}, reconciliationFindings = null) {
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

  // List of vendors known to be on auto-pay (so the AI doesn't chase them)
  const autoPayVendors = Object.entries(vendorProfiles)
    .filter(([_, p]) => isAutoPay(p))
    .map(([name, p]) => `- ${name} (${p.paymentMethod})`)
    .join('\n')

  // Build a profiled vendors overview — those with non-default profiles
  const profiledVendorsList = Object.entries(vendorProfiles)
    .filter(([_, p]) => p && (
      (p.paymentMethod && p.paymentMethod !== 'Manual') ||
      (p.criticality && p.criticality !== 'Standard') ||
      (p.paymentTerms && p.paymentTerms !== 'Default (use due date)') ||
      (p.defaultTakeAction && p.defaultTakeAction !== 'No decision') ||
      p.isFlagged ||
      (p.notes && p.notes.trim())
    ))
    .map(([name, p]) => `- ${name}: ${summarizeVendorProfile(p)}`)
    .join('\n')

  const overduePercent = aggregate.totalAP > 0 ? ((aggregate.overdueTotal / aggregate.totalAP) * 100).toFixed(1) : '0.0'

  const recon = buildReconciliationBlock(reconciliationFindings)
  const hasReconFindings = !!recon

  return `You are an expert accounting advisor at an outsourced bookkeeping firm in India serving a US-based small business client. Generate a concise, professional A/P aging memo for the client's controller or business owner.

CRITICAL INSTRUCTIONS:
- Each vendor may have a PROFILE describing nature (rent, utilities, etc.), 1099 eligibility, payment method, criticality, payment terms, default take action, flagged status, and notes. ALWAYS factor profile context into your recommendations.
- AUTO-PAY RULE: A vendor whose Payment Method is "Standing Instruction" or "Auto-Debit" is on auto-pay. DO NOT recommend chasing or following up on their invoices. Explicitly acknowledge in the narrative that those invoices will auto-clear. The list of auto-pay vendors for this client is provided below.
- A vendor marked "Critical" criticality (utilities, rent, taxes) must be prioritized even if its aging looks moderate.
- Vendor Nature gives important context: Rent and Utilities are operationally critical; Inventory shortfalls affect operations; Professional Services and SaaS can usually wait; Tax/Government vendors must never be delayed.
- 1099-Eligible vendors are subject to US year-end tax reporting. If you observe an active 1099 vendor in the narrative, briefly note this where contextually appropriate (e.g., "for year-end 1099 tracking, please confirm W-9 is on file"). Do NOT discuss YTD totals or thresholds — that is tracked separately.
- A vendor with custom payment terms (e.g., Net 90, Net 120) may show as overdue in aging buckets but is actually within terms — call this out and DO NOT recommend chasing it.
- An invoice may have a TAKE ACTION decision recorded (Full Pay, Part Pay, Hold, Disputed, Pending Reconciliation). Respect those decisions:
  - Full Pay / Part Pay: payment is intended; mention in priorities if applicable.
  - Hold: deliberately not paying yet (cash-flow or strategic). Do NOT recommend chasing.
  - Disputed: payment blocked pending vendor resolution. Recommend follow-up on the dispute itself, not payment.
  - Pending Reconciliation: payment blocked pending internal verification (PO match, vendor statement). Recommend the internal action, not chasing the vendor.
- A vendor marked "Flagged for attention" has context the bookkeeper wants to highlight — read the Notes carefully and reflect that context in your narrative.
- Invoice-level overrides take precedence over vendor-level defaults. If a specific invoice is Disputed, treat it accordingly even if the vendor's default is Full Pay.

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

${autoPayVendors ? `AUTO-PAY VENDORS (do NOT recommend chasing):\n${autoPayVendors}\n` : 'AUTO-PAY VENDORS: None configured.\n'}

TOP 5 VENDORS BY URGENCY (with profiles):
${topVendors}

TOP 5 OLDEST OPEN INVOICES (with any overrides):
${topOldest}

${profiledVendorsList ? `\nVENDORS WITH CONFIGURED PROFILES (full list):\n${profiledVendorsList}\n` : ''}

${hasReconFindings
  ? `RECONCILIATION FINDINGS (decisions from prior period that were NOT executed):
This list compares the new upload against the prior period (${recon.previousAsOfDate}). It shows pay decisions (Full Pay or Part Pay) the bookkeeper made last cycle where the invoice's open balance shows the decision was not carried out.

${recon.block}

Total unexecuted: ${fmt(recon.total)} across ${recon.vendorsAffected} vendor(s), ${recon.count} invoice(s).
`
  : 'RECONCILIATION FINDINGS: No unexecuted pay decisions detected from the prior period (or this is the first upload for this client).\n'
}

Generate a memo with these clearly labelled sections in order:

ASSESSMENT — One to two sentences on overall A/P health. Reference overdue % and oldest invoice. Factor in how many vendors are critical/auto-paying.

${hasReconFindings ? `UNEXECUTED DECISIONS FROM LAST PERIOD — List the unexecuted decisions from the Reconciliation Findings above. For each, state the vendor, invoice, prior decision (Full Pay / Part Pay), unexecuted amount, and prior reminder date if any. Add one short sentence on implication (e.g., "needs reconfirmation before re-prioritizing"). Keep this section factual — DO NOT speculate on why the decision didn't execute.

` : ''}KEY CONCERNS — 2–4 specific concerns. Reference vendors by name and exact dollar amounts. Distinguish vendors that need attention from those that are auto-paying or under hold/dispute/pending-reconciliation.

CASH FLOW PRIORITIES — Rank the 3–5 most urgent payments needed this week, with specific vendor names and invoice references.
- SKIP vendors on Standing Instruction or Auto-Debit — say so explicitly.
- SKIP invoices with Take Action = Hold, Disputed, or Pending Reconciliation — those are deliberate non-payments.
- ELEVATE invoices that appear in the Unexecuted Decisions list above ABOVE comparable fresh overdues, because the bookkeeper already decided to pay them — only execution is missing. However, always note that the controller should reconfirm the decision before acting.
- Prioritize Critical-criticality vendors (rent, utilities, taxes) even if their aging looks moderate.
- For Part Pay decisions, state the intended amount.

RECOMMENDED ACTIONS — 2–3 broader actions beyond payments: follow up on disputed vendors, complete pending internal reconciliations, review payment terms with specific suppliers, address supplier credits, etc.

DRAFT MEMO — A concise email memo from the bookkeeping firm to the client's controller, summarizing the A/P situation and recommended action. Ready to copy and send. Use professional US business English. If there are unexecuted decisions, explicitly mention them and request the controller's reconfirmation.

Constraints:
- Plain US business English. No markdown symbols (no **, no ##, no _).
- Use exact dollar amounts and vendor names from the data provided.
- Keep the entire output under 700 words.
- Do not invent data — only use what is provided.
- When vendor profiles indicate auto-payment or special handling, EXPLICITLY ACKNOWLEDGE THIS in the narrative (e.g., "Sinclair Dental's $14,861 balance is on standing instruction and will auto-clear — no action needed").`
}

// ── VENDOR-LEVEL PROMPT ──────────────────────────────────
function buildVendorPrompt(clientName, vendor, vendorProfiles = {}, invoiceOverrides = {}, reconciliationFindings = null) {
  const profile = vendorProfiles[vendor.name] || null
  const profileSummary = summarizeVendorProfile(profile)
  const onAutoPay = isAutoPay(profile)

  // Build invoice lines with overrides
  const invoiceLines = vendor.invoices.map(inv => {
    const overrideStr = summarizeInvoiceOverride(invoiceOverrides[vendor.name + '||' + inv.invoiceNumber])
    return `- ${inv.date} · Invoice ${inv.invoiceNumber} · Due ${inv.dueDate || 'n/a'} · ${inv.daysPastDue > 0 ? inv.daysPastDue + ' days past due' : 'not yet due'} · Open balance: ${fmt(inv.openBalance)}${overrideStr}`
  }).join('\n')

  // Check for any invoices with overrides for highlighting
  const overriddenInvoices = vendor.invoices.filter(inv => {
    const o = invoiceOverrides[vendor.name + '||' + inv.invoiceNumber]
    if (!o) return false
    return (o.takeActionId && o.takeActionId !== 'none') ||
           o.isFlagged ||
           (o.status && o.status !== 'Open') ||
           (o.notes || '').trim()
  })

  const recon = buildReconciliationBlock(reconciliationFindings, vendor.name)
  const hasReconFindings = !!recon

  return `You are an expert accounting advisor at an outsourced bookkeeping firm in India serving the US-based client "${clientName}". Generate a concise vendor-specific A/P analysis.

CRITICAL INSTRUCTIONS:
- This vendor may have a PROFILE describing nature, 1099 status, payment method, criticality, default take action, flagged status, and more.
- AUTO-PAY RULE: If the Payment Method is "Standing Instruction" or "Auto-Debit", this vendor is on auto-pay. DO NOT recommend chasing or following up. Acknowledge it's auto-clearing and skip the draft email (or write a brief internal note instead).
- If criticality is "Critical" (rent, utilities, taxes), elevate urgency even if aging looks moderate.
- Vendor Nature provides context: Rent/Utilities/Tax-Government cannot be delayed; Professional Services/SaaS have more flexibility.
- If the vendor is 1099-Eligible, mention briefly where contextually appropriate that W-9 status should be confirmed for year-end. Do NOT calculate YTD or thresholds.
- If payment terms are non-default (e.g., Net 90), invoices may LOOK overdue in standard aging but actually be within terms.
- Invoice-level Take Action decisions take precedence: Full Pay / Part Pay = intended payment; Hold / Disputed / Pending Reconciliation = deliberate non-payment with specific reason. Handle accordingly.
- If the vendor or any invoice is "Flagged for attention", read the Notes carefully and reflect that context.

CLIENT: ${clientName}
VENDOR: ${vendor.name}
TOTAL OWED: ${fmt(vendor.aging.totalAP)}
INVOICE COUNT: ${vendor.invoiceCount}
OLDEST INVOICE: ${vendor.oldestDays} days past due
DEFAULT STATUS: ${vendor.status}
HAS SUPPLIER CREDITS: ${vendor.hasCredits ? 'Yes' : 'No'}
ON AUTO-PAY: ${onAutoPay ? 'YES — do not recommend chasing' : 'No'}

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

${hasReconFindings
  ? `RECONCILIATION FINDINGS for this vendor (decisions from prior period ${recon.previousAsOfDate} that were NOT executed):

${recon.block}

Total unexecuted for this vendor: ${fmt(recon.total)} across ${recon.count} invoice(s).
`
  : 'RECONCILIATION FINDINGS: No unexecuted pay decisions detected for this vendor from the prior period.\n'
}

Generate a vendor analysis with these clearly labelled sections in order:

ASSESSMENT — One to two sentences on this vendor's status. Factor in profile context: is this an auto-pay vendor that needs no action, or a high-priority one requiring immediate attention?

${hasReconFindings ? `UNEXECUTED DECISIONS FROM LAST PERIOD — List the unexecuted decisions for this vendor. State each invoice, prior decision (Full Pay / Part Pay), unexecuted amount, and prior reminder date if any. Add one short factual sentence on implication. DO NOT speculate on why the decision didn't execute.

` : ''}KEY CONCERNS — 2–3 specific concerns. Reference exact invoice numbers and amounts. Note patterns (e.g., multiple invoices stacked, partial payments, unused credits, disputed invoices, or unexecuted prior decisions if applicable).

RECOMMENDED ACTIONS — Rank 2–3 specific actions in priority order. For each: which exact invoice to pay first (or NOT to chase if auto-paying), whether to contact the vendor, whether to apply supplier credits, how to handle disputed/cancelled invoices. ELEVATE invoices appearing in Unexecuted Decisions above any fresh overdues of similar size, but always note that the controller should reconfirm before acting.

DRAFT FOLLOW-UP EMAIL — A short professional email from the client to this vendor. Choose the right tone based on context: request payment plan, confirm intent to pay, apply credits, resolve dispute, or no email needed if this vendor is auto-paying. Ready to copy and send.

Constraints:
- Plain US business English. No markdown symbols.
- Use exact dollar amounts and invoice numbers.
- Keep the entire output under 500 words.
- Do not invent data.
- If the profile indicates this vendor doesn't need follow-up (auto-pay, hold, disputed, pending reconciliation), say so explicitly in the narrative and skip the draft email or write a brief internal note instead.`
}