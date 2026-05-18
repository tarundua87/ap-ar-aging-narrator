import { useState } from 'react'
import Head from 'next/head'
import UploadPanel from '../components/UploadPanel'
import VendorTriage from '../components/VendorTriage'
import ClientSummary from '../components/ClientSummary'
import NarrativePanel from '../components/NarrativePanel'
import Header from '../components/Header'

export default function Dashboard() {
  const [clientName, setClientName] = useState('')
  const [vendors, setVendors] = useState([])
  const [aggregate, setAggregate] = useState(null)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [narrative, setNarrative] = useState(null)
  const [loadingNarrative, setLoadingNarrative] = useState(false)

  const generateClientNarrative = async (name, vendorList, agg) => {
    setLoadingNarrative(true)
    setNarrative(null)
    try {
      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'client', clientName: name, vendors: vendorList, aggregate: agg }),
      })
      const data = await res.json()
      setNarrative(data.narrative)
    } catch (err) {
      setNarrative('Error generating narrative. Please check your API key and try again.')
    } finally {
      setLoadingNarrative(false)
    }
  }

  const handleDataLoaded = ({ clientName, vendors, aggregate }) => {
    setClientName(clientName)
    setVendors(vendors)
    setAggregate(aggregate)
    setSelectedVendor(null)
    generateClientNarrative(clientName, vendors, aggregate)
  }

  const handleSelectVendor = async (vendor) => {
    setSelectedVendor(vendor)
    setNarrative(null)
    setLoadingNarrative(true)
    try {
      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'vendor', clientName, vendor }),
      })
      const data = await res.json()
      setNarrative(data.narrative)
    } catch (err) {
      setNarrative('Error generating narrative.')
    } finally {
      setLoadingNarrative(false)
    }
  }

  const handleBackToClient = () => {
    setSelectedVendor(null)
    generateClientNarrative(clientName, vendors, aggregate)
  }

  const handleReset = () => {
    setClientName('')
    setVendors([])
    setAggregate(null)
    setSelectedVendor(null)
    setNarrative(null)
  }

  return (
    <>
      <Head>
        <title>AR/AP Aging Narrator</title>
        <meta name="description" content="AI-powered aging narrative engine for outsourced accounting firms" />
      </Head>

      <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
        <Header />

        <main className="max-w-7xl mx-auto px-6 py-8">
          {vendors.length === 0 ? (
            <UploadPanel onDataLoaded={handleDataLoaded} />
          ) : (
            <>
              <ClientSummary clientName={clientName} aggregate={aggregate} onReset={handleReset} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div className="lg:col-span-1">
                  <VendorTriage
                    vendors={vendors}
                    selectedVendor={selectedVendor}
                    onSelectVendor={handleSelectVendor}
                    onBackToClient={handleBackToClient}
                  />
                </div>
                <div className="lg:col-span-2">
                  <NarrativePanel
                    clientName={clientName}
                    vendor={selectedVendor}
                    aggregate={aggregate}
                    narrative={narrative}
                    loading={loadingNarrative}
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