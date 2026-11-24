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

- **Settings** - Site configuration, SMTP, Twilio credentials, `lagebildVariant` (off, a, b)
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

- All texts live in language files in `locales/` (`de.json`, `en.json`). Each file has the blocks `meta`, `site` and `admin`. Texts of the status page, emails and feeds are in `site`: `t(key)` and `tf(key, vars)` from `src/lib/i18n/index.ts` return the text of the language set in `DEFAULT_LANGUAGE`.
- Texts of the admin panel (labels, descriptions, components) are in `admin`: `ta('English text')` from `src/lib/i18n/admin.ts`. The German translation is looked up by the English text. Without an entry the English text remains. If one English text needs two German wordings, the second gets the key `English text|context` and the call names the context as second argument (`ta('Admin', 'role')`). New contexts are added to the type `AdminTextContext`.
- The server reads the language files from `LOCALES_DIR` once at start and takes the language from `DEFAULT_LANGUAGE` (`src/lib/i18n/init.ts`). Server code uses `t()`, `tf()` and `ta()`. Client components get the texts from a React context (`I18nProvider`, `useTranslation()` in `src/lib/i18n/client.tsx`; `AdminTextProvider`, `useAdminText()` in `admin-client.tsx` for the admin panel). Modules that run in the browser must not import `@/lib/i18n` or `@/lib/i18n/admin` (they read files); they take `t` and `tf` as parameters or store translation keys. Payload's own admin texts follow the language through `i18n.supportedLanguages` in `payload.config.ts`.
- New texts: add the key to `site` in `locales/en.json` and the German text to `site` in `locales/de.json` (the type checker reports missing keys; `tests/unit/locales.test.ts` checks that both files have the same keys and placeholders), or for the admin panel an entry in `admin` in `locales/de.json`.

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
