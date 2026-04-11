import React from 'react'

import GoogleBusinessMediaUploader from '../components/GoogleBusinessMediaUploader'
import { useActiveStore } from '../hooks/useActiveStore'
import { useGoogleIntegrationStatus } from '../hooks/useGoogleIntegrationStatus'
import './GoogleShopping.css'

export default function GoogleBusinessProfile() {
  const { storeId } = useActiveStore()
  const {
    isLoading,
    isStartingOAuth,
    isConnected,
    hasGoogleConnection,
    buttonLabel,
    stateTitle,
    startOAuth,
  } = useGoogleIntegrationStatus({
    integration: 'business',
    storeId,
  })



  return (
    <main className="google-shopping-page">
      <header className="google-shopping-page__header">
        <h1>Upload photos to your business on Google</h1>
        <p>
          Add photos to your Google business listing so customers can see them in Google Search and
          Google Maps.
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
                  ? 'Your Google account is connected. Allow Google Business Profile access to continue.'
                  : 'Your Google Business Profile connection is ready.'}
            </p>
            {isLoading ? <p className="google-shopping-panel__hint">Checking Google connection…</p> : null}
            {!isConnected && !isLoading ? (
              <button type="button" onClick={() => void startOAuth()} disabled={isStartingOAuth}>
                {isStartingOAuth ? 'Connecting…' : buttonLabel}
              </button>
            ) : null}
          </section>

          {isConnected ? (
            <GoogleBusinessMediaUploader
              storeId={storeId}
              onReconnectGoogle={() => void startOAuth()}
              isReconnectingGoogle={isStartingOAuth}
            />
          ) : null}
        </>
      )}
    </main>
  )
}
