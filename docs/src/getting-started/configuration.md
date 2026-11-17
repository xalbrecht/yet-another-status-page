# Configuration

Yet Another Status Page is configured through environment variables and the admin panel.

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URI` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `PAYLOAD_SECRET` | Secret key for encryption (min 32 chars) - [Generate one](https://payloadsecret.com/) | `your-super-secret-key-here-32ch` |
| `SERVER_URL` | Public URL of your status page | `https://status.example.com` |

> **Note**: On Vercel, both `POSTGRES_URL` and `SERVER_URL` are automatically detected:
> - `POSTGRES_URL` is set when you add a Vercel Postgres database
> - `SERVER_URL` falls back to `VERCEL_PROJECT_PRODUCTION_URL` or `VERCEL_URL` if not explicitly set
>
> The app supports both `DATABASE_URI` and `POSTGRES_URL` for database connections.

### Vercel Deployment

When deploying to Vercel, you need to configure Vercel Blob storage for media uploads (since Vercel's filesystem is read-only):

| Variable | Description | How to Get |
|----------|-------------|------------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | [Create a Blob store](https://vercel.com/docs/storage/vercel-blob/quickstart) in your Vercel project |

**Steps to set up Vercel Blob:**

1. Go to your Vercel project dashboard
2. Navigate to **Storage** → **Create Database** → **Blob**
3. Copy the `BLOB_READ_WRITE_TOKEN` from the environment variables
4. The token is automatically added to your deployment environment

> **Note**: Media uploads will not work on Vercel without Vercel Blob storage configured.

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `production` |
| `PAYLOAD_AUTO_GENERATE` | Set to `false` to stop Payload from rewriting `src/payload-types.ts` and the admin import map in development (the test compose file sets it) | `true` |
| `LAGEBILD_CACHE_SECONDS` | How long the [situation overview](../admin/situation-overview.md) is cached for all visitors (0 to 3600, `0` switches the cache off) | `60` |

### SSO/OIDC Authentication (Optional)

Enable Single Sign-On with any OIDC-compliant identity provider (Keycloak, Okta, Auth0, Azure AD, Google).

| Variable | Description | Default |
|----------|-------------|---------|
| `OIDC_CLIENT_ID` | OAuth2 client ID | - |
| `OIDC_CLIENT_SECRET` | OAuth2 client secret | - |
| `OIDC_AUTH_URL` | Authorization endpoint | - |
| `OIDC_TOKEN_URL` | Token endpoint | - |
| `OIDC_USERINFO_URL` | User info endpoint | - |
| `OIDC_SCOPES` | OAuth scopes | `openid profile email` |
| `OIDC_AUTO_CREATE` | Create users on first login | `true` |
| `OIDC_ALLOWED_GROUPS` | Comma-separated list of allowed groups | (allow all) |
| `OIDC_GROUP_CLAIM` | Claim name containing groups | `groups` |
| `OIDC_DISABLE_LOCAL_LOGIN` | Disable password login (SSO-only) | `false` |

#### Provider-Specific URLs

**Keycloak:**
```env
OIDC_AUTH_URL=https://keycloak.example.com/realms/{realm}/protocol/openid-connect/auth
OIDC_TOKEN_URL=https://keycloak.example.com/realms/{realm}/protocol/openid-connect/token
OIDC_USERINFO_URL=https://keycloak.example.com/realms/{realm}/protocol/openid-connect/userinfo
```

**Okta:**
```env
OIDC_AUTH_URL=https://{domain}.okta.com/oauth2/default/v1/authorize
OIDC_TOKEN_URL=https://{domain}.okta.com/oauth2/default/v1/token
OIDC_USERINFO_URL=https://{domain}.okta.com/oauth2/default/v1/userinfo
```

**Auth0:**
```env
OIDC_AUTH_URL=https://{tenant}.auth0.com/authorize
OIDC_TOKEN_URL=https://{tenant}.auth0.com/oauth/token
OIDC_USERINFO_URL=https://{tenant}.auth0.com/userinfo
```

**Azure AD:**
```env
OIDC_AUTH_URL=https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
OIDC_TOKEN_URL=https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
OIDC_USERINFO_URL=https://graph.microsoft.com/oidc/userinfo
```

**Google:**
```env
OIDC_AUTH_URL=https://accounts.google.com/o/oauth2/v2/auth
OIDC_TOKEN_URL=https://oauth2.googleapis.com/token
OIDC_USERINFO_URL=https://openidconnect.googleapis.com/v1/userinfo
```

#### Callback URL

When configuring your identity provider, set the callback/redirect URL to:
```
https://your-status-page.com/api/users/oauth/callback
```

#### Group-Based Access Control

To restrict access to specific groups from your identity provider:

1. Configure your IdP to include group claims in the userinfo response
2. Set `OIDC_ALLOWED_GROUPS` to a comma-separated list of allowed groups
3. If your IdP uses a different claim name, set `OIDC_GROUP_CLAIM`

**Example Keycloak Setup:**

1. Create a client scope named "groups" with a **Group Membership** mapper:
   - Token Claim Name: `groups`
   - Add to userinfo: On
2. Add the scope to your client
3. Configure the status page:

```env
OIDC_SCOPES=openid profile email groups
OIDC_ALLOWED_GROUPS=status-page-admins,status-page-editors
```

#### SSO-Only Mode

To disable password login and require SSO for all users:

```env
OIDC_DISABLE_LOCAL_LOGIN=true
```

> **Warning**: Ensure SSO is working correctly before enabling this option, or you may lock yourself out!

## Interface Language

The language of the status page, notification emails, feeds and the admin panel comes from **language files**. The server reads them once when it starts. A change needs a restart, not a new build.

| Variable | Meaning | Default |
|----------|---------|---------|
| `DEFAULT_LANGUAGE` | Language code of the interface, written exactly like the file name, for example `de`, `en` or `fr` (lower case, no `de-DE`). | `en` |
| `LOCALES_DIR` | Directory with the language files. | `locales` in the working directory |

**Language files.** Each language is one JSON file named after its language code (`de.json`, `en.json`, `fr.json`). The code must be one of the languages Payload knows (the texts of the admin panel's own buttons come from Payload). The repository folder `locales/` holds `de.json` and `en.json`. They are also the template for a new language: copy `en.json`, rename it, translate the values. A file has the blocks `meta` (`name` as shown to users), `site` (status page, emails, feeds) and `admin` (admin panel, the English text is the key).

**Missing texts.** A text missing in a file is shown in English. A text missing in the file of `de` or `en` comes from the German or English texts built into the image.

**Without a directory.** If the directory does not exist, is empty or cannot be read, the server uses the built-in German and English texts and `DEFAULT_LANGUAGE` chooses between them (`de` or `en`). The built-in texts are part of the image, so a mounted directory (which hides any `locales` folder inside the image) never leaves the interface without texts. The log names the reason (`[i18n] …`). The same applies if a file is invalid or `DEFAULT_LANGUAGE` names a language that was not loaded: the file is skipped or German is used, and the log says why.

Where to set it:

| Situation | Where |
|-----------|-------|
| English (default) | Nothing to set |
| Docker | Environment `DEFAULT_LANGUAGE`, and a volume for your files, for example `./locales:/app/locales:ro` with `LOCALES_DIR=/app/locales` |
| Helm | Values `language` and `locales.files` (see [Helm](./helm.md#interface-language)) |
| Local development | `.env` or the shell, for example `DEFAULT_LANGUAGE=en npm run dev` (the folder `locales/` of the repository is read) |
| E2E tests | `DEFAULT_LANGUAGE=en` in the environment of the server under test |

**Upgrading.** The build variable `NEXT_PUBLIC_UI_LANG` is no longer read. The log says so when the variable is still set (`[i18n] NEXT_PUBLIC_UI_LANG wird nicht mehr gelesen …`). The default language is English. An installation that ran in German without `DEFAULT_LANGUAGE` (German was the default before) shows English after the update: set `DEFAULT_LANGUAGE=de` before you update. The language is not a setting in the admin panel: it comes from `DEFAULT_LANGUAGE` and changes with a restart. The setting **Locale** (date and time format) is empty after the update and then follows the language (`de` gives `de-DE`, a 24-hour clock). A value you saved earlier is kept, except the old default `en-US`, which the update resets to empty.

Check your files with `npm run check:locales [directory]`. It reports missing or surplus keys (warnings) and placeholders such as `{timezone}` or `{{siteName}}` that differ from the English text (errors).

To add a language of your own, see [Adding a Language](./adding-a-language.md).

Menu names in this manual are given in English followed by the German name, for example **Status → Incidents** (German: **Status → Störungen**). A full list is in the [Admin Overview](../admin/overview.md#language-of-the-admin-panel).

The setting **Locale** (below) only controls the date and time format. Empty, it follows the language.

## Admin Panel Settings

The admin panel has three configuration sections under **Configuration**:

### Site Settings

Access **Configuration → Site Settings** (Konfiguration → Website-Einstellungen) to configure:

- **Site Name**: Displayed in the header and emails
- **Site Description**: Meta description for SEO
- **Favicon**: Custom favicon for your status page
- **Logos**: Light and dark theme logos
- **SEO**: Meta titles and descriptions
- **Status Override**: Maintenance mode and custom messages
- **Situation overview** (Lagebild): **Display** (List (original), Situation overview A, Situation overview B or Situation overview A and B for testing), **Look-back period**, **Bar period** and, for the situation overview options (A, B and A and B), **Entries per box**, **Content of the boxes** and **Boxes on narrow screens** (see [Situation Overview](../admin/situation-overview.md))
- **Localization**: Timezone, locale, and week start (see below)

#### Localization

These settings control the **admin calendar** and the **site clock** visitors see.

| Setting | Description | Default |
|---------|-------------|---------|
| Timezone | IANA timezone for timestamps, history week boundaries, and admin date pickers | `UTC` |
| Locale | BCP 47 locale for date/time formatting (e.g. `en-US`, `de-DE`, `fr-FR`). Empty follows the language (`DEFAULT_LANGUAGE`). To force German dates and a 24-hour clock use `de-DE` | empty |
| Week starts on | First day of the week for incident history and admin date pickers | Monday |

Public pages always show the **site timezone**, not the visitor’s local time, so “maintenance at 15:00” means the same instant for everyone. A footer notice explains this (for example: “All times in Europe/Berlin. This is the status page timezone.”). Individual timestamps also include a short zone abbreviation.

Admin date pickers use the same timezone, locale, and week start, so times you enter match what visitors see.

### Email Settings

Access **Configuration → Email Settings** (Konfiguration → E-Mail-Einstellungen) to configure email notifications:

| Setting | Description |
|---------|-------------|
| Enable Email Subscriptions | Allow users to subscribe via email |
| SMTP Host | Your mail server hostname |
| SMTP Port | Usually 587 (TLS) or 465 (SSL) |
| SMTP Security | None, TLS, or SSL |
| SMTP Username | Authentication username |
| SMTP Password | Authentication password |
| From Address | Sender email address |
| From Name | Sender display name |
| Reply-To | Reply-to address (optional) |

### SMS Settings

Access **Configuration → SMS Settings** (Konfiguration → SMS-Einstellungen) to configure SMS notifications:

| Setting | Description |
|---------|-------------|
| Enable SMS Subscriptions | Allow users to subscribe via SMS |
| Account SID | Your Twilio Account SID |
| Auth Token | Your Twilio Auth Token |
| From Number | Your Twilio phone number (required if not using Messaging Service) |
| Messaging Service SID | Alternative to From Number for better deliverability |

#### SMS Templates

You can customize the SMS message templates with these placeholders:

| Placeholder | Description |
|-------------|-------------|
| `{{siteName}}` | Your site name from Site Settings |
| `{{title}}` | Incident or maintenance title |
| `{{status}}` | Current status (e.g., Investigating, Resolved) |
| `{{message}}` | Update message content |
| `{{schedule}}` | Maintenance schedule (maintenance only) |
| `{{url}}` | Link to the incident/maintenance page |

Available templates:
- **New Incident Template** - For initial incident notifications
- **Incident Update Template** - For incident status updates
- **New Maintenance Template** - For scheduled maintenance announcements
- **Maintenance Update Template** - For maintenance status updates

You can also configure **Title Max Length** and **Message Max Length** to control truncation.

## Testing Notifications

After configuring SMTP or Twilio:

1. Create a test subscriber in **Notifications → Subscribers** (Benachrichtigungen → Abonnenten)
2. Create a test incident in **Status → Incidents** (Status → Störungen)
3. Check the **Notifications** collection for the auto-generated draft
4. Click **Send Notification Now** to test

## Security Recommendations

1. **Use strong secrets**: Generate a random 32+ character string for `PAYLOAD_SECRET`
2. **Use HTTPS**: Always deploy behind HTTPS in production
3. **Secure database**: Use strong passwords and restrict database access
4. **Regular backups**: Schedule regular database backups
