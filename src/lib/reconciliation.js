// Cross-period reconciliation for Phase 2A.
//
// Detects "decision not executed": invoices where the previous period had a
// pay decision (Full Pay or Part Pay) and the current period shows the open
// balance essentially unchanged.
//
// Phase 2A scope (locked decisions):
//   - Only Full Pay and Part Pay decisions are reconciled. Hold / Disputed /
//     Pending-Recon revisit tracking is deferred to Phase 2B.
//   - Full Pay with PARTIAL execution → flagged (decision was "pay in full",
//     anything less is not the decision).
//   - Part Pay with MISMATCHED execution (paid different than intent) →
//     NOT flagged in Phase 2A. Money moved; that's enough signal for now.
//   - Invoice or vendor disappeared between periods → treated as executed.
//     Avoids false positives from data sync gaps.
//   - No tolerance on amounts: exact match required.
//
// This file does NO storage access. It's a pure computation called by the
// orchestrator after a new report is saved.

const PAY_DECISIONS = ['full-pay', 'part-pay']

// Composite key matching the one used in invoice overrides storage
function invoiceKey(vendorName, invoiceNumber) {
  return vendorName + '||' + invoiceNumber
}

// Build a fast lookup of current invoices by their composite key,
// so we can ask "does this previous-period invoice still exist now?"
function indexCurrentInvoices(currentVendors) {
  const map = new Map()
  for (const vendor of currentVendors || []) {
    for (const inv of vendor.invoices || []) {
      map.set(invoiceKey(vendor.name, inv.invoiceNumber), {
        vendorName: vendor.name,
        invoice: inv,
      })
    }
  }
  return map
}

// Build a fast lookup of previous-period invoices by composite key.
function indexPreviousInvoices(previousVendors) {
  const map = new Map()
  for (const vendor of previousVendors || []) {
    for (const inv of vendor.invoices || []) {
      map.set(invoiceKey(vendor.name, inv.invoiceNumber), {
        vendorName: vendor.name,
        invoice: inv,
      })
    }
  }
  return map
}

// Was a pay decision actually executed?
//
// Full Pay: open balance must drop to zero (or below — credits applied).
//   Anything else (including partial) → NOT executed.
//
// Part Pay: open balance must have decreased BY AT LEAST the intended
//   partPaymentAmount. (No-tolerance variant of "did money move as intended".)
//   If partPaymentAmount is missing/null, fall back to "did anything decrease".
//   Per Edge Case B (locked): mismatched-execution Part Pay is NOT flagged.
//   Only fully unexecuted (no decrease) Part Pay is flagged.
function wasDecisionExecuted({ previousOpenBalance, currentOpenBalance, takeActionId, partPaymentAmount }) {
  const previous = Number(previousOpenBalance) || 0
  const current = Number(currentOpenBalance) || 0
  const decrease = previous - current

  if (takeActionId === 'full-pay') {
    // Decision was "pay in full." Anything less is unexecuted intent.
    return current <= 0
  }

  if (takeActionId === 'part-pay') {
    // Decision was "pay a specific partial amount."
    // Per Phase 2A scope: only flag if NO money moved at all.
    // Mismatched execution (paid more or less than intended) is not flagged.
    if (!partPaymentAmount || partPaymentAmount <= 0) {
      // No intent amount captured — fall back to "did anything move"
      return decrease > 0
    }
    return decrease > 0
  }

  // Defensive: any other takeActionId shouldn't get here, but treat as executed
  return true
}

