# Managing Incidents

Incidents represent unplanned service disruptions or issues affecting your infrastructure.

## Creating an Incident

1. Go to **Status → Incidents** (Status → Störungen)
2. Click **Create New**
3. Fill in the incident details:
   - **Title** - Brief description (e.g., "API Gateway Latency Issues")
   - **Affected Services** - Select impacted services
   - **Impact on affected services** - Status the affected services receive while the incident is open (Degraded Performance, Partial Outage or Major Outage). Once the incident is resolved, the services return to Operational, unless another open incident still affects them. Every status change is recorded in the status log.
   - **Status** - Current investigation status
4. Click **Save**

A notification draft is automatically created when you save.

### Creating an Incident with a Template

If you keep ready-made texts as [templates](./templates.md), use the button **Create new with template** (Neu erstellen mit Vorlage) below the title of the list. It opens a guided page:

1. **Group**: choose the service group.
2. **Affected services**: choose all services of the group or single ones. Services that already have an open incident carry the note "open incident". It does not prevent you from continuing. If you choose all services of a group, you decide whether the text lists them one by one or says "all services of the group ...".
3. **Template**: the templates of the type incident with the status Investigating are offered, because this is a new message. You can also choose **Without a template** and write title and text yourself.
4. **Impact**: preset by the template, you can change it. It sets the state of the affected services.
5. **Check and adjust**: title and text, and optionally the SMS text and the ntfy text, with the placeholders already filled in (see [Placeholders](./templates.md#placeholders)). All texts stay editable. The counters show the limits of 320 characters for SMS and 500 for ntfy. `{{link}}` stays in the text until you publish and is then replaced by the address of the incident.

If you change the services, the naming or the template afterwards, the texts are filled in again from the template, and your own changes are lost.

**View preview** shows what happens before anything is saved: the incident as it appears on the status page, the new state of every service and the notification draft with email, SMS and ntfy text. Only **Publish now** creates the incident. It then behaves like an incident created in the normal form: the incident is public at once, the services get the chosen state, the status log gets an entry and a notification draft is created. **Nothing is sent automatically.** You review and send the draft under **Notifications**. If you filled in an SMS text or an ntfy text, the draft carries them (the field **SMS Message** and the field **ntfy message**).

The same texts are kept on the first update of the incident in two hidden fields that only signed-in users can read. The normal form does not show them, the public API does not return them.

In every incident, `{{link}}` in the title or in an update text is replaced by the address of the incident when the incident is saved.

## Incident Statuses

| Status | Description |
|--------|-------------|
| **Investigating** (Wird untersucht) | Issue detected, investigating cause |
| **Identified** (Ursache gefunden) | Root cause identified, working on fix |
| **Monitoring** (Wird beobachtet) | Fix applied, monitoring for stability |
| **Resolved** (Behoben) | Issue fully resolved |

### Status Flow

```
Investigating → Identified → Monitoring → Resolved
```

You can skip statuses if appropriate (e.g., go directly to Resolved for quick fixes).

## Impact on Affected Services

The field **Impact on affected services** (Auswirkung auf betroffene Dienste) is set when you create the incident, like the component status in Cachet. It is the status the affected services receive while the incident is open. Default: Degraded Performance.

| Impact | German | Display |
|--------|--------|---------|
| Degraded Performance | Eingeschränkt | 🟡 Yellow |
| Partial Outage | Teilausfall | 🟠 Orange |
| Major Outage | Schwerer Ausfall | 🔴 Red |

- Saving the incident sets this status on all affected services.
- With several open incidents on one service, the worst impact applies.
- When the incident is resolved, the services return to **Operational**, unless another open incident still affects them. A service in maintenance stays in maintenance.
- Every change appears in the **status log** and in the [Situation Overview](./situation-overview.md).

Change the impact later by editing the field and saving. The services follow.

## Adding Updates

As the incident progresses, add updates to the timeline:

1. Open the incident
2. Scroll to **Updates**
3. Click **Add Update**
4. Fill in:
   - **Status** - Current status
   - **Message** - Update details
   - **Created At** - When this update occurred
5. Click **Save**

A new notification draft is automatically created for each update.

## Resolving an Incident

1. Open the incident
2. Change **Status** to "Resolved"
3. The **Resolved At** timestamp is automatically set
4. Click **Save**
5. Review and send the final notification

## Incident Permalinks

Each incident gets a unique short ID (e.g., `abc123`) that creates a permanent link:

```
https://status.example.com/i/abc123
```

This link is included in notifications and remains valid even if the title changes.

## Best Practices

### Titles

- Be specific but concise
- Include the affected component
- Avoid blame or technical jargon

Good: "Payment Processing Delays"
Bad: "Database server crashed due to OOM killer"

### Updates

- Post updates every 30-60 minutes during active incidents
- Be honest about what you know and don't know
- Set expectations for next update

### Resolution

- Confirm the issue is fully resolved before closing
- Include a brief summary of what happened
- Thank users for their patience

## Example Timeline

```
┌─────────────────────────────────────────────────────────────┐
│ API Gateway Latency Issues                                  │
├─────────────────────────────────────────────────────────────┤
│ 🟡 Investigating - 10:00 AM                                 │
│    We are investigating reports of slow API responses.      │
├─────────────────────────────────────────────────────────────┤
│ 🟡 Identified - 10:30 AM                                    │
│    Root cause identified as a misconfigured load balancer.  │
│    Our team is implementing a fix.                          │
├─────────────────────────────────────────────────────────────┤
│ 🟢 Monitoring - 11:00 AM                                    │
│    Fix deployed. We are monitoring for stability.           │
├─────────────────────────────────────────────────────────────┤
│ 🟢 Resolved - 11:30 AM                                      │
│    This incident has been resolved. API response times      │
│    have returned to normal.                                 │
└─────────────────────────────────────────────────────────────┘
```
