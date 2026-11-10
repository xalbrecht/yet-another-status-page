# Managing Services

Services represent the components of your infrastructure that you want to display on the status page.

## Service Groups

Service groups organize related services together.

### Creating a Service Group

1. Go to **Status → Service Groups** (Status → Dienstgruppen)
2. Click **Create New**
3. Enter a name (e.g., "Core Infrastructure", "API Services")
4. Optionally add a description
5. Optionally choose an **Icon** (used in the [Situation Overview](./situation-overview.md))
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
4. Click **Save**

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
