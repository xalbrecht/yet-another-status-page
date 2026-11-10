# Architecture

Yet Another Status Page is built with modern technologies for reliability and developer experience.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| CMS | Payload CMS 3.x |
| Database | PostgreSQL |
| Styling | Tailwind CSS |
| Rich Text | Lexical Editor |

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                               │
│  (Browsers, API Consumers, Email Clients, SMS)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  Status Pages   │  │   Admin Panel   │  │  REST API   │ │
│  │  (Frontend)     │  │  (Payload CMS)  │  │  Endpoints  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Payload CMS Core                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Collections │  │   Globals   │  │    Jobs Queue       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│  ┌─────────────────┐           ┌─────────────────┐         │
│  │   SMTP Server   │           │     Twilio      │         │
│  │   (Email)       │           │     (SMS)       │         │
│  └─────────────────┘           └─────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### Collections

```
┌─────────────────┐     ┌─────────────────┐
│  ServiceGroups  │────▶│    Services     │
│  - name         │     │  - name         │
│  - description  │     │  - status       │
│  - order        │     │  - group        │
└─────────────────┘     └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
           ┌─────────────────┐  ┌─────────────────┐
           │   Incidents     │  │  Maintenances   │
           │  - title        │  │  - title        │
           │  - status       │  │  - status       │
           │  - impact       │  │  - schedule     │
           │  - updates[]    │  │  - updates[]    │
           └─────────────────┘  └─────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    ┌─────────────────┐
                    │  Notifications  │
                    │  - title        │
                    │  - channel      │
                    │  - status       │
                    │  - content      │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Subscribers   │
                    │  - type         │
                    │  - email/phone  │
                    │  - active       │
                    └─────────────────┘
```

Further collections:

- **ServiceStatusEvents** (`service-status-events`) - Log of status changes: `service`, `status`, `changedAt`. Written only by the `afterChange` hook of Services (also on create), removed with the service. Read access requires login. Basis of the situation overview.
- Incidents have the field `impact` (degraded, partial, major). Their hooks call `syncServiceStatusesFromIncidents` (`src/lib/service-status-sync.ts`).
- ServiceGroups have the field `icon` (name of a `lucide-react` icon, list in `src/lib/group-icons.ts`).

### Globals

- **Settings** - Site configuration, SMTP, Twilio credentials, `lagebildVariant` (off, a, b, both)
- **EmailSettings**, **SmsSettings** - Mail and SMS configuration

## Request Flow

### Status Page Request

```
Browser → Next.js → Server Component → Payload API → PostgreSQL
                          ↓
                    Rendered HTML
```

### Admin Panel Request

```
Browser → Next.js → Payload Admin → Payload API → PostgreSQL
                          ↓
                    React SPA
```

### Notification Flow

```
Save Incident → afterChange Hook → Create Notification Draft
                                          ↓
                              Admin Reviews Draft
                                          ↓
                              Click "Send Now"
                                          ↓
                              API Queues Job
                                          ↓
                              Jobs Queue Processes
                                          ↓
                              SMTP/Twilio Sends
                                          ↓
                              Update Notification Status
```

### Service Status Flow

```
Save Incident (affectedServices, impact)
        ↓ afterChange
syncServiceStatusesFromIncidents
   worst impact of all open incidents, or Operational
        ↓ update Service (only if the status changes)
Service afterChange Hook → Create entry in service-status-events
```

### Situation Overview Request

```
Browser → Next.js → page.tsx → loadLagebild (src/lib/lagebild.ts)
                                  ↓ reads groups, services, status log (last 14 days),
                                    incidents, maintenances
                       computeBarRuns / computePeriods
                                  ↓
                       <Lagebild> (client component: tiles, bars, filter)
```

The status log gives each service a timeline of statuses. A group has the worst known status of its services. The bars take one value per 5 minutes for 12 hours, the list takes the periods without status Operational for 14 days. The page loads the data only if `lagebildVariant` is not `off`.

## Internationalization

- Texts of the status page, emails and feeds: `src/lib/i18n/` (`en.ts`, `de.ts`, `index.ts`). `t(key)` and `tf(key, vars)` return the text of the build language.
- Texts of the admin panel (labels, descriptions, components): `ta('English text')` from `src/lib/i18n/admin.ts`. The German translation is looked up by the English text. Without an entry the English text remains.
- The language is read once at build time from `NEXT_PUBLIC_UI_LANG` (`de` default, `en`). Payload's own admin texts follow it through `i18n.supportedLanguages` in `payload.config.ts`.
- New texts: add the English key to `en.ts` and the German text to `de.ts` (the type checker reports missing German keys), or for the admin panel an entry in `admin.ts`.

## Key Design Decisions

### Why Payload CMS?

- Modern, TypeScript-first CMS
- Excellent admin UI out of the box
- Flexible data modeling
- Built-in authentication
- Jobs queue for background tasks

### Why Next.js App Router?

- Server components for performance
- Streaming and suspense support
- Built-in API routes
- Excellent developer experience

### Why PostgreSQL?

- Robust and reliable
- Excellent JSON support
- Widely supported
- Easy to backup and scale

### Why Separate Notifications Collection?

- Audit trail of all notifications
- Review before sending
- Retry failed notifications
- Clear status tracking

## Scaling Considerations

### Horizontal Scaling

- Application is stateless
- Can run multiple instances behind load balancer
- Shared PostgreSQL database

### Database

- Connection pooling (PgBouncer)
- Read replicas for high traffic
- Regular backups

### Jobs Queue

- Can add dedicated worker processes
- Automatic retries on failure
- Scales with subscriber count
