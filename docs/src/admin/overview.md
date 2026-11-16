# Admin Overview

The Yet Another Status Page admin panel is powered by Payload CMS and provides a comprehensive interface for managing your status page.

## Dashboard

The dashboard shows at-a-glance metrics:

- **Active Incidents** (Aktive Störungen) - Current unresolved incidents
- **Upcoming Maintenances** (Geplante Wartungen) - Scheduled or in-progress maintenance windows
- **Draft Notifications** (Entwürfe) - Notifications waiting to be sent
- **Scheduled** (Geplant) - Notifications being processed
- **Email Subscribers** (E-Mail-Abonnenten) - Active email subscribers
- **SMS Subscribers** (SMS-Abonnenten) - Active SMS subscribers

Below the metrics, the card **System** shows which build is running: image tag, build date and commit (only if the image was built with build information, see [Build information](../getting-started/installation.md#build-information-optional)), the version from `package.json`, the Node.js version, the start time of the process, whether the process runs in a container and the last applied migration. A line with the tag and the build date, or the version for a build without image information, also appears at the bottom of the sidebar. If a value cannot be read, the card shows "unknown" instead of an error. Only signed-in users can see this information.

## Navigation

The admin panel is organized into sections:

### Status

- **Service Groups** - Logical groupings of services
- **Services** - Individual services to monitor
- **Incidents** - Service disruptions and issues
- **Maintenances** - Scheduled maintenance windows
- **Templates** - Ready-made titles and texts for incidents and maintenances, see [Templates](./templates.md)
- **Status log** - Automatic record of every service status change (read-only). See [Situation Overview](./situation-overview.md#status-log)

### Notifications

- **Notifications** - Manage and send notifications
- **Subscribers** - Manage subscriber list

### Admin

- **Users** - Admin user accounts (enable API keys here for programmatic access; see [Payload REST & GraphQL](../api/payload-rest.md#api-keys))
- **Media** - Uploaded files and images

### Configuration

- **Site Settings** - Site name, branding, SEO, status overrides, situation overview, localization
- **Email Settings** - SMTP configuration and email subscriptions
- **SMS Settings** - Twilio configuration, SMS subscriptions, and message templates

## Language of the admin panel

The admin panel uses the interface language of the server (`DEFAULT_LANGUAGE`, default English, see [Configuration](../getting-started/configuration.md#interface-language)). The menu names are:

| English | German |
|---------|--------|
| Status | Status |
| Service Groups | Dienstgruppen |
| Services | Dienste |
| Incidents | Störungen |
| Maintenances | Wartungen |
| Status log | Statusprotokoll |
| Notifications (section and collection) | Benachrichtigungen |
| Subscribers | Abonnenten |
| Admin | Administration |
| Users | Benutzer |
| Media | Medien |
| Configuration | Konfiguration |
| Site Settings | Website-Einstellungen |
| Email Settings | E-Mail-Einstellungen |
| SMS Settings | SMS-Einstellungen |

Field names, descriptions, buttons and messages of the admin panel are translated as well. Texts that editors enter themselves (titles, update messages) stay as entered.

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│  1. Create Services                                         │
│     Define your infrastructure components                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Incident Occurs                                         │
│     Create incident → Notification draft auto-created       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Review & Send                                           │
│     Go to Notifications → Review → Send                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Add Updates                                             │
│     Post updates → New notification drafts auto-created     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Resolve                                                 │
│     Mark resolved → Final notification                      │
└─────────────────────────────────────────────────────────────┘
```

## Quick Actions

### Creating an Incident

1. Go to **Status → Incidents**
2. Click **Create New**
3. Fill in the title, affected services, status, and impact
4. Click **Save**
5. A notification draft is automatically created

### Scheduling Maintenance

1. Go to **Status → Maintenances**
2. Click **Create New**
3. Set the title, affected services, and schedule
4. Click **Save**
5. A notification draft is automatically created

### Sending Notifications

1. Go to **Notifications → Notifications**
2. Find the draft notification
3. Review and edit the content if needed
4. Click **Send Notification Now**