// Compute reconciliation findings for a new upload.
//
// Inputs:
//   previousReport: the prior period's report object (from storage), or null
//   previousInvoiceOverrides: the prior period's invoice overrides map
//     (shape: { "vendorName||invoiceNumber": override })
//   currentParsedData: the freshly parsed data for the new upload
//     (shape: { vendors, aggregate, invoiceCount })
//
// Output: a reconciliationFindings object suitable for storing on the new report,
//   or null if no previous period exists to compare against.
export function computeReconciliationFindings({
  previousReport,
  previousInvoiceOverrides,
  currentParsedData,
}) {
  // No previous period → nothing to reconcile. First upload for this client.
  if (!previousReport || !currentParsedData) return null
  if (!previousInvoiceOverrides || Object.keys(previousInvoiceOverrides).length === 0) {
    // Previous period existed but had no overrides at all → no decisions to check
    return {
      previousReportId: previousReport.id,
      previousAsOfDate: previousReport.asOfDate,
      unexecutedDecisions: [],
      computedAt: new Date().toISOString(),
    }
  }

  const previousVendors = previousReport.parsedData?.vendors || []
  const currentVendors = currentParsedData.vendors || []

  const previousInvoiceIndex = indexPreviousInvoices(previousVendors)
  const currentInvoiceIndex = indexCurrentInvoices(currentVendors)

  const unexecutedDecisions = []

  // Walk the previous period's overrides. Each entry is a decision the
  // bookkeeper made last period. We check whether it was carried out.
  for (const [key, override] of Object.entries(previousInvoiceOverrides)) {
    const takeActionId = override?.takeActionId
    if (!PAY_DECISIONS.includes(takeActionId)) continue // only pay decisions

    // Parse vendor name + invoice number out of the composite key
    const sepIdx = key.indexOf('||')
    if (sepIdx < 0) continue
    const vendorName = key.slice(0, sepIdx)
    const invoiceNumber = key.slice(sepIdx + 2)

    // Edge cases D & E: if the invoice doesn't exist in current period, treat
    // as executed (most likely was paid and dropped off A/P). Skip.
    const currentEntry = currentInvoiceIndex.get(key)
    if (!currentEntry) continue

    // Pull previous balance from the previous report's parsed data
    const previousEntry = previousInvoiceIndex.get(key)
    if (!previousEntry) {
      // Override exists but the invoice itself isn't in the previous report.
      // Can't compute a balance delta — skip defensively.
      continue
    }

    const previousOpenBalance = Number(previousEntry.invoice.openBalance) || 0
    const currentOpenBalance = Number(currentEntry.invoice.openBalance) || 0

    const executed = wasDecisionExecuted({
      previousOpenBalance,
      currentOpenBalance,
      takeActionId,
      partPaymentAmount: override.partPaymentAmount,
    })

    if (executed) continue

    // It's unexecuted. Record everything the UI and AI prompt might need.
    const unexecutedAmount =
      takeActionId === 'full-pay'
        ? previousOpenBalance
        : (override.partPaymentAmount || previousOpenBalance)

    unexecutedDecisions.push({
      vendorName,
      invoiceNumber,
      previousTakeAction: takeActionId,
      previousReminderDate: override.reminderDate || null,
      previousNotes: override.notes || '',
      previousOpenBalance,
      currentOpenBalance,
      unexecutedAmount,
      previousIntendedAmount:
        takeActionId === 'part-pay'
          ? (override.partPaymentAmount || null)
          : previousOpenBalance,
      currentDaysPastDue: currentEntry.invoice.daysPastDue ?? null,
    })
  }

  return {
    previousReportId: previousReport.id,
    previousAsOfDate: previousReport.asOfDate,
    unexecutedDecisions,
    computedAt: new Date().toISOString(),
  }
}

// Convenience: summary stats for use in UI badges / narrative
export function summarizeReconciliation(findings) {
  if (!findings || !findings.unexecutedDecisions) {
    return { count: 0, totalUnexecutedAmount: 0, vendorsAffected: 0 }
  }
  const vendors = new Set()
  let total = 0
  for (const d of findings.unexecutedDecisions) {
    vendors.add(d.vendorName)
    total += Number(d.unexecutedAmount) || 0
  }
  return {
    count: findings.unexecutedDecisions.length,
    totalUnexecutedAmount: total,
    vendorsAffected: vendors.size,
  }
}

// Convenience: filter findings to a specific vendor (for the vendor-level view)
export function findingsForVendor(findings, vendorName) {
  if (!findings || !findings.unexecutedDecisions) return []
  return findings.unexecutedDecisions.filter(d => d.vendorName === vendorName)
}

// Convenience: lookup map { "vendorName||invoiceNumber": finding } for fast
// per-invoice lookup in the InvoiceOverridesTable UI
export function findingsByInvoiceKey(findings) {
  const map = {}
  if (!findings || !findings.unexecutedDecisions) return map
  for (const d of findings.unexecutedDecisions) {
    map[d.vendorName + '||' + d.invoiceNumber] = d
  }
  return map
}