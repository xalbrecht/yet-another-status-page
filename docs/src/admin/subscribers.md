# Managing Subscribers

Subscribers receive notifications about incidents and maintenance windows.

## Subscription Types

| Type | Description |
|------|-------------|
| **Email** | Receives notifications via email |
| **SMS** | Receives notifications via text message |

Each subscriber has one type. Users who want both should create two subscriptions.

## Adding Subscribers

### Manual Addition

1. Go to **Notifications → Subscribers** (Benachrichtigungen → Abonnenten)
2. Click **Create New**
3. Fill in:
   - **Type** - Email or SMS
   - **Email** - Email address (for email type)
   - **Phone** - Phone number with country code (for SMS type)
   - **Approved** (Freigegeben) - Operator approval, see [Approval and confirmation](#approval-and-confirmation)
   - **Address confirmed** (Adresse bestätigt) - Whether the subscriber clicked the confirmation link
   - **Active** - Whether to send notifications
4. Click **Save**

### Public Subscription

Users can subscribe via the public status page:

1. Click the "Subscribe" button on the status page
2. Enter their email address
3. They receive a confirmation email and appear in the Subscribers list

SMS subscriptions through the status page are disabled, because there is no way to confirm a phone number. `POST /api/subscribe` with `type: "sms"` answers with HTTP 503.

## Subscriber Fields

| Field | Description |
|-------|-------------|
| Type | Email or SMS |
| Email | Email address (for email subscribers) |
| Phone | Phone number with country code (for SMS) |
| Approved (`verified`) | Operator approval |
| Address confirmed (`addressConfirmed`) | Subscriber clicked the link in the confirmation email |
| Active | Whether to receive notifications |
| Verification Token | Auto-generated token for verification |
| Unsubscribe Token | Auto-generated token for unsubscribe links |

## Active vs Inactive

- **Active** - Subscriber will receive notifications
- **Inactive** - Subscriber will NOT receive notifications

Subscribers become inactive when:

- They click the unsubscribe link in an email
- An admin manually deactivates them

## Unsubscribe Flow

Each email includes an unsubscribe link:

```
https://status.example.com/unsubscribe/{token}
```

When clicked:

1. User sees a confirmation message
2. Subscription is set to inactive
3. They no longer receive notifications

The unsubscribe link is unique per subscriber and doesn't expire.

## Phone Number Format

SMS phone numbers must include the country code:

- ✅ `+14155551234` (US)
- ✅ `+442071234567` (UK)
- ✅ `+33123456789` (France)
- ❌ `415-555-1234` (missing country code)
- ❌ `(415) 555-1234` (missing country code)

## Approval and confirmation

A new email subscription from the status page needs two steps before notifications are sent:

1. **Address confirmation.** The subscriber receives an email with a link. The link opens a page with a **Confirm** button. Only the click sets **Address confirmed**. The token works once.
2. **Approval.** The operator sets **Approved** on the subscriber. The dashboard shows a notice with the number of subscribers who wait for approval or confirmation and links to the list.

Notifications and the recipient count include only **email** subscribers that are **active**, **approved** and **address confirmed**. SMS subscribers need only **Active**.

To be told about every new request, enter an address under **Settings → Email Settings → Address for new subscription requests**. It receives the mail "New subscription request on <host>" with a link to the subscriber. Leave the field empty to send none.

Subscribers created in the admin area are not confirmed by link: set both **Approved** and **Address confirmed** by hand when you trust the address.

## Bulk Operations

To deactivate multiple subscribers:

1. Select subscribers in the list view
2. Use bulk actions to update

## Privacy Considerations

- Store only necessary contact information
- Provide easy unsubscribe options
- Respect unsubscribe requests immediately
- Consider data retention policies
