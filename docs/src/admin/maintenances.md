# Managing Maintenances

Maintenances represent planned service interruptions or maintenance windows.

## Creating a Maintenance

1. Go to **Status → Maintenances** (Status → Wartungen)
2. Click **Create New**
3. Fill in the maintenance details:
   - **Title** - Brief description (e.g., "Database Migration")
   - **Description** - Detailed explanation (optional)
   - **Affected Services** - Select impacted services
   - **Scheduled Start** - When maintenance begins
   - **Scheduled End** - When maintenance ends (optional)
   - **Duration** - Human-readable duration (e.g., "~2 hours")
4. Click **Save**

A notification draft is automatically created when you save.

### Creating a Maintenance with a Template

If you keep ready-made texts as [templates](./templates.md), use the button **Create new with template** (Neu erstellen mit Vorlage) below the title of the list. It opens the same guided page as for incidents, with the type **Maintenance** preselected (see [Creating an Incident with a Template](./incidents.md#creating-an-incident-with-a-template)). The steps for a maintenance:

1. **Group** and **Affected services**: as for incidents.
2. **Period**: **Start** and **End** in the time zone of the settings (not the time zone of the browser). The end is optional. Without an end the timer does not complete the maintenance by itself. A start in the past is allowed, the page warns: the maintenance then changes its status right after it is created. If the chosen template uses `{{end}}` and the end is empty, the page says so, and the placeholder stays empty.
3. **Template**: the templates of the type maintenance with the status Upcoming are offered. You can also choose **Without a template**.
4. **Check and adjust**: title and text, and optionally the SMS text and the ntfy text, with the placeholders filled in (`{{start}}` and `{{end}}` as in the notifications, in the language and time zone of the installation).

**View preview** shows the maintenance as it appears on the status page and the notification draft. Only **Publish now** creates the maintenance with the status Upcoming. The text becomes the **first update** of the maintenance (status Upcoming), the description stays empty. Automatic start and completion stay switched on, as in the normal form. The notification draft contains the text of the first update, followed by the start and the end, and carries the SMS text and the ntfy text of the template. **Nothing is sent automatically.** The service states do not change.

## Maintenance Statuses

| Status | Description |
|--------|-------------|
| **Upcoming** (Geplant) | Scheduled but not yet started |
| **In Progress** (In Arbeit) | Currently underway |
| **Completed** (Abgeschlossen) | Successfully finished |
| **Cancelled** (Abgesagt) | Maintenance was cancelled |

## Auto-Status Updates

Enable automatic status transitions:

- **Auto-start on schedule** - Automatically changes to "In Progress" when the scheduled start time is reached
- **Auto-complete on schedule** - Automatically changes to "Completed" when the scheduled end time is reached

These can be enabled/disabled per maintenance. Both are on by default.

**What happens at the switch.** A timer in the server checks every minute for maintenances whose start or end has been reached. It does not depend on anyone opening the page. For each switch it

1. sets the new status (and stamps **Completed At** at the end),
2. adds an entry to the **Updates** of the maintenance ("The maintenance has started." or "The maintenance is completed."), which also shows in the history on the status page,
3. creates a notification draft for that entry and **sends it to the subscribers right away**, without a review.

A maintenance you set to "In Progress" or "Completed" yourself, or one with the checkbox switched off, is not switched and sends nothing. Each switch happens once, even with several server processes (they take a lock in the database). If the draft or the sending fails, the new status stays and the log shows `[Maintenances] Meldung zur Wartung ... fehlgeschlagen`; a draft that was created is left under **Notifications** for you to send.

A maintenance that is saved with a start or end time already in the past is switched at once while saving, without an entry and without a notification (the notification for the new maintenance is created as before).

Reading a maintenance whose schedule has passed shows the new status, but does not save it or send anything: only the timer saves the switch. Until the next timer run (at most about 75 seconds after the server starts, otherwise at most 60 seconds) the stored status is still the old one. To switch off the timer, see `DISABLE_MAINTENANCE_TIMER` in [Configuration](../getting-started/configuration.md). `POST /api/maintenances/process-due` runs the switch immediately (signed-in users only).

## Adding Updates

During maintenance, add updates to keep users informed:

1. Open the maintenance
2. Scroll to **Updates**
3. Click **Add Update**
4. Fill in:
   - **Status** - Current status
   - **Message** - Progress update
   - **Created At** - When this update occurred
5. Click **Save**

A new notification draft is automatically created for each update.

## Maintenance Permalinks

Each maintenance gets a unique short ID (e.g., `xyz789`) that creates a permanent link:

```
https://status.example.com/m/xyz789
```

## Notification Content

### Initial Notification (Email)

```
A maintenance window has been scheduled.

Scheduled Start: Sat, Jan 11 at 2:00 AM
Scheduled End: Sat, Jan 11 at 4:00 AM
Expected Duration: ~2 hours

We will notify you when the maintenance begins and completes.

View full details: https://status.example.com/m/xyz789
```

### Initial Notification (SMS)

```
🔧 MAINTENANCE: Database Migration

📅 Sat, Jan 11 at 2:00 AM - Sat, Jan 11 at 4:00 AM

We will notify you when maintenance begins and completes.

Details: https://status.example.com/m/xyz789
```

## Best Practices

### Scheduling

- Schedule during low-traffic periods
- Give users at least 24-48 hours notice
- Avoid scheduling during holidays or major events

### Communication

- Be clear about what will be affected
- Provide estimated duration
- Notify at key milestones (start, 50%, complete)

### Timing

- Send initial notification 24-48 hours before
- Send reminder 1-2 hours before
- Send "started" notification when beginning
- Send "completed" notification when done

## Example Timeline

```
┌─────────────────────────────────────────────────────────────┐
│ Database Migration                                          │
│ Scheduled: Jan 11, 2:00 AM - 4:00 AM EST                   │
├─────────────────────────────────────────────────────────────┤
│ 📅 Scheduled - Jan 9, 10:00 AM                              │
│    Scheduled maintenance for database migration.            │
├─────────────────────────────────────────────────────────────┤
│ 🔧 In Progress - Jan 11, 2:00 AM                           │
│    Maintenance has begun. Services may be unavailable.      │
├─────────────────────────────────────────────────────────────┤
│ 🔧 In Progress - Jan 11, 3:00 AM                           │
│    Migration 75% complete. On track for scheduled end.      │
├─────────────────────────────────────────────────────────────┤
│ ✅ Completed - Jan 11, 3:45 AM                              │
│    Maintenance completed successfully. All services         │
│    have been restored.                                      │
└─────────────────────────────────────────────────────────────┘
```
