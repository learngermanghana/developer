import React, { useEffect, useMemo, useState } from 'react'

import { fetchGoogleIntegrationOverview, startGoogleOAuth, type GoogleIntegrationStatus } from '../api/googleIntegrations'
import GoogleBusinessMediaUploader from '../components/GoogleBusinessMediaUploader'
import { useActiveStore } from '../hooks/useActiveStore'
import './GoogleShopping.css'

export default function GoogleBusinessProfile() {
  const { storeId } = useActiveStore()
  const [status, setStatus] = useState<GoogleIntegrationStatus>('Needs permission')
  const [hasGoogleConnection, setHasGoogleConnection] = useState(false)
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const oauthState = params.get('googleOAuth')
    if (!oauthState) return

    if (oauthState === 'success') {
      setMessage(params.get('message') || 'Google connected successfully.')
    } else {
      setMessage(params.get('message') || 'Google OAuth failed.')
    }

    params.delete('googleOAuth')
    params.delete('message')
    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    window.history.replaceState({}, '', nextUrl)
  }, [])

  useEffect(() => {
    if (!storeId) {
      setStatus('Needs permission')
      setHasGoogleConnection(false)
      return
    }

    let mounted = true
    setLoading(true)
    fetchGoogleIntegrationOverview(storeId)
      .then((overview) => {
        if (!mounted) return
        setStatus(overview.statuses.business)
        setHasGoogleConnection(overview.hasGoogleConnection)
      })
      .catch((error) => {
        if (!mounted) return
        setMessage(error instanceof Error ? error.message : 'Unable to load Google integration status.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [storeId])

  const isConnected = status === 'Connected'
  const stateTitle = useMemo(() => {
    if (!hasGoogleConnection) return '1) Connect Google'
    if (!isConnected) return '2) Grant Google Business access'
    return '3) Connected'
  }, [hasGoogleConnection, isConnected])
  const buttonLabel = !hasGoogleConnection ? 'Connect Google' : 'Grant Google Business access'

  async function handleConnect() {
    if (!storeId || connecting) return
    setConnecting(true)
    setMessage('')
    try {
      const url = await startGoogleOAuth({ storeId, integrations: ['business'] })
      window.location.assign(url)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start Google OAuth.')
      setConnecting(false)
    }
  }

  return (
    <main className="google-shopping-page">
      <header className="google-shopping-page__header">
        <h1>Google Business Profile</h1>
        <p>
          Upload location media directly to Google Business Profile. Sedifex stores only media metadata
          after Google confirms upload.
        </p>
      </header>

      {!storeId ? (
        <section className="google-shopping-panel">
          <p>Please choose a store first.</p>
        </section>
      ) : (
        <>
          <section className="google-shopping-panel">
            <h2>{stateTitle}</h2>
            <p>
              {!hasGoogleConnection
                ? 'Connect your Google account to continue.'
                : !isConnected
                  ? 'Your Google account is connected. Grant Google Business Profile access to continue.'
                  : 'Google Business Profile access is connected for this store.'}
            </p>
            {loading ? <p className="google-shopping-panel__hint">Checking Google connection…</p> : null}
            {!isConnected && !loading ? (
              <button type="button" onClick={handleConnect} disabled={connecting}>
                {connecting ? 'Connecting…' : buttonLabel}
              </button>
            ) : null}
            {message ? <p className="google-shopping-panel__hint">{message}</p> : null}
          </section>

          {isConnected ? <GoogleBusinessMediaUploader storeId={storeId} /> : null}
        </>
      )}
    </main>
  )
}
