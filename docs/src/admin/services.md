# Managing Services

Services represent the components of your infrastructure that you want to display on the status page.

## Service Groups

Service groups organize related services together.

### Creating a Service Group

1. Go to **Status → Service Groups** (Status → Dienstgruppen)
2. Click **Create New**
3. Enter a name (e.g., "Core Infrastructure", "API Services")
4. Optionally add a description
5. Optionally choose an **Icon** (used in the [Situation Overview](./situation-overview.md)). The field shows all 47 icons with their names in a grid, for example for networks, specialist applications, construction or schools. Click an icon to choose it, or move between the icons with the arrow keys. The chosen icon is highlighted. On update, existing groups with the default icon get a matching icon by name. A different icon can be chosen at any time.
6. Click **Save**

### Ordering Groups

Drag and drop service groups to reorder them on the status page.

## Services

Services are individual components within a group.

### Creating a Service

1. Go to **Status → Services** (Status → Dienste)
2. Click **Create New**
3. Fill in:
   - **Name** - Display name (e.g., "API Gateway")
   - **Description** - Brief description
   - **Service Group** - Which group it belongs to
   - **Status** - Current operational status
   - **Start** - First day the service is operated (default: today). Before this day the service does not appear on the status page
   - **End** - Last day the service is operated. Leave empty while the service is operated
4. Click **Save**

### Start, End and Deleting

A service is **active** from the start day up to and including the end day. The start is the beginning of that day, the end is the end of that day, in the time zone of the installation. Nothing is stored for "active": it is calculated whenever a page or the report is read, so a service ends by itself on the day after its end date.

- A service that has ended, or has not started yet, does not appear on the status page, in the [Situation Overview](./situation-overview.md), in the API (`/api/v1`) or in the incident wizard. A group with no active services is not shown.
- To retire a service, set an **End** date. The end must not be before the start.
- A service can only be deleted **after** its end. Deleting an active service, or one whose end is still in the future, is refused (HTTP 409 in the API). Deleting also removes the service's entries from the status log. The [availability report](./availability-report.md) then no longer contains the service, not even for past periods. As long as a service is only ended, the report can still evaluate it with the switch **Include ended services**.
- The edit page of an existing service shows a note with the number of status log entries that would be deleted.
- The migration set the start of all existing services to the earliest of 1 January 2025, the first status log entry and the creation date of the service.

### Service Statuses

| Status | German | Color | Description |
|--------|--------|-------|-------------|
| Operational | Betriebsbereit | 🟢 Green | Service is working normally |
| Degraded Performance | Eingeschränkt | 🟡 Yellow | Service is slow or partially impaired |
| Partial Outage | Teilausfall | 🟠 Orange | Some functionality unavailable |
| Major Outage | Schwerer Ausfall | 🔴 Red | Service is completely unavailable |
| Under Maintenance | Wartung | 🔵 Blue | Service is undergoing planned maintenance |

Every status change is written to the **status log** with its time. The [Situation Overview](./situation-overview.md) is calculated from it.

### Automatic Status Updates

Incidents set the status of their affected services:

- Saving an incident sets the **Impact on affected services** (Auswirkung auf betroffene Dienste) on every affected service.
- If several open incidents affect a service, the worst impact applies.
- When the last open incident of a service is resolved, the service returns to **Operational**. A service in **Under Maintenance** stays in maintenance.
- Removing a service from an incident, or deleting the incident, re-evaluates that service.

Maintenance windows do **not** change the service status. Set **Under Maintenance** by hand when work starts and reset it afterwards.

Next to the status dot, the status page shows a **maintenance notice** for a service when a maintenance that affects it is running ("Maintenance until 22:00") or starts within the next 24 hours ("Maintenance 20:00 – 22:00"). The notice comes from the entered maintenance (start, end and status), not from the service status. A service can therefore show a partial outage and a running maintenance at the same time. Completed and cancelled maintenances, and maintenances that start later than 24 hours from now, show no notice.

You can also change the status by hand at any time. A manual status stays until an incident for that service is saved or resolved.

## Best Practices

### Naming

- Use clear, user-facing names
- Avoid internal jargon
- Be consistent with naming conventions

### Grouping

- Group by function (e.g., "Core", "APIs", "Integrations")
- Keep groups manageable (5-10 services each)
- Consider your users' perspective

### Granularity

- Not too broad (users need to know what's affected)
- Not too narrow (too many services is overwhelming)
- Aim for 10-30 total services for most deployments
