export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { client } = req.body

  if (!client) return res.status(400).json({ error: 'No client data provided' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  const prompt = buildPrompt(client)

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
console.log('Claude response:', JSON.stringify(data, null, 2))
const narrative = data.content?.[0]?.text || 'No narrative generated.'
return res.status(200).json({ narrative })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate narrative', detail: err.message })
  }
}

function buildPrompt(client) {
  const { name, currency = 'USD', aging } = client
  const { current = 0, days1_30 = 0, days31_60 = 0, days61_90 = 0, over90 = 0, totalAR = 0 } = aging

  return `You are an expert accounting advisor helping an outsourced bookkeeping firm in India that serves US-based small business clients.

Generate a concise, professional AR aging narrative for the following client. Write it as a ready-to-send update memo from the bookkeeping firm to their US client contact. Use plain business English appropriate for a US audience.

CLIENT: ${name}
CURRENCY: ${currency}

AR AGING SNAPSHOT:
- Current (not yet due): $${current.toLocaleString()}
- 1–30 days overdue: $${days1_30.toLocaleString()}
- 31–60 days overdue: $${days31_60.toLocaleString()}
- 61–90 days overdue: $${days61_90.toLocaleString()}
- Over 90 days overdue: $${over90.toLocaleString()}
- TOTAL AR OUTSTANDING: $${totalAR.toLocaleString()}

Instructions:
1. Start with a 1-sentence overall health assessment (good / needs attention / critical).
2. Highlight the most urgent aging buckets.
3. Give 2–3 specific recommended actions ranked by priority.
4. Draft a short follow-up email the client can send to their overdue customers (keep it professional and firm but polite — US business tone).
5. Keep the entire narrative under 300 words.

Format with clear sections: ASSESSMENT, KEY CONCERNS, RECOMMENDED ACTIONS, DRAFT FOLLOW-UP EMAIL.`
}
