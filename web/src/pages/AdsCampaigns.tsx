import React, { useEffect, useMemo, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { doc, onSnapshot } from 'firebase/firestore'
import { useLocation, useNavigate } from 'react-router-dom'

import { db, functions } from '../firebase'
import { useActiveStore } from '../hooks/useActiveStore'
import './AdsCampaigns.css'

type CampaignGoal = 'leads' | 'sales' | 'traffic' | 'calls' | 'awareness'
type CampaignStatus = 'draft' | 'live' | 'paused'

type GoogleAdsConnection = {
  connected: boolean
  accountEmail: string
  customerId: string
  managerId: string
  connectedAt?: unknown
}

type BillingConfirmation = {
  confirmed: boolean
  legalName: string
  confirmedAt?: unknown
}

type CampaignBrief = {
  goal: CampaignGoal
  location: string
  dailyBudget: number
  landingPageUrl: string
  headline: string
  description: string
}

type CampaignSnapshot = {
  status: CampaignStatus
  campaignId: string
  adGroupName: string
  updatedAt?: unknown
}

type PerformanceMetrics = {
  spend: number
  leads: number
  cpa: number
}

type AdsAutomationSettings = {
  connection: GoogleAdsConnection
  billing: BillingConfirmation
  brief: CampaignBrief
  campaign: CampaignSnapshot
  metrics: PerformanceMetrics
}

const DEFAULT_SETTINGS: AdsAutomationSettings = {
  connection: {
    connected: false,
    accountEmail: '',
    customerId: '',
    managerId: '',
  },
  billing: {
    confirmed: false,
    legalName: '',
  },
  brief: {
    goal: 'leads',
    location: '',
    dailyBudget: 30,
    landingPageUrl: '',
    headline: '',
    description: '',
  },
  campaign: {
    status: 'draft',
    campaignId: '',
    adGroupName: '',
  },
  metrics: {
    spend: 0,
    leads: 0,
    cpa: 0,
  },
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function parseSettings(raw: Record<string, unknown> | undefined): AdsAutomationSettings {
  const source = (raw?.googleAdsAutomation as Record<string, unknown> | undefined) ?? {}
  const connectionRaw = (source.connection as Record<string, unknown> | undefined) ?? {}
  const billingRaw = (source.billing as Record<string, unknown> | undefined) ?? {}
  const briefRaw = (source.brief as Record<string, unknown> | undefined) ?? {}
  const campaignRaw = (source.campaign as Record<string, unknown> | undefined) ?? {}
  const metricsRaw = (source.metrics as Record<string, unknown> | undefined) ?? {}

  const goal = typeof briefRaw.goal === 'string' ? briefRaw.goal : DEFAULT_SETTINGS.brief.goal
  const status = typeof campaignRaw.status === 'string' ? campaignRaw.status : DEFAULT_SETTINGS.campaign.status

  return {
    connection: {
      connected: connectionRaw.connected === true,
      accountEmail: typeof connectionRaw.accountEmail === 'string' ? connectionRaw.accountEmail : '',
      customerId: typeof connectionRaw.customerId === 'string' ? connectionRaw.customerId : '',
      managerId: typeof connectionRaw.managerId === 'string' ? connectionRaw.managerId : '',
      connectedAt: connectionRaw.connectedAt,
    },
    billing: {
      confirmed: billingRaw.confirmed === true,
      legalName: typeof billingRaw.legalName === 'string' ? billingRaw.legalName : '',
      confirmedAt: billingRaw.confirmedAt,
    },
    brief: {
      goal:
        goal === 'sales' || goal === 'traffic' || goal === 'calls' || goal === 'awareness' || goal === 'leads'
          ? goal
          : DEFAULT_SETTINGS.brief.goal,
      location: typeof briefRaw.location === 'string' ? briefRaw.location : '',
      dailyBudget: toNumber(briefRaw.dailyBudget, DEFAULT_SETTINGS.brief.dailyBudget),
      landingPageUrl: typeof briefRaw.landingPageUrl === 'string' ? briefRaw.landingPageUrl : '',
      headline: typeof briefRaw.headline === 'string' ? briefRaw.headline : '',
      description: typeof briefRaw.description === 'string' ? briefRaw.description : '',
    },
    campaign: {
      status: status === 'live' || status === 'paused' || status === 'draft' ? status : 'draft',
      campaignId: typeof campaignRaw.campaignId === 'string' ? campaignRaw.campaignId : '',
      adGroupName: typeof campaignRaw.adGroupName === 'string' ? campaignRaw.adGroupName : '',
      updatedAt: campaignRaw.updatedAt,
    },
    metrics: {
      spend: toNumber(metricsRaw.spend, 0),
      leads: Math.max(0, Math.round(toNumber(metricsRaw.leads, 0))),
      cpa: toNumber(metricsRaw.cpa, 0),
    },
  }
}

function toIso(value: unknown): string {
  if (!value) return '—'
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate()
    if (!Number.isNaN(date.getTime())) return date.toLocaleString()
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleString()
  return '—'
}

export default function AdsCampaigns() {
  const { storeId } = useActiveStore()
  const location = useLocation()
  const navigate = useNavigate()

  const [settings, setSettings] = useState<AdsAutomationSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const authCode = useMemo(() => new URLSearchParams(location.search).get('code') ?? '', [location.search])

  useEffect(() => {
    if (!storeId) {
      setSettings(DEFAULT_SETTINGS)
      return undefined
    }

    setLoading(true)
    const unsubscribe = onSnapshot(
      doc(db, 'storeSettings', storeId),
      snapshot => {
        setSettings(parseSettings(snapshot.data() as Record<string, unknown> | undefined))
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [storeId])

  const canLaunch =
    settings.connection.connected &&
    settings.billing.confirmed &&
    settings.brief.location.trim() &&
    settings.brief.landingPageUrl.trim() &&
    settings.brief.headline.trim() &&
    settings.brief.description.trim() &&
    settings.brief.dailyBudget > 0

  const campaignStateLabel = useMemo(() => {
    if (settings.campaign.status === 'live') return 'Live campaign is running.'
    if (settings.campaign.status === 'paused') return 'Campaign paused.'
    return 'Campaign draft is ready for launch.'
  }, [settings.campaign.status])

  async function withCall<T>(handler: () => Promise<T>) {
    setSubmitting(true)
    setNotice(null)
    try {
      await handler()
      setNotice('Saved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save right now.'
      setNotice(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStartOAuth() {
    if (!storeId) return
    await withCall(async () => {
      const callable = httpsCallable(functions, 'startGoogleAdsOAuth')
      const response = await callable({
        storeId,
        redirectUri: `${window.location.origin}/ads`,
      })
      const data = response.data as { authUrl?: string }
      if (!data.authUrl) throw new Error('Unable to start OAuth flow.')
      window.location.assign(data.authUrl)
    })
  }

  async function handleConnectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!storeId) return

    await withCall(async () => {
      const callable = httpsCallable(functions, 'connectGoogleAdsAccount')
      await callable({
        storeId,
        accountEmail: settings.connection.accountEmail,
        customerId: settings.connection.customerId,
        managerId: settings.connection.managerId,
        authorizationCode: authCode || undefined,
        redirectUri: `${window.location.origin}/ads`,
      })

      if (authCode) {
        navigate('/ads', { replace: true })
      }
    })
  }

  async function handleBillingConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!storeId) return
    if (!settings.billing.legalName.trim()) {
      setNotice('Enter the business legal name used for billing.')
      return
    }

    await withCall(async () => {
      const callable = httpsCallable(functions, 'upsertGoogleAdsBilling')
      await callable({ storeId, legalName: settings.billing.legalName })
    })
  }

  async function handleSaveBrief() {
    if (!storeId) return
    await withCall(async () => {
      const callable = httpsCallable(functions, 'upsertGoogleAdsCampaignBrief')
      await callable({ storeId, brief: settings.brief })
    })
  }

  async function handleCreateCampaign() {
    if (!storeId) return
    if (!canLaunch) {
      setNotice('Complete connection, billing confirmation, and campaign brief first.')
      return
    }

    await withCall(async () => {
      const callable = httpsCallable(functions, 'launchGoogleAdsCampaign')
      await callable({ storeId })
    })
  }

  async function handlePauseToggle() {
    if (!storeId || settings.campaign.status === 'draft') return
    await withCall(async () => {
      const callable = httpsCallable(functions, 'updateGoogleAdsCampaignStatus')
      const nextStatus = settings.campaign.status === 'paused' ? 'live' : 'paused'
      await callable({ storeId, status: nextStatus })
    })
  }

  return (
    <main className="ads-campaigns">
      <header className="ads-campaigns__header">
        <h1>Google Ads automation</h1>
        <p>Connect Google Ads, capture the campaign brief, and run campaigns from Sedifex.</p>
      </header>

      {loading ? <p className="ads-campaigns__status">Loading Google Ads workspace…</p> : null}
      {authCode ? <p className="ads-campaigns__status">OAuth code captured. Complete connection below.</p> : null}
      {notice ? <p className="ads-campaigns__status">{notice}</p> : null}

      <section className="ads-campaigns__section" aria-labelledby="google-connect">
        <div>
          <h2 id="google-connect">1) Connect Google Ads</h2>
          <p>Use OAuth, then link the account details used for campaign delivery.</p>
        </div>

        <div className="ads-campaigns__actions">
          <button type="button" className="button button--ghost" disabled={submitting} onClick={() => void handleStartOAuth()}>
            Start OAuth consent
          </button>
        </div>

        <form onSubmit={handleConnectSubmit} className="ads-campaigns__form-grid">
          <label>
            <span>Google account email</span>
            <input
              type="email"
              value={settings.connection.accountEmail}
              onChange={event =>
                setSettings(previous => ({
                  ...previous,
                  connection: { ...previous.connection, accountEmail: event.target.value },
                }))
              }
              placeholder="owner@business.com"
              required
            />
          </label>

          <label>
            <span>Google Ads customer ID</span>
            <input
              type="text"
              value={settings.connection.customerId}
              onChange={event =>
                setSettings(previous => ({
                  ...previous,
                  connection: { ...previous.connection, customerId: event.target.value },
                }))
              }
              placeholder="123-456-7890"
              required
            />
          </label>

          <label>
            <span>Manager account ID (optional)</span>
            <input
              type="text"
              value={settings.connection.managerId}
              onChange={event =>
                setSettings(previous => ({
                  ...previous,
                  connection: { ...previous.connection, managerId: event.target.value },
                }))
              }
              placeholder="098-765-4321"
            />
          </label>

          <div className="ads-campaigns__actions">
            <button type="submit" className="button button--primary" disabled={submitting}>
              {settings.connection.connected ? 'Update connection' : 'Connect Google Ads'}
            </button>
            <p>
              Connected: <strong>{settings.connection.connected ? 'Yes' : 'No'}</strong> · Last updated:{' '}
              {toIso(settings.connection.connectedAt)}
            </p>
          </div>
        </form>
      </section>

      <section className="ads-campaigns__section" aria-labelledby="billing-ownership">
        <div>
          <h2 id="billing-ownership">2) Confirm billing/account ownership</h2>
          <p>Save business ownership details used for ad billing approval.</p>
        </div>

        <form onSubmit={handleBillingConfirm} className="ads-campaigns__form-grid">
          <label>
            <span>Business legal name</span>
            <input
              value={settings.billing.legalName}
              onChange={event =>
                setSettings(previous => ({
                  ...previous,
                  billing: { ...previous.billing, legalName: event.target.value, confirmed: true },
                }))
              }
              placeholder="Sedifex Biz Ltd"
              required
            />
          </label>

          <div className="ads-campaigns__actions">
            <button type="submit" className="button button--primary" disabled={submitting}>
              Confirm ownership
            </button>
            <p>
              Confirmed: <strong>{settings.billing.confirmed ? 'Yes' : 'No'}</strong> · At {toIso(settings.billing.confirmedAt)}
            </p>
          </div>
        </form>
      </section>

      <section className="ads-campaigns__section" aria-labelledby="campaign-brief">
        <div>
          <h2 id="campaign-brief">3) Campaign brief</h2>
          <p>Define the goal, location, budget, and creative copy for launch.</p>
        </div>

        <div className="ads-campaigns__form-grid">
          <label>
            <span>Goal</span>
            <select
              value={settings.brief.goal}
              onChange={event =>
                setSettings(previous => ({
                  ...previous,
                  brief: { ...previous.brief, goal: event.target.value as CampaignGoal },
                }))
              }
            >
              <option value="leads">Leads</option>
              <option value="sales">Sales</option>
              <option value="traffic">Website traffic</option>
              <option value="calls">Phone calls</option>
              <option value="awareness">Brand awareness</option>
            </select>
          </label>

          <label>
            <span>Target location</span>
            <input
              value={settings.brief.location}
              onChange={event =>
                setSettings(previous => ({ ...previous, brief: { ...previous.brief, location: event.target.value } }))
              }
              placeholder="Accra, Kumasi"
            />
          </label>

          <label>
            <span>Daily budget (USD)</span>
            <input
              type="number"
              min={1}
              value={settings.brief.dailyBudget}
              onChange={event =>
                setSettings(previous => ({
                  ...previous,
                  brief: { ...previous.brief, dailyBudget: Number(event.target.value || 0) },
                }))
              }
            />
          </label>

          <label>
            <span>Landing page URL</span>
            <input
              type="url"
              value={settings.brief.landingPageUrl}
              onChange={event =>
                setSettings(previous => ({
                  ...previous,
                  brief: { ...previous.brief, landingPageUrl: event.target.value },
                }))
              }
              placeholder="https://your-domain.com/offer"
            />
          </label>

          <label>
            <span>Headline</span>
            <input
              value={settings.brief.headline}
              onChange={event =>
                setSettings(previous => ({ ...previous, brief: { ...previous.brief, headline: event.target.value } }))
              }
              placeholder="Get same-day delivery"
            />
          </label>

          <label>
            <span>Description</span>
            <textarea
              rows={4}
              value={settings.brief.description}
              onChange={event =>
                setSettings(previous => ({ ...previous, brief: { ...previous.brief, description: event.target.value } }))
              }
              placeholder="Order before 6pm and receive it today."
            />
          </label>

          <div className="ads-campaigns__actions">
            <button type="button" className="button button--ghost" disabled={submitting} onClick={() => void handleSaveBrief()}>
              Save brief
            </button>
          </div>
        </div>
      </section>

      <section className="ads-campaigns__section" aria-labelledby="campaign-control">
        <div>
          <h2 id="campaign-control">4) Launch + controls</h2>
          <p>{campaignStateLabel}</p>
        </div>

        <div className="ads-campaigns__actions ads-campaigns__actions--split">
          <button
            type="button"
            className="button button--primary"
            onClick={() => void handleCreateCampaign()}
            disabled={submitting || !canLaunch}
          >
            {settings.campaign.status === 'draft' ? 'Create campaign' : 'Update live campaign'}
          </button>

          <button
            type="button"
            className="button button--ghost"
            disabled={submitting || settings.campaign.status === 'draft'}
            onClick={() => void handlePauseToggle()}
          >
            {settings.campaign.status === 'paused' ? 'Resume campaign' : 'Pause campaign'}
          </button>
        </div>

        <div className="ads-campaigns__metrics-grid">
          <article>
            <h3>Spend</h3>
            <p>${settings.metrics.spend.toFixed(2)}</p>
          </article>
          <article>
            <h3>Leads</h3>
            <p>{settings.metrics.leads}</p>
          </article>
          <article>
            <h3>CPA</h3>
            <p>${settings.metrics.cpa.toFixed(2)}</p>
          </article>
          <article>
            <h3>Status</h3>
            <p>{settings.campaign.status.toUpperCase()}</p>
          </article>
        </div>
      </section>
    </main>
  )
}
