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
import { exportReportPDF } from '../lib/exportPDF'
import { exportReportWord } from '../lib/exportWord'

const VIEW_LIBRARY = 'library'
const VIEW_UPLOAD = 'upload'
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

  const handleNewUpload = () => {
    setView(VIEW_UPLOAD)
  }

  const handleDeleteClient = (slug) => {
    deleteClient(slug)
    refreshLibrary()
  }

  // ── Upload action ────────────────────────────────

  const handleDataLoaded = async (parsedResult) => {
    // parsedResult = { clientName, asOfDate, vendors, aggregate, invoiceCount }
    const { clientName, asOfDate, vendors, aggregate, invoiceCount } = parsedResult

    // Save initial record (no narrative yet)
    const saveResult = saveReport({
      clientName,
      asOfDate,
      parsedData: { vendors, aggregate, invoiceCount },
      clientNarrative: null,
    })

    // Open report immediately so user sees data
    const justSaved = getReport(saveResult.slug, saveResult.reportId)
    setActiveSlug(saveResult.slug)
    setActiveReportId(saveResult.reportId)
    setActiveReport(justSaved)
    setSelectedVendor(null)
    setVendorNarrative(null)
    setView(VIEW_REPORT)
    refreshLibrary()

    // Generate client narrative in background
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
      // Refresh the active report
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
        body: JSON.stringify({ mode: 'vendor', clientName: activeReport.parsedData.aggregate ? activeSlug : '', vendor }),
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

  // ── Report actions ───────────────────────────────

  const handleSelectVendor = (vendor) => {
    setSelectedVendor(vendor)
    // Check cache first
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

  // Export handlers — wired in Files 9 & 10
  const handleExportPDF = () => {
    if (!activeReport) return
    exportReportPDF({
      clientName: getClient(activeSlug)?.displayName || 'Client',
      asOfDate: activeReport.asOfDate,
      parsedData: activeReport.parsedData,
      clientNarrative: activeReport.clientNarrative,
      vendorNarratives: activeReport.vendorNarratives,
    })
  }
  const handleExportWord = () => {
    if (!activeReport) return
    exportReportWord({
      clientName: getClient(activeSlug)?.displayName || 'Client',
      asOfDate: activeReport.asOfDate,
      parsedData: activeReport.parsedData,
      clientNarrative: activeReport.clientNarrative,
      vendorNarratives: activeReport.vendorNarratives,
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