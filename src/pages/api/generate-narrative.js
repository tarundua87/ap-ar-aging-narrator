export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { mode, clientName, vendors, aggregate, vendor } = req.body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  const prompt = mode === 'vendor'
    ? buildVendorPrompt(clientName, vendor)
    : buildClientPrompt(clientName, vendors, aggregate)

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
        max_tokens: 2000,
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

function buildClientPrompt(clientName, vendors, aggregate) {
  // Top 5 vendors by urgency
  const topVendors = vendors.slice(0, 5).map((v, i) =>
    `${i + 1}. ${v.name} — total ${fmt(v.aging.totalAP)} across ${v.invoiceCount} invoice(s). Status: ${v.status}. Oldest invoice: ${v.oldestDays} days past due. Aging breakdown: Current ${fmt(v.aging.current)} | 1–30 ${fmt(v.aging.days1_30)} | 31–60 ${fmt(v.aging.days31_60)} | 61–90 ${fmt(v.aging.days61_90)} | Over 90 ${fmt(v.aging.over90)}.`
  ).join('\n')

  // Top 5 oldest invoices
  const topOldest = aggregate.topOldestInvoices.slice(0, 5).map((inv, i) =>
    `${i + 1}. ${inv.vendor} — Invoice ${inv.invoiceNumber} — ${inv.daysPastDue} days past due — ${fmt(inv.openBalance)}`
  ).join('\n')

  const overduePercent = aggregate.totalAP > 0 ? ((aggregate.overdueTotal / aggregate.totalAP) * 100).toFixed(1) : '0.0'

  return `You are an expert accounting advisor at an outsourced bookkeeping firm in India serving a US-based small business client. Generate a concise, professional A/P aging memo for the client's US controller or business owner.

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
- Review (31–60 days or high 1–30 concentration): ${aggregate.warningVendors}
- On Track: ${aggregate.okVendors}

TOP 5 VENDORS BY URGENCY:
${topVendors}

TOP 5 OLDEST OPEN INVOICES:
${topOldest}

Generate a memo with these clearly labelled sections in order:

ASSESSMENT — One to two sentences on the overall A/P health: is it good, needs attention, or critical? Reference the overdue percentage and oldest invoice.

KEY CONCERNS — 2–4 specific concerns. Reference vendors by name and exact dollar amounts. Call out the oldest invoices specifically (vendor name + invoice number + days overdue). Note any concentration risk (e.g., one vendor with disproportionate exposure).

CASH FLOW PRIORITIES — Rank the 3–5 most urgent payments the client should make this week, with specific vendor names and invoice references. Explain why each is prioritized (oldest, largest, vendor relationship risk, etc.).

RECOMMENDED ACTIONS — 2–3 broader actions beyond immediate payments: e.g., contact specific vendors to negotiate, review payment terms, address supplier credits sitting unused.

DRAFT MEMO — A concise email memo from the bookkeeping firm to the client's controller/owner, summarizing the A/P situation and recommending action. Should be ready to copy and send. Use professional US business English.

Constraints:
- Plain US business English. No markdown symbols (no **, no ##, no _).
- Use exact dollar amounts and vendor names from the data provided.
- Keep the entire output under 600 words.
- Do not invent data — only use what is provided.`
}

function buildVendorPrompt(clientName, vendor) {
  // Format invoices for the prompt
  const invoiceLines = vendor.invoices.map(inv =>
    `- ${inv.date} · Invoice ${inv.invoiceNumber} · Due ${inv.dueDate || 'n/a'} · ${inv.daysPastDue > 0 ? inv.daysPastDue + ' days past due' : 'not yet due'} · Open balance: ${fmt(inv.openBalance)}`
  ).join('\n')

  return `You are an expert accounting advisor at an outsourced bookkeeping firm in India serving the US-based client "${clientName}". Generate a concise vendor-specific A/P analysis.

CLIENT: ${clientName}
VENDOR: ${vendor.name}
TOTAL OWED TO THIS VENDOR: ${fmt(vendor.aging.totalAP)}
INVOICE COUNT: ${vendor.invoiceCount}
OLDEST INVOICE: ${vendor.oldestDays} days past due
STATUS: ${vendor.status}
HAS SUPPLIER CREDITS: ${vendor.hasCredits ? 'Yes' : 'No'}

AGING BREAKDOWN:
- Current: ${fmt(vendor.aging.current)}
- 1–30 days past due: ${fmt(vendor.aging.days1_30)}
- 31–60 days past due: ${fmt(vendor.aging.days31_60)}
- 61–90 days past due: ${fmt(vendor.aging.days61_90)}
- Over 90 days past due: ${fmt(vendor.aging.over90)}

ALL INVOICES (sorted by age):
${invoiceLines}

Generate a vendor analysis with these clearly labelled sections in order:

ASSESSMENT — One to two sentences on this vendor's status and what it means for the client.

KEY CONCERNS — 2–3 specific concerns. Reference exact invoice numbers and amounts. Note patterns (e.g., multiple invoices stacked at one date, partial payments, supplier credits sitting unused).

RECOMMENDED ACTIONS — Rank 2–3 specific actions in priority order. For each: which exact invoice to pay first, whether to contact the vendor, whether to apply supplier credits, etc.

DRAFT FOLLOW-UP EMAIL — A short professional email from the client to this vendor (e.g., requesting a payment plan, confirming intent to pay, applying credits, or disputing a balance — choose based on the situation). Ready to copy and send. Use professional US business English.

Constraints:
- Plain US business English. No markdown symbols.
- Use exact dollar amounts and invoice numbers.
- Keep the entire output under 400 words.
- Do not invent data.`
}