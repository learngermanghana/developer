import React from 'react'
import { Link } from 'react-router-dom'
import PageSection from '../layout/PageSection'

export default function BulkEmail() {
  return (
    <PageSection
      title="Bulk email"
      subtitle="Set up your email integration and use Sedifex customer data as the audience source."
    >
      <div className="card" style={{ display: 'grid', gap: 16 }}>
        <h3 className="card__title">Single source of truth</h3>
        <p>
          Sedifex is your customer source of truth. Stores should manage customers in Sedifex only,
          then Sedifex passes recipients to the connected Google Apps Script endpoint as JSON when
          sending.
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
          <Link className="button button--primary" to="/customers">
            Manage customers
          </Link>
          <Link className="button button--ghost" to="/account">
            Configure integrations
          </Link>
          <Link className="button button--ghost" to="/docs/bulk-email-google-sheets-guide">
            Open setup guide
          </Link>
        </div>
      </div>
    </PageSection>
  )
}
