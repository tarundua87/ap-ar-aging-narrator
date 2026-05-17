import { useState } from 'react'
import Head from 'next/head'
import UploadPanel from '../components/UploadPanel'
import TriageQueue from '../components/TriageQueue'
import NarrativePanel from '../components/NarrativePanel'
import Header from '../components/Header'

export default function Dashboard() {
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [narrative, setNarrative] = useState(null)
  const [loadingNarrative, setLoadingNarrative] = useState(false)

  const handleDataLoaded = (parsedClients) => {
    setClients(parsedClients)
    setSelectedClient(null)
    setNarrative(null)
  }

  const handleSelectClient = async (client) => {
    setSelectedClient(client)
    setNarrative(null)
    setLoadingNarrative(true)

    try {
      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client }),
      })
      const data = await res.json()
      setNarrative(data.narrative)
    } catch (err) {
      setNarrative('Error generating narrative. Please check your API key and try again.')
    } finally {
      setLoadingNarrative(false)
    }
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
          {clients.length === 0 ? (
            <UploadPanel onDataLoaded={handleDataLoaded} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <TriageQueue
                  clients={clients}
                  selectedClient={selectedClient}
                  onSelectClient={handleSelectClient}
                  onReset={() => { setClients([]); setSelectedClient(null); setNarrative(null) }}
                />
              </div>
              <div className="lg:col-span-2">
                <NarrativePanel
                  client={selectedClient}
                  narrative={narrative}
                  loading={loadingNarrative}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
