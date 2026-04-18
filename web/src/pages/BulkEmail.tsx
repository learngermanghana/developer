import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import PageSection from '../layout/PageSection'
import { db } from '../firebase'
import { useActiveStore } from '../hooks/useActiveStore'
import { useWorkspaceIdentity } from '../hooks/useWorkspaceIdentity'

type Customer = {
  id: string
  name?: string
  displayName?: string
  email?: string
  updatedAt?: unknown
  createdAt?: unknown
}

type SendResult = {
  ok?: boolean
  attempted?: number
  sent?: number
  failed?: number
  queuedForRetry?: number
  error?: string
  [key: string]: unknown
}

function getCustomerName(customer: Pick<Customer, 'displayName' | 'name' | 'email'>) {
  const displayName = customer.displayName?.trim()
  if (displayName) return displayName
  const name = customer.name?.trim()
  if (name) return name
  const email = customer.email?.trim()
  if (email) return email
  return 'Unknown customer'
}

export default function BulkEmail() {
  const { storeId } = useActiveStore()
  const { name: workspaceName } = useWorkspaceIdentity()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [webAppUrl, setWebAppUrl] = useState('')
  const [sharedToken, setSharedToken] = useState('')
  const [fromName, setFromName] = useState(workspaceName || 'Sedifex Campaign')
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<string>('')
  const [sendError, setSendError] = useState<string>('')
  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  useEffect(() => {
    if (!workspaceName) return
    setFromName(prev => (prev ? prev : workspaceName))
  }, [workspaceName])

  useEffect(() => {
    if (!storeId) {
      setCustomers([])
      setSelectedIds(new Set())
      return undefined
    }

    const customerQuery = query(
      collection(db, 'customers'),
      where('storeId', '==', storeId),
      orderBy('updatedAt', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(500),
    )

    const unsubscribe = onSnapshot(customerQuery, snapshot => {
      const rows = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Customer, 'id'>),
      }))
      setCustomers(rows)
    })

    return () => unsubscribe()
  }, [storeId])

  const emailCustomers = useMemo(
    () =>
      customers.filter(customer => {
        const email = customer.email?.trim()
        return Boolean(email)
      }),
    [customers],
  )

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return emailCustomers
    return emailCustomers.filter(customer => {
      const text = `${getCustomerName(customer)} ${customer.email || ''}`.toLowerCase()
      return text.includes(term)
    })
  }, [emailCustomers, searchTerm])

  const selectedCustomers = useMemo(
    () => emailCustomers.filter(customer => selectedIds.has(customer.id)),
    [emailCustomers, selectedIds],
  )

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      filteredCustomers.forEach(customer => next.add(customer.id))
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleSend = async () => {
    setSendStatus('')
    setSendError('')
    setSendResult(null)

    if (!webAppUrl.trim()) {
      setSendError('Enter your Google Apps Script Web App URL.')
      return
    }
    if (!sharedToken.trim()) {
      setSendError('Enter your shared token.')
      return
    }
    if (!subject.trim()) {
      setSendError('Enter an email subject.')
      return
    }
    if (!html.trim()) {
      setSendError('Enter an email message.')
      return
    }
    if (!selectedCustomers.length) {
      setSendError('Select at least one customer with an email address.')
      return
    }

    setIsSending(true)

    try {
      const payload = {
        token: sharedToken.trim(),
        campaignId: `cmp_${Date.now()}`,
        fromName: fromName.trim() || 'Sedifex Campaign',
        subject: subject.trim(),
        html: html.trim(),
        recipients: selectedCustomers.map(customer => ({
          id: customer.id,
          name: getCustomerName(customer),
          email: customer.email?.trim() || '',
        })),
      }

      const response = await fetch(webAppUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const bodyText = await response.text()
      let body: SendResult = {}
      try {
        body = JSON.parse(bodyText) as SendResult
      } catch {
        body = { ok: false, error: bodyText || 'invalid-json-response' }
      }

      if (!response.ok || body.ok === false) {
        const errorMessage = typeof body.error === 'string' ? body.error : `send-failed (${response.status})`
        setSendError(errorMessage)
        setSendResult(body)
        return
      }

      setSendResult(body)
      setSendStatus('Campaign sent to Apps Script endpoint successfully.')
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to send campaign.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <PageSection
      title="Bulk email"
      subtitle="Set up your email integration and use Sedifex customer data as the audience source."
    >
      <div className="card" style={{ display: 'grid', gap: 16 }}>
        <h3 className="card__title">In-app email composer</h3>
        <p style={{ margin: 0 }}>
          This composer sends your campaign payload directly to your Google Apps Script Web App URL.
          Your script handles delivery (and optional queue retries).
        </p>
        <ul>
          <li>No duplicate customer entry in Google Sheets.</li>
          <li>Store-owned Google Sheet and Apps Script handle the send step.</li>
          <li>Sedifex passes campaign payload to your configured Apps Script endpoint.</li>
        </ul>
        <p style={{ margin: 0 }}>
          <strong>Why you do not see a message input here:</strong> this page is currently an
          integration setup page. The in-app email composer is not available on this screen yet.
        </p>
        <div
          style={{
            border: '1px solid var(--line, #d8deeb)',
            borderRadius: 12,
            padding: 14,
            background: 'var(--panel-muted, #f6f8fd)',
          }}
        >
          <h4 style={{ margin: '0 0 8px' }}>How to send right now</h4>
          <ol style={{ margin: 0, paddingInlineStart: 20, display: 'grid', gap: 6 }}>
            <li>Open <strong>Account → Integrations</strong> and connect your Google Apps Script URL + token.</li>
            <li>Keep your customers updated in <strong>Customers</strong> inside Sedifex.</li>
            <li>
              Use your Apps Script flow to send with Sedifex payload fields:
              <code> subject </code>
              and
              <code> html </code>
              (see setup guide).
            </li>
          </ol>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="button button--primary" onClick={handleSend} disabled={isSending}>
            {isSending ? 'Sending…' : 'Send bulk email'}
          </button>
          <Link className="button button--ghost" to="/docs/bulk-email-google-sheets-guide">
            Open setup guide
          </Link>
          <Link className="button button--ghost" to="/customers">
            Manage customers
          </Link>
          <Link className="button button--ghost" to="/docs/bulk-email-google-sheets-guide">
            Open setup guide
          </Link>
        </div>

        {sendStatus ? <p style={{ margin: 0, color: 'var(--success, #137333)' }}>{sendStatus}</p> : null}
        {sendError ? <p style={{ margin: 0, color: 'var(--danger, #b3261e)' }}>{sendError}</p> : null}
        {sendResult ? (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(sendResult, null, 2)}
          </pre>
        ) : null}
      </div>
    </PageSection>
  )
}
