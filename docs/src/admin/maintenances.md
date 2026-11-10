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

These can be enabled/disabled per maintenance.

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
