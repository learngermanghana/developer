---
title: Event Planning and Client Collaboration
description: Developer guide to Sedifex Event Planning, secure client portals, program publishing, shared tasks, verification, and revision safety.
---

# Event Planning and Client Collaboration

_Last updated: 29 August 2026_

Sedifex Event Planning provides a store workspace for planning events and a secure client portal for collaboration. This guide explains the current workflow and the important implementation rules developers should preserve when extending the feature.

## 1. Staff event workspace

Primary routes:

```txt
/event-planning
/event-planning/:eventId
```

The Events page is the portfolio/list view. Staff can click the event name or **Open workspace** to open the detailed event.

The operational event tabs are designed to put the most-used tools first:

```txt
Client Portal
Checklist
Run Sheet
Program
<Event-specific Details>
Evaluation
```

The details tab changes with event type, for example `Wedding Details`, `Funeral Details`, or `Corporate Details`.

### Run Sheet vs Program

These are intentionally different:

- **Run Sheet**: internal staff/vendor schedule for the event day.
- **Program**: guest/client-facing order of activities.

Do not merge these data models simply because both contain times and activities.

## 2. Secure client portal

Stores can share one secure client portal link with the client.

The client portal is rendered by a Firebase HTTPS Function and currently uses four simple tabs:

```txt
My Event
Program
My Tasks
Updates
```

The selected tab is represented by a URL hash so refreshes can return the client to the same section.

Typical portal URL shape:

```txt
https://us-central1-sedifex-web.cloudfunctions.net/eventClientPortal?token=<secure-token>#tasks
```

The token is the access credential. Client code must not treat the event id alone as authorization.

## 3. Security boundary

The public client portal does not receive unrestricted Firestore access.

The model is:

```txt
Store shares portal
-> Sedifex generates a random bearer token
-> eventClientLinks/{tokenHash} stores the validation record keyed by the token hash
-> stores/{storeId}/events/{eventId}.clientPortal.publicUrl stores the full active URL, including the raw bearer token, so authorized store staff can copy/open it
-> client sends secure portal token to the HTTPS Function
-> Function validates the active portal link and event binding
-> Function reads/writes only allowed event fields
-> client receives sanitized portal data/HTML
```

The validation hash and the persisted staff-facing URL serve different purposes. The current implementation does **not** make the active credential non-recoverable because the token remains present inside `clientPortal.publicUrl`.

### Security consequence

Treat `clientPortal.publicUrl` as a secret-bearing field:

- Any authorized store user who can read the event document can recover and use the active client portal credential.
- Do not include the tokenized URL in public APIs, client-sanitized payloads, public logs, analytics events, or unauthenticated support output.
- Event-document read access must remain limited to authorized store members.
- Resharing/rotating the portal should replace the active credential and invalidate the previous link.
- Do not describe the implementation as “hash-only token storage” while `clientPortal.publicUrl` persists the full tokenized URL.

If a future hardening change removes raw-token persistence, the existing staff **Copy client link / Open client view** workflow will need an alternative such as one-time display, explicit regeneration, or encrypted/secret storage.

The public portal must not expose internal finance, staffing, vendor negotiation, or unshared checklist data.

When adding new client-editable fields, use an explicit allowlist. Never forward arbitrary event fields back into Firestore from the client payload.

## 4. Live event brief

The `My Event` tab lets the client edit selected event brief fields directly.

Current editable fields include:

```txt
Main requirements
Theme / colours
Venue requirements
Catering
Décor
Entertainment
Photography / video
Transport
Accommodation
Special instructions
```

These changes save to the event team's workspace.

Package scope, pricing, and other internal planning data remain staff-controlled.

### Developer rule

Use field-level updates for public brief writes. Do not replace the entire `clientBrief` object because that could erase staff-only fields such as package items.

## 5. Program workflow

Sedifex separates **publishing** from **client approval**.

The correct workflow is:

```txt
Staff builds draft program
-> Publish to client
-> client can view published program
-> optional client approval
-> optional change request
```

Publishing should not require the client to approve first.

### Approval not required

```txt
Publish to client
-> client sees program immediately
-> client can request a change
```

### Approval required

If staff enables **Require client approval**:

```txt
Publish to client
-> client sees program
-> Approve program OR Want something changed?
```

The current data model preserves historical `draft` / `approved` status values internally, so developers must use the separate publication/client-approval fields when determining whether the client personally approved a program.

## 6. Program change requests

Published programs are read-only in the client portal.

Clients can send a simple change request, for example:

```txt
Please move the couple entrance after the welcome speech.
```

Staff can accept or decline the request.

When a request is accepted, Sedifex preserves the last published revision and opens the next revision for staff editing.

## 7. Revision safety and concurrency

Program changes use server-side transactions because browser state can be stale in multi-staff sessions.

A safe published-program edit must:

```txt
1. Read current server publication state.
2. Archive the current published revision.
3. Increment the revision.
4. Open the new draft.
5. Apply the requested add/edit/delete.
```

Never rely only on a React state value such as `wasApproved` to decide whether an archive is needed.

### Content fingerprint

Approval is tied to both:

```txt
revision number
exact program-content fingerprint
```

This prevents one staff member from approving content after another staff member changed the same revision.

Fingerprint implementations must use identical normalization and locale-independent ordering on the browser and server.

## 8. Shared checklist tasks

Checklist tasks are internal by default.

Only tasks explicitly marked client-visible appear in `My Tasks`.

Conceptually:

```txt
clientVisible = false -> internal only
clientVisible = true  -> visible in client portal
```

