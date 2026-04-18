# Sedifex Bulk Email: Google Sheets + Apps Script Setup

Use this guide when each store should own its Google Sheet and Apps Script deployment, while Sedifex remains the single source of truth for customers.

## Architecture
- Sedifex stores customers and campaign audience logic.
- Store owner provides a Google Apps Script Web App endpoint.
- Sedifex sends campaign payload (`subject`, `html`, recipients JSON) to that endpoint.
- Apps Script sends emails and returns a summary to Sedifex.

## Setup steps
1. Store owner creates a Google Sheet.
2. In **Extensions → Apps Script**, paste the Sedifex Apps Script sample.
3. Add Script Property: `SEDIFEX_SHARED_TOKEN`.
4. Deploy as **Web App** and copy deployment URL.
5. In Sedifex, open **Account → Integrations → Bulk Email (Google Sheets)**.
6. Paste Web App URL + shared token, then verify connection.

## Sheet template (what the store should create)
Create one tab with this exact name:
- **Tab name:** `Recipients` *(change this in script if you use another name)*

Use row 1 as headers:

| Column | Header | What to put there |
|---|---|---|
| A | `email` | Customer email address (required) |
| B | `name` | Customer name (optional) |
| C | `status` | Leave blank. Script writes `SENT`, `SKIPPED`, or `ERROR`. |
| D | `last_sent_at` | Leave blank. Script writes timestamp after send. |
| E | `notes` | Optional internal notes. |

### Sample rows
| email | name | status | last_sent_at | notes |
|---|---|---|---|---|
| ama@example.com | Ama |  |  | VIP |
| kojo@example.com | Kojo |  |  | Follow up in May |

### Queue tab (for daily-limit overflow)
Add another tab for queued retries:
- **Tab name:** `EmailQueue` *(change in script if needed)*

| Column | Header | Purpose |
|---|---|---|
| A | `queued_at` | When message was queued |
| B | `email` | Recipient email |
| C | `name` | Recipient name (optional) |
| D | `subject` | Email subject |
| E | `html` | Email HTML body |
| F | `from_name` | Sender display name |
| G | `status` | `QUEUED`, `SENT`, or `ERROR` |
| H | `last_attempt_at` | Last retry time |
| I | `error` | Last error message |

## Where the topic and message go
- **Topic (email subject):** set in Sedifex campaign **Subject** field. It is sent as `payload.subject`.
- **Message (email body):** set in Sedifex campaign **Message** editor. It is sent as `payload.html`.
- The sheet is mainly for recipients (`email`, optional `name`) and delivery tracking (`status`, `last_sent_at`).
- In the script, these are used here:
  - `subject: payload.subject || 'Update from your store'`
  - `htmlBody: payload.html || ''`

If you want to type subject/body in Google Sheets instead, add columns like `subject` and `message_html`, then replace `payload.subject` and `payload.html` with those cell values.

## Apps Script sample (starter, with CHANGE ME markers)
> Paste this into **Extensions → Apps Script**. If needed, change the values under `CONFIG` to match your own sheet/tab/columns.

