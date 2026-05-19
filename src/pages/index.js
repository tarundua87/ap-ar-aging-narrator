import { useState, useEffect } from 'react'
import Head from 'next/head'
import Header from '../components/Header'
import ClientLibrary from '../components/ClientLibrary'
import UploadPanel from '../components/UploadPanel'
import ClientSummary from '../components/ClientSummary'
import VendorTriage from '../components/VendorTriage'
import NarrativePanel from '../components/NarrativePanel'
import {
  listClients, getClient, getLatestReport, getReport,
  saveReport, saveVendorNarrative, saveClientNarrative,
  deleteClient, deleteReport,
} from '../lib/storage'
import { exportReportPDF, exportVendorPDF } from '../lib/exportPDF'
import { exportReportWord, exportVendorWord } from '../lib/exportWord'

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

  // Initial load
  useEffect(() => {
    refreshLibrary()
  }, [])

  const refreshLibrary = () => {
    setClients(listClients())
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

  const handleNewUpload = () => {
    setView(VIEW_UPLOAD)
  }

  const handleUploadNewPeriod = () => {
    setView(VIEW_UPLOAD_SCOPED)
  }

  const handleDeleteClient = (slug) => {
    deleteClient(slug)
    refreshLibrary()
  }

  // ── Upload action ────────────────────────────────

  const handleDataLoaded = async (parsedResult) => {
    const { clientName, asOfDate, vendors, aggregate, invoiceCount } = parsedResult

    const saveResult = saveReport({
      clientName,
      asOfDate,
      parsedData: { vendors, aggregate, invoiceCount },
      clientNarrative: null,
    })

    const justSaved = getReport(saveResult.slug, saveResult.reportId)
    setActiveSlug(saveResult.slug)
    setActiveReportId(saveResult.reportId)
    setActiveReport(justSaved)
    setSelectedVendor(null)
    setVendorNarrative(null)
    setView(VIEW_REPORT)
    refreshLibrary()

    generateClientNarrative(saveResult.slug, saveResult.reportId, clientName, vendors, aggregate)
  }

  // ── Narrative generation ────────────────────────

  const generateClientNarrative = async (slug, reportId, clientName, vendors, aggregate) => {
    setLoadingClient(true)
    try {
      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'client', clientName, vendors, aggregate }),
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
      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'vendor', clientName: activeSlug, vendor }),
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

  // Silent vendor narrative for batch export prep
  const generateVendorNarrativeSilent = async (vendor) => {
    try {
      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'vendor', clientName: activeSlug, vendor }),
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

  return (
    <>
      <Head>
        <title>AR/AP Aging Narrator</title>
        <meta name="description" content="AI-powered aging narrative library for outsourced accounting firms" />
      </Head>

      <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
        <Header />

        <main className="max-w-7xl mx-auto px-6 py-8">
          {view === VIEW_LIBRARY && (
            <ClientLibrary
              clients={clients}
              onOpenClient={handleOpenClient}
              onOpenPeriod={handleOpenPeriod}
              onNewUpload={handleNewUpload}
              onDeleteClient={handleDeleteClient}
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
              onCancel={() => setView(VIEW_REPORT)}
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
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div className="lg:col-span-1">
                  <VendorTriage
                    vendors={activeReport.parsedData.vendors}
                    selectedVendor={selectedVendor}
                    onSelectVendor={handleSelectVendor}
                    onBackToClient={handleBackToClient}
                  />
                </div>
                <div className="lg:col-span-2">
                  <NarrativePanel
                    clientName={getClient(activeSlug)?.displayName || 'Client'}
                    asOfDate={activeReport.asOfDate}
                    vendor={selectedVendor}
                    aggregate={activeReport.parsedData.aggregate}
                    narrative={selectedVendor ? vendorNarrative : activeReport.clientNarrative}
                    loading={selectedVendor ? loadingVendor : loadingClient}
                    onRefresh={handleRefreshNarrative}
                    onExportPDF={handleExportPDF}
                    onExportWord={handleExportWord}
                    exportPreparing={exportPreparing}
                    exportProgress={exportProgress}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}