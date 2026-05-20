// Extracts labelled sections from AI-generated narratives.
// The AI is instructed to use clear section labels like:
//   ASSESSMENT — ...
//   KEY CONCERNS — ...
//   CASH FLOW PRIORITIES — ...
//   DRAFT MEMO — ...
//
// We parse by these labels to extract specific sections without
// requiring a strict structured response from the AI.

// Section labels we look for (case-insensitive)
const CLIENT_SECTION_LABELS = [
  'ASSESSMENT',
  'KEY CONCERNS',
  'CASH FLOW PRIORITIES',
  'RECOMMENDED ACTIONS',
  'DRAFT MEMO',
]

const VENDOR_SECTION_LABELS = [
  'ASSESSMENT',
  'KEY CONCERNS',
  'RECOMMENDED ACTIONS',
  'DRAFT FOLLOW-UP EMAIL',
]

// Build a regex that matches any of the known section labels at line start
function buildSectionRegex(labels) {
  // Match a label optionally followed by — or - or :, allowing minor formatting drift
  const escapedLabels = labels.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^(${escapedLabels.join('|')})\\s*[—\\-:]?\\s*`, 'im')
}

// Parse a narrative into sections.
// Returns { [labelKey]: contentString }
// Keys are lowercased and use hyphens instead of spaces (e.g., "draft-memo")
export function parseNarrativeSections(narrative, mode = 'client') {
  if (!narrative || typeof narrative !== 'string') return {}

  const labels = mode === 'vendor' ? VENDOR_SECTION_LABELS : CLIENT_SECTION_LABELS
  const sections = {}

  // Build positions of each section label in the text
  const positions = []
  for (const label of labels) {
    // Look for the label as a line-start marker (allow some leading whitespace)
    const regex = new RegExp(`(^|\\n)\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[—\\-:]?\\s*`, 'i')
    const match = narrative.match(regex)
    if (match) {
      // Calculate position of the label content (after the marker)
      const labelStartInMatch = match[0].length - match[0].trimStart().length
      const start = match.index + labelStartInMatch
      const contentStart = match.index + match[0].length
      positions.push({ label, start, contentStart })
    }
  }

  // Sort by position
  positions.sort((a, b) => a.start - b.start)

  // Extract content between each label and the next
  for (let i = 0; i < positions.length; i++) {
    const current = positions[i]
    const next = positions[i + 1]
    const content = narrative.slice(current.contentStart, next ? next.start : narrative.length).trim()
    const key = current.label.toLowerCase().replace(/\s+/g, '-')
    sections[key] = content
  }

  return sections
}

// Extract just the draft email from a narrative.
// For client narratives, this is the DRAFT MEMO section.
// For vendor narratives, this is the DRAFT FOLLOW-UP EMAIL section.
// Returns the extracted content string, or null if not found.
export function extractDraftEmail(narrative, mode = 'client') {
  if (!narrative) return null
  const sections = parseNarrativeSections(narrative, mode)
  const key = mode === 'vendor' ? 'draft-follow-up-email' : 'draft-memo'
  return sections[key] || null
}

// Heuristic check: did the AI include the expected draft section?
export function hasDraftEmail(narrative, mode = 'client') {
  return !!extractDraftEmail(narrative, mode)
}

// Return the narrative with the draft email section removed.
// The Summary tab shows this version so the draft doesn't appear twice in the UI.
// We trim until the start of the draft label, dropping everything after it.
export function narrativeWithoutDraft(narrative, mode = 'client') {
  if (!narrative) return narrative
  const draftLabel = mode === 'vendor' ? 'DRAFT FOLLOW-UP EMAIL' : 'DRAFT MEMO'
  const regex = new RegExp(`(^|\\n)\\s*${draftLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[—\\-:]?`, 'i')
  const match = narrative.match(regex)
  if (!match) return narrative
  // Trim everything from where the label line starts
  const labelLineStart = match.index + (match[0].length - match[0].trimStart().length)
  return narrative.slice(0, labelLineStart).trimEnd()
}