Do not automatically expose all checklist tasks when a client portal is shared.

## 9. Simple client task completion

The client-facing task experience is deliberately simpler than the internal state machine.

Current UX:

```txt
Client opens My Tasks
-> sees task
-> ticks “I have done this”
-> optional note appears
-> clicks “Send to event team”
-> sees “Sent to event team” / “Waiting for confirmation”
```

The portal hides the older technical **Start task** step. When necessary for compatibility, the portal performs the required start transition before submitting the completion update.

This keeps the interface understandable for clients who may not be comfortable with project-management software.

### Friendly task states

Use client-facing wording similar to:

```txt
To do
Needs your attention
Sent to event team
Waiting for confirmation
Done
```

Avoid exposing raw states such as `submitted`, `changes_requested`, or `verified` unless building an internal/admin interface.

## 10. Staff verifies the client's completion

A client saying a task is complete does not automatically mark it verified.

Current staff flow:

```txt
Client submits task
-> staff sees Awaiting verification
-> staff chooses Verify OR Return to client
```

### Verify

Sedifex:

```txt
marks the checklist task done
marks the client task verified
records verification time/activity
updates event readiness/progress
```

### Return to client

Staff enters a note explaining what is still needed. The client sees the note under `My Tasks` and can resubmit.

### Current staff UI location

At present, the Verify/Return controls are implemented in the staff-side Client Portal collaboration dock on the detailed event route.

The newer top-level **Client Portal** operations tab is the natural future home for a “Needs your attention” verification queue, but that move is not yet part of the current production behavior. Treat it as planned UX, not shipped UX.

## 11. Progress meaning

Portal progress currently represents verified/done shared tasks.

Therefore the correct client-facing label is:

```txt
tasks verified
```

A task submitted by the client but still awaiting staff confirmation must not increase the verified percentage.

## 12. Activity and updates

Client/staff task activity feeds the `Updates` tab.

Examples include:

```txt
Client submitted task
Event team verified task
Event team returned task with note
```

Public activity should be filtered so clients do not receive activity for tasks that are not currently shared with them.

## 13. Draft protection and refresh behavior

The client portal refreshes periodically so staff changes appear without manual reloads.

Auto-refresh must pause while the client has unsent work, including:

```txt
unsaved live-brief changes
unsent program change request
unsent task note
checked “I have done this” task not yet sent
```

This avoids losing client input during the refresh cycle.

## 14. Core implementation map

The reference implementation lives in the core Sedifex repository: `learngermanghana/sedifex`. The `learngermanghana/developer` repository contains documentation and does not include the `functions/` source tree.

Important frontend files in `learngermanghana/sedifex`:

```txt
web/src/pages/EventPlanning.tsx
web/src/pages/EventWorkspace.tsx
web/src/components/EventOperationsWorkspace.tsx
web/src/components/EventChecklistShareCard.tsx
web/src/components/EventClientCollaborationDock.tsx
web/src/utils/eventProgramFingerprint.ts
```

Important Firebase Functions files in `learngermanghana/sedifex`:

```txt
functions/src/eventClientCollaboration.ts
functions/src/eventClientPortalPage.ts
functions/src/eventProgramCollaboration.ts
functions/src/eventProgramApproval.ts
```

Important regression test in `learngermanghana/sedifex`:

```txt
functions/test/eventClientCollaboration.test.js
```

## 15. Data model overview

Event-level data is stored below:

```txt
stores/{storeId}/events/{eventId}
```

Important event subcollections include:

```txt
tasks
program
programRevisions
programChangeRequests
clientActivity
```

Portal validation metadata is keyed separately under:

```txt
eventClientLinks/{tokenHash}
```

The event document also persists `clientPortal`, including `clientPortal.publicUrl`. Because that URL contains the active raw bearer token, access to the event document is part of the portal credential security boundary.

## 16. Deployment notes

There are two separate deployment surfaces:

### Web UI

Sedifex web production is deployed through Vercel. The frontend Vercel project uses `web/` as its project root, so `web/vercel.json` is the effective configuration.

Non-`main` branch deployments are intentionally skipped to avoid using the deployment quota on every feature-branch commit.

### Firebase Functions

The public `eventClientPortal` page is generated by Firebase Functions.

Changes to files under `functions/**` do not become live on the `cloudfunctions.net` URL just because a pull request merged. The main-branch Firebase Functions deployment must complete successfully.

## 17. Developer regression checklist

Before shipping Event Planning/client portal changes, verify:

- internal tasks remain private unless explicitly client-visible;
- client brief writes cannot overwrite staff pricing/package data;
- publishing and client approval remain separate concepts;
- published program edits preserve revision history;
- revision archives cannot be overwritten silently;
- program approval validates both revision and content fingerprint;
- browser/server fingerprint normalization remains identical;
- client can complete a task without a visible Start task step;
- checked-but-unsent task state is protected from automatic refresh;
- submitted tasks remain awaiting confirmation until staff verifies them;
- staff return notes appear to the client;
- verified-only progress is labelled `tasks verified`;
- security docs acknowledge that `clientPortal.publicUrl` currently contains a recoverable active bearer token for authorized staff use;
- in a clean checkout of the **core `learngermanghana/sedifex` repository** (run the commands from that repository root, not from `learngermanghana/developer`), run `npm --prefix functions run build` and then `npm --prefix functions run test:event-client`; the client collaboration renderer regression suite must pass;
- Firebase Functions production deployment completes before announcing a client-portal change as live.
