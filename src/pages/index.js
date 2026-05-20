import { useState, useEffect } from 'react'
import Head from 'next/head'
import Header from '../components/Header'
import ClientLibrary from '../components/ClientLibrary'
import UploadPanel from '../components/UploadPanel'
import ClientSummary from '../components/ClientSummary'
import VendorTriage from '../components/VendorTriage'
import NarrativePanel from '../components/NarrativePanel'
import MasterConfigPanel from '../components/MasterConfigPanel'
import VendorSettingsPanel from '../components/VendorSettingsPanel'
import ClientGroupsPanel from '../components/ClientGroupsPanel'
import NewVendorsModal from '../components/NewVendorsModal'
import VendorProfileForm from '../components/VendorProfileForm'
import {
  listClients, getClient, getLatestReport, getReport,
  saveReport, saveVendorNarrative, saveClientNarrative,
  deleteClient, deleteReport,
} from '../lib/storage'
import { exportReportPDF, exportVendorPDF } from '../lib/exportPDF'
import { exportReportWord, exportVendorWord } from '../lib/exportWord'
import {
  getClientProfiles, getVendorProfile, saveVendorProfile,
  getInvoiceOverrides, findUnprofiledVendors,
  describeProfile, describeInvoiceOverride,
  autoSuggestProfile,
} from '../lib/vendorProfiles'

const VIEW_LIBRARY = 'library'
const VIEW_UPLOAD = 'upload'
const VIEW_UPLOAD_SCOPED = 'upload_scoped'
const VIEW_REPORT = 'report'