```javascript
function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}')
  const token = payload?.token || ''

  if (token !== PropertiesService.getScriptProperties().getProperty('SEDIFEX_SHARED_TOKEN')) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON)
  }

  // CHANGE ME: update these if your tab name or column layout is different.
  const CONFIG = {
    sheetTabName: 'Recipients', // CHANGE ME
    queueTabName: 'EmailQueue', // CHANGE ME
    headers: {
      email: 'email',           // CHANGE ME
      name: 'name',             // CHANGE ME
      status: 'status',         // CHANGE ME
      lastSentAt: 'last_sent_at' // CHANGE ME
    }
  }

  const recipientsFromPayload = Array.isArray(payload.recipients) ? payload.recipients : []
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(CONFIG.sheetTabName)

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: `sheet tab not found: ${CONFIG.sheetTabName}`,
    })).setMimeType(ContentService.MimeType.JSON)
  }

  const values = sheet.getDataRange().getValues()
  if (!values.length) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'sheet is empty' }))
      .setMimeType(ContentService.MimeType.JSON)
  }

  const headers = values[0].map((h) => (h || '').toString().trim().toLowerCase())
  const emailCol = headers.indexOf(CONFIG.headers.email.toLowerCase())
  const nameCol = headers.indexOf(CONFIG.headers.name.toLowerCase())
  const statusCol = headers.indexOf(CONFIG.headers.status.toLowerCase())
  const lastSentAtCol = headers.indexOf(CONFIG.headers.lastSentAt.toLowerCase())

  if (emailCol < 0) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: `missing required header: ${CONFIG.headers.email}`,
    })).setMimeType(ContentService.MimeType.JSON)
  }

  let attempted = 0
  let sent = 0
  const errors = []

  // Priority: use Sedifex payload recipients if provided; otherwise fall back to sheet rows.
  const sheetRows = values.slice(1).map((row, i) => ({
    rowIndex: i + 2,
    email: (row[emailCol] || '').toString().trim(),
    name: nameCol >= 0 ? (row[nameCol] || '').toString().trim() : '',
  }))

  const recipients = recipientsFromPayload.length
    ? recipientsFromPayload.map((r) => ({
        rowIndex: null,
        email: (r?.email || '').toString().trim(),
        name: (r?.name || '').toString().trim(),
      }))
    : sheetRows

  recipients.forEach((recipient) => {
    const email = recipient.email
    if (!email) {
      if (recipient.rowIndex && statusCol >= 0) {
        sheet.getRange(recipient.rowIndex, statusCol + 1).setValue('SKIPPED')
      }
      return
    }

    attempted += 1

    try {
      MailApp.sendEmail({
        to: email,
        subject: payload.subject || 'Update from your store',
        htmlBody: payload.html || '',
        name: payload.fromName || 'Sedifex Campaign',
      })
      sent += 1

      if (recipient.rowIndex && statusCol >= 0) {
        sheet.getRange(recipient.rowIndex, statusCol + 1).setValue('SENT')
      }
      if (recipient.rowIndex && lastSentAtCol >= 0) {
        sheet.getRange(recipient.rowIndex, lastSentAtCol + 1).setValue(new Date())
      }
    } catch (err) {
      const message = String(err)
      errors.push({ email, message })

      // Queue when daily send limit/quota is reached.
      if (isDailyLimitError(message)) {
        enqueueEmail(ss, CONFIG.queueTabName, {
          email,
          name: recipient.name || '',
          subject: payload.subject || 'Update from your store',
          html: payload.html || '',
          fromName: payload.fromName || 'Sedifex Campaign',
          error: message,
        })
      }

      if (recipient.rowIndex && statusCol >= 0) {
        sheet
          .getRange(recipient.rowIndex, statusCol + 1)
          .setValue(isDailyLimitError(message) ? 'QUEUED' : 'ERROR')
      }
    }
  })

  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    attempted,
    sent,
    failed: attempted - sent,
    queuedForRetry: errors.filter((e) => isDailyLimitError(e.message)).length,
    errors,
  })).setMimeType(ContentService.MimeType.JSON)
}

function isDailyLimitError(message) {
  const text = (message || '').toLowerCase()
  return text.includes('limit exceeded') || text.includes('quota')
}

function getOrCreateQueueSheet(ss, queueTabName) {
  const sheet = ss.getSheetByName(queueTabName) || ss.insertSheet(queueTabName)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'queued_at',
      'email',
      'name',
      'subject',
      'html',
      'from_name',
      'status',
      'last_attempt_at',
      'error',
    ])
  }
  return sheet
}

function enqueueEmail(ss, queueTabName, item) {
  const queueSheet = getOrCreateQueueSheet(ss, queueTabName)
  queueSheet.appendRow([
    new Date(),
    item.email || '',
    item.name || '',
    item.subject || '',
    item.html || '',
    item.fromName || '',
    'QUEUED',
    '',
    item.error || '',
  ])
}

/**
 * Optional: run this with a time-based trigger every 15-60 minutes.
 * It retries queued emails after daily limits reset.
 */
function processEmailQueue() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const queueSheet = getOrCreateQueueSheet(ss, 'EmailQueue') // CHANGE ME if renamed
  const values = queueSheet.getDataRange().getValues()
  if (values.length <= 1) return

  const data = values.slice(1)
  data.forEach((row, idx) => {
    const rowNumber = idx + 2
    const status = (row[6] || '').toString().trim().toUpperCase()
    if (status !== 'QUEUED') return

    const email = (row[1] || '').toString().trim()
    if (!email) return

    try {
      MailApp.sendEmail({
        to: email,
        subject: (row[3] || '').toString(),
        htmlBody: (row[4] || '').toString(),
        name: (row[5] || 'Sedifex Campaign').toString(),
      })
      queueSheet.getRange(rowNumber, 7).setValue('SENT') // status
      queueSheet.getRange(rowNumber, 8).setValue(new Date()) // last_attempt_at
      queueSheet.getRange(rowNumber, 9).setValue('') // error
    } catch (err) {
      queueSheet.getRange(rowNumber, 8).setValue(new Date())
      queueSheet.getRange(rowNumber, 9).setValue(String(err))
    }
  })
}
```

## Payload example from Sedifex
```json
{
  "token": "shared-secret",
  "campaignId": "cmp_2026_04_18_001",
  "fromName": "Acme Store",
  "subject": "Weekend Promo",
  "html": "<p>Hello {{name}}, enjoy 10% off this weekend.</p>",
  "recipients": [
    { "id": "cus_1", "name": "Ama", "email": "ama@example.com" },
    { "id": "cus_2", "name": "Kojo", "email": "kojo@example.com" }
  ]
}
```

## Important notes
- Keep customer records in Sedifex only (no duplicate manual entry).
- Google sending quotas apply.
- If quota is reached, script can queue unsent emails to `EmailQueue` and retry later with a time-based trigger.
- Rotate shared tokens when ownership/staff changes.