export default function Dashboard() {
  // Current view
  const [view, setView] = useState(VIEW_LIBRARY)

  // Library state
  const [clients, setClients] = useState([])

  // Active report state
  const [activeSlug, setActiveSlug] = useState(null)
  const [activeReportId, setActiveReportId] = useState(null)
  const [activeReport, setActiveReport] = useState(null)

  // Vendor narrative state
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [vendorNarrative, setVendorNarrative] = useState(null)
  const [loadingVendor, setLoadingVendor] = useState(false)

  // Client narrative loading (for refresh)
  const [loadingClient, setLoadingClient] = useState(false)

  // Export preparation state
  const [exportPreparing, setExportPreparing] = useState(false)
  const [exportProgress, setExportProgress] = useState({ done: 0, total: 0 })

  // Draft email regeneration state (for the Draft Email tab fallback)
  const [regeneratingEmail, setRegeneratingEmail] = useState(false)

  // Modal states
  const [showMasterConfig, setShowMasterConfig] = useState(false)
  const [showVendorSettings, setShowVendorSettings] = useState(false)
  const [showGroupsPanel, setShowGroupsPanel] = useState(false)
  const [quickEditVendor, setQuickEditVendor] = useState(null) // string vendor name
  const [newVendorsToReview, setNewVendorsToReview] = useState(null) // {clientSlug, clientName, vendors[]}

  // Profile tick to force re-renders when profiles or overrides change
  const [profileTick, setProfileTick] = useState(0)
  const bumpProfiles = () => setProfileTick(t => t + 1)

  // ── Initial load + view restoration ──────────────

  useEffect(() => {
    refreshLibrary()
    try {
      const saved = window.localStorage.getItem('ap-narrator:viewState')
      if (!saved) return
      const state = JSON.parse(saved)
      if (!state || !state.view) return

      if (state.view === VIEW_REPORT && state.slug && state.reportId) {
        const report = getReport(state.slug, state.reportId)
        if (report) {
          setActiveSlug(state.slug)
          setActiveReportId(state.reportId)
          setActiveReport(report)
          if (state.vendorName) {
            const v = report.parsedData?.vendors?.find(v => v.name === state.vendorName)
            if (v) {
              setSelectedVendor(v)
              const cached = report.vendorNarratives?.[v.name]
              if (cached) setVendorNarrative(cached)
            }
          }
          setView(VIEW_REPORT)
        }
      } else if (state.view === VIEW_UPLOAD) {
        setView(VIEW_UPLOAD)
      } else if (state.view === VIEW_UPLOAD_SCOPED && state.slug) {
        if (getClient(state.slug)) {
          setActiveSlug(state.slug)
          if (state.reportId) {
            const report = getReport(state.slug, state.reportId)
            if (report) {
              setActiveReportId(state.reportId)
              setActiveReport(report)
            }
          }
          setView(VIEW_UPLOAD_SCOPED)
        }
      }
    } catch (err) {
      console.error('Failed to restore view state', err)
    }
  }, [])

  useEffect(() => {
    try {
      const state = {
        view,
        slug: activeSlug,
        reportId: activeReportId,
        vendorName: selectedVendor?.name || null,
      }
      window.localStorage.setItem('ap-narrator:viewState', JSON.stringify(state))
    } catch {}
  }, [view, activeSlug, activeReportId, selectedVendor])

  const refreshLibrary = () => {
    setClients(listClients())
  }

  // ── Profile helpers ──────────────────────────────

  const currentProfilesMap = activeSlug ? getClientProfiles(activeSlug) : {}
  const currentOverridesMap = (activeSlug && activeReportId) ? getInvoiceOverrides(activeSlug, activeReportId) : {}

  // Convert profile IDs to labels (the AI prompt expects labels, not IDs)
  const buildPromptContext = () => {
    const profilesForPrompt = {}
    for (const [vendorName, profile] of Object.entries(currentProfilesMap)) {
      profilesForPrompt[vendorName] = describeProfile(profile)
    }
    const overridesForPrompt = {}
    for (const [key, override] of Object.entries(currentOverridesMap)) {
      overridesForPrompt[key] = describeInvoiceOverride(override)
    }
    return { vendorProfiles: profilesForPrompt, invoiceOverrides: overridesForPrompt }
  }

  const getSourceClientName = (slug) => {
    return getClient(slug)?.displayName || slug
  }

  // ── Library actions ──────────────────────────────

  const handleOpenClient = (slug) => {
    const report = getLatestReport(slug)
    if (!report) return
    setActiveSlug(slug)
    setActiveReportId(report.id)
    setActiveReport(report)
    setSelectedVendor(null)
    setVendorNarrative(null)
    setView(VIEW_REPORT)
  }

  const handleOpenPeriod = (slug, reportId) => {
    const report = getReport(slug, reportId)
    if (!report) return
    setActiveSlug(slug)
    setActiveReportId(reportId)
    setActiveReport(report)
    setSelectedVendor(null)
    setVendorNarrative(null)
    setView(VIEW_REPORT)
  }

  const handleNewUpload = () => setView(VIEW_UPLOAD)
  const handleUploadNewPeriod = () => setView(VIEW_UPLOAD_SCOPED)

  const handleDeleteClient = (slug) => {
    deleteClient(slug)
    refreshLibrary()
  }

  // ── Upload action with new-vendor review ─────────

  const handleDataLoaded = async (parsedResult) => {
    const { clientName, asOfDate, vendors, aggregate, invoiceCount, rawCsv } = parsedResult

    const saveResult = saveReport({
      clientName,
      asOfDate,
      parsedData: { vendors, aggregate, invoiceCount },
      clientNarrative: null,
      rawCsv,
    })

    const justSaved = getReport(saveResult.slug, saveResult.reportId)
    setActiveSlug(saveResult.slug)
    setActiveReportId(saveResult.reportId)
    setActiveReport(justSaved)
    setSelectedVendor(null)
    setVendorNarrative(null)
    setView(VIEW_REPORT)
    refreshLibrary()

    // Check for vendors that don't have profiles yet — show the review modal
    const unprofiled = findUnprofiledVendors(saveResult.slug, vendors)
    if (unprofiled.length > 0) {
      setNewVendorsToReview({
        clientSlug: saveResult.slug,
        clientName,
        vendors: unprofiled,
      })
      // Don't generate the client narrative yet — wait for review to complete
    } else {
      // No new vendors to review — generate immediately
      generateClientNarrative(saveResult.slug, saveResult.reportId, clientName, vendors, aggregate)
    }
  }

  const handleNewVendorsComplete = () => {
    const target = newVendorsToReview
    setNewVendorsToReview(null)
    bumpProfiles()
    // Now generate the client narrative with profiles in place
    if (target && activeReport) {
      generateClientNarrative(target.clientSlug, activeReportId, target.clientName, activeReport.parsedData.vendors, activeReport.parsedData.aggregate)
    }
  }

  const handleNewVendorsSkip = () => {
    const target = newVendorsToReview
    setNewVendorsToReview(null)
    if (target && activeReport) {
      generateClientNarrative(target.clientSlug, activeReportId, target.clientName, activeReport.parsedData.vendors, activeReport.parsedData.aggregate)
    }
  }

  // ── Narrative generation ────────────────────────

  const generateClientNarrative = async (slug, reportId, clientName, vendors, aggregate) => {
    setLoadingClient(true)
    try {
      const ctx = buildPromptContext()
      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'client',
          clientName,
          vendors,
          aggregate,
          vendorProfiles: ctx.vendorProfiles,
          invoiceOverrides: ctx.invoiceOverrides,
        }),
      })
      const data = await res.json()
      const narrative = data.narrative || 'Error generating narrative.'
      saveClientNarrative(slug, reportId, narrative)
      setActiveReport(getReport(slug, reportId))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingClient(false)
    }
  }

  const generateVendorNarrative = async (vendor) => {
    setLoadingVendor(true)
    setVendorNarrative(null)
    try {
      const ctx = buildPromptContext()
      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vendor',
          clientName: activeSlug,
          vendor,
          vendorProfiles: ctx.vendorProfiles,
          invoiceOverrides: ctx.invoiceOverrides,
        }),
      })
      const data = await res.json()
      const narrative = data.narrative || 'Error generating narrative.'
      saveVendorNarrative(activeSlug, activeReportId, vendor.name, narrative)
      setVendorNarrative(narrative)
      setActiveReport(getReport(activeSlug, activeReportId))
    } catch (err) {
      setVendorNarrative('Error generating narrative.')
    } finally {
      setLoadingVendor(false)
    }
  }

  const generateVendorNarrativeSilent = async (vendor) => {
    try {
      const ctx = buildPromptContext()
      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vendor',
          clientName: activeSlug,
          vendor,
          vendorProfiles: ctx.vendorProfiles,
          invoiceOverrides: ctx.invoiceOverrides,
        }),
      })
      const data = await res.json()
      return { vendorName: vendor.name, narrative: data.narrative || 'No narrative generated.' }
    } catch (err) {
      return { vendorName: vendor.name, narrative: 'Error generating narrative.' }
    }
  }

  const ensureAllVendorNarratives = async () => {
    if (!activeReport) return {}
    const allVendors = activeReport.parsedData.vendors
    const existing = activeReport.vendorNarratives || {}
    const missing = allVendors.filter(v => !existing[v.name])

    if (missing.length === 0) return existing

    setExportPreparing(true)
    setExportProgress({ done: 0, total: missing.length })

    await Promise.all(
      missing.map(vendor =>
        generateVendorNarrativeSilent(vendor).then(result => {
          saveVendorNarrative(activeSlug, activeReportId, result.vendorName, result.narrative)
          setExportProgress(prev => ({ done: prev.done + 1, total: prev.total }))
          return result
        })
      )
    )

    const refreshed = getReport(activeSlug, activeReportId)
    setActiveReport(refreshed)
    setExportPreparing(false)
    setExportProgress({ done: 0, total: 0 })

    return refreshed?.vendorNarratives || existing
  }

  // ── Report actions ───────────────────────────────

  const handleSelectVendor = (vendor) => {
    setSelectedVendor(vendor)
    const cached = activeReport?.vendorNarratives?.[vendor.name]
    if (cached) {
      setVendorNarrative(cached)
      setLoadingVendor(false)
    } else {
      setVendorNarrative(null)
      generateVendorNarrative(vendor)
    }
  }

  const handleBackToClient = () => {
    setSelectedVendor(null)
    setVendorNarrative(null)
  }

  const handleSelectPeriod = (reportId) => {
    const report = getReport(activeSlug, reportId)
    if (!report) return
    setActiveReportId(reportId)
    setActiveReport(report)
    setSelectedVendor(null)
    setVendorNarrative(null)
  }

  const handleBackToLibrary = () => {
    setView(VIEW_LIBRARY)
    setActiveSlug(null)
    setActiveReportId(null)
    setActiveReport(null)
    setSelectedVendor(null)
    setVendorNarrative(null)
    refreshLibrary()
  }

  const handleRefreshNarrative = () => {
    if (!activeReport) return
    if (selectedVendor) {
      generateVendorNarrative(selectedVendor)
    } else {
      const { vendors, aggregate } = activeReport.parsedData
      generateClientNarrative(activeSlug, activeReportId, getClient(activeSlug).displayName, vendors, aggregate)
    }
  }

  // Regenerate draft email as a fallback when extraction fails.
  // Calls the AI to produce just the draft section, then merges it into the narrative.
  const handleRegenerateDraftEmail = async () => {
    if (!activeReport) return
    setRegeneratingEmail(true)
    try {
      if (selectedVendor) {
        // Vendor mode — regenerate the full vendor narrative (it includes the draft email)
        await generateVendorNarrative(selectedVendor)
      } else {
        // Client mode — regenerate the full client narrative
        const { vendors, aggregate } = activeReport.parsedData
        await generateClientNarrative(activeSlug, activeReportId, getClient(activeSlug).displayName, vendors, aggregate)
      }
    } finally {
      setRegeneratingEmail(false)
    }
  }

  // Quick-edit a single vendor from the triage queue
  const handleConfigureVendor = (vendorName) => {
    setQuickEditVendor(vendorName)
  }

  const handleQuickEditSave = (profile) => {
    if (!quickEditVendor) return
    saveVendorProfile(activeSlug, quickEditVendor, profile)
    setQuickEditVendor(null)
    bumpProfiles()
  }

  // ── Export handlers ──────────────────────────────

  const handleExportPDF = async () => {
    if (!activeReport) return
    const clientDisplayName = getClient(activeSlug)?.displayName || 'Client'

    if (selectedVendor) {
      let narrative = activeReport.vendorNarratives?.[selectedVendor.name]
      if (!narrative) {
        setExportPreparing(true)
        setExportProgress({ done: 0, total: 1 })
        const result = await generateVendorNarrativeSilent(selectedVendor)
        saveVendorNarrative(activeSlug, activeReportId, result.vendorName, result.narrative)
        narrative = result.narrative
        setExportProgress({ done: 1, total: 1 })
        setActiveReport(getReport(activeSlug, activeReportId))
        setExportPreparing(false)
      }
      exportVendorPDF({
        clientName: clientDisplayName,
        asOfDate: activeReport.asOfDate,
        vendor: selectedVendor,
        vendorNarrative: narrative,
      })
      return
    }

    const allNarratives = await ensureAllVendorNarratives()
    const fresh = getReport(activeSlug, activeReportId) || activeReport
    exportReportPDF({
      clientName: clientDisplayName,
      asOfDate: fresh.asOfDate,
      parsedData: fresh.parsedData,
      clientNarrative: fresh.clientNarrative,
      vendorNarratives: allNarratives,
    })
  }

  const handleExportWord = async () => {
    if (!activeReport) return
    const clientDisplayName = getClient(activeSlug)?.displayName || 'Client'

    if (selectedVendor) {
      let narrative = activeReport.vendorNarratives?.[selectedVendor.name]
      if (!narrative) {
        setExportPreparing(true)
        setExportProgress({ done: 0, total: 1 })
        const result = await generateVendorNarrativeSilent(selectedVendor)
        saveVendorNarrative(activeSlug, activeReportId, result.vendorName, result.narrative)
        narrative = result.narrative
        setExportProgress({ done: 1, total: 1 })
        setActiveReport(getReport(activeSlug, activeReportId))
        setExportPreparing(false)
      }
      exportVendorWord({
        clientName: clientDisplayName,
        asOfDate: activeReport.asOfDate,
        vendor: selectedVendor,
        vendorNarrative: narrative,
      })
      return
    }

    const allNarratives = await ensureAllVendorNarratives()
    const fresh = getReport(activeSlug, activeReportId) || activeReport
    exportReportWord({
      clientName: clientDisplayName,
      asOfDate: fresh.asOfDate,
      parsedData: fresh.parsedData,
      clientNarrative: fresh.clientNarrative,
      vendorNarratives: allNarratives,
    })
  }

  // ── Render ───────────────────────────────────────

  // Build the suggestion for the quick-edit modal (if vendor not yet configured)
  const quickEditProfile = quickEditVendor ? getVendorProfile(activeSlug, quickEditVendor) : null
  const quickEditSuggestion = (() => {
    if (!quickEditVendor || !activeSlug) return null
    const s = autoSuggestProfile(quickEditVendor, activeSlug)
    if (!s) return null
    return {
      profile: s.profile,
      sourceClientSlug: s.sourceClientSlug,
      sourceClientName: getSourceClientName(s.sourceClientSlug),
    }
  })()

  return (
    <>
      <Head>
        <title>AR/AP Aging Narrator</title>
        <meta name="description" content="AI-powered aging narrative library for outsourced accounting firms" />
      </Head>

      <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
        <Header onOpenSettings={() => setShowMasterConfig(true)} />

        <main className="max-w-7xl mx-auto px-6 py-8">
          {view === VIEW_LIBRARY && (
            <ClientLibrary
              clients={clients}
              onOpenClient={handleOpenClient}
              onOpenPeriod={handleOpenPeriod}
              onNewUpload={handleNewUpload}
              onDeleteClient={handleDeleteClient}
              onManageGroups={() => setShowGroupsPanel(true)}
            />
          )}

          {view === VIEW_UPLOAD && (
            <UploadPanel
              onDataLoaded={handleDataLoaded}
              onCancel={clients.length > 0 ? () => setView(VIEW_LIBRARY) : null}
            />
          )}

          {view === VIEW_UPLOAD_SCOPED && (
            <UploadPanel
              onDataLoaded={handleDataLoaded}
              onCancel={() => {
                if (activeSlug && activeReportId) {
                  const report = getReport(activeSlug, activeReportId)
                  if (report) {
                    setActiveReport(report)
                    setView(VIEW_REPORT)
                    return
                  }
                }
                handleBackToLibrary()
              }}
              expectedClient={getClient(activeSlug)?.displayName || ''}
            />
          )}

          {view === VIEW_REPORT && activeReport && (
            <>
              <ClientSummary
                clientName={getClient(activeSlug)?.displayName || 'Client'}
                asOfDate={activeReport.asOfDate}
                aggregate={activeReport.parsedData.aggregate}
                reports={getClient(activeSlug)?.reports || []}
                activeReportId={activeReportId}
                onSelectPeriod={handleSelectPeriod}
                onBackToLibrary={handleBackToLibrary}
                onUploadNewPeriod={handleUploadNewPeriod}
                onConfigureVendors={() => setShowVendorSettings(true)}
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div className="lg:col-span-1">
                  <VendorTriage
                    vendors={activeReport.parsedData.vendors}
                    selectedVendor={selectedVendor}
                    onSelectVendor={handleSelectVendor}
                    onBackToClient={handleBackToClient}
                    onConfigureVendor={handleConfigureVendor}
                    vendorProfiles={currentProfilesMap}
                  />
                </div>
                <div className="lg:col-span-2">
                <NarrativePanel
                    clientName={getClient(activeSlug)?.displayName || 'Client'}
                    asOfDate={activeReport.asOfDate}
                    vendor={selectedVendor}
                    aggregate={activeReport.parsedData.aggregate}
                    parsedData={activeReport.parsedData}
                    rawCsv={activeReport.rawCsv}
                    narrative={selectedVendor ? vendorNarrative : activeReport.clientNarrative}
                    loading={selectedVendor ? loadingVendor : loadingClient}
                    onRefresh={handleRefreshNarrative}
                    onExportPDF={handleExportPDF}
                    onExportWord={handleExportWord}
                    exportPreparing={exportPreparing}
                    exportProgress={exportProgress}
                    vendorProfile={selectedVendor ? currentProfilesMap[selectedVendor.name] : null}
                    onEditVendorProfile={selectedVendor ? () => setQuickEditVendor(selectedVendor.name) : null}
                    onRegenerateDraftEmail={handleRegenerateDraftEmail}
                    regeneratingEmail={regeneratingEmail}
                  />
                </div>
              </div>
            </>
          )}
        </main>

        {/* ── Modals ─────────────────────────────── */}

        {showMasterConfig && (
          <MasterConfigPanel onClose={() => setShowMasterConfig(false)} />
        )}

        {showVendorSettings && activeReport && (
          <VendorSettingsPanel
            clientSlug={activeSlug}
            clientName={getClient(activeSlug)?.displayName || 'Client'}
            reportId={activeReportId}
            vendors={activeReport.parsedData.vendors}
            onClose={() => { setShowVendorSettings(false); bumpProfiles() }}
            getSourceClientName={getSourceClientName}
          />
        )}

        {showGroupsPanel && (
          <ClientGroupsPanel
            clients={clients}
            onClose={() => { setShowGroupsPanel(false); refreshLibrary() }}
          />
        )}

        {quickEditVendor && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
            style={{ background: 'rgba(15,17,23,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setQuickEditVendor(null)}
          >
            <div
              className="w-full"
              style={{ maxWidth: '700px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <VendorProfileForm
                vendorName={quickEditVendor}
                initialProfile={quickEditProfile}
                suggestion={quickEditSuggestion}
                onSave={handleQuickEditSave}
                onCancel={() => setQuickEditVendor(null)}
              />
            </div>
          </div>
        )}

        {newVendorsToReview && (
          <NewVendorsModal
            clientSlug={newVendorsToReview.clientSlug}
            clientName={newVendorsToReview.clientName}
            newVendors={newVendorsToReview.vendors}
            onComplete={handleNewVendorsComplete}
            onSkip={handleNewVendorsSkip}
            getSourceClientName={getSourceClientName}
          />
        )}
      </div>
    </>
  )
}