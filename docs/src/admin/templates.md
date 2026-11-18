# Templates

Templates (Vorlagen) are ready-made texts for incidents and maintenances. One template holds a title and the texts for the status page and the email, and optionally a text for SMS and one for a push message via ntfy. The placeholders in the texts are filled in when a message is created.

Templates are kept apart from the real incidents and maintenances. A template starts no notification, changes no service status, writes nothing to the status log and appears on no public page or feed. Only signed-in users can read or change templates.

Go to **Status → Templates** (Status → Vorlagen).

> **Where templates are used.** When you report a new incident, choose a template with the button **Create new with template** in the list of incidents, see [Creating an Incident with a Template](./incidents.md#creating-an-incident-with-a-template). To add a further update to an existing incident or maintenance, see [Inserting a Template into an Update](#inserting-a-template-into-an-update). To create a new maintenance with a template, see [Creating a Maintenance with a Template](./maintenances.md#creating-a-maintenance-with-a-template).

## Fields

| Field | German | Meaning |
|-------|--------|---------|
| Name | Name | How the template appears in the list, for example "Investigating: partial outage" |
| Type | Art | **Incident** (Störung) or **Maintenance** (Wartung) |
| Update status | Status der Aktualisierung | The status of the update for which the template is meant. For an incident: Investigating, Identified, Monitoring or Resolved. For a maintenance: Upcoming, In Progress, Completed or Cancelled. A new status gets templates without further work |
| Preset impact | Vorbelegung der Auswirkung | Optional, incidents only: Degraded Performance, Partial Outage or Major Outage. Preselects the impact when the template is chosen |
| Title | Titel | Title of the incident or maintenance |
| Text | Text | Text for the status page and the email |
| SMS text | SMS-Text | Optional, up to 320 characters (longer texts are cut when sent) |
| ntfy text | ntfy-Text | Optional, up to 500 characters |

There can be any number of templates for one status. For an incident that is being investigated you might keep one for a partial outage and one for a full outage.

## Placeholders

Title and all texts may contain placeholders written as `{{name}}`. A placeholder that is not allowed for the type is rejected when you save.

| Placeholder | Incident | Maintenance | Replaced by |
|-------------|:--------:|:-----------:|-------------|
| `{{services}}` | yes | yes | The affected services as a list, written by the rules of the language ("Mail, Web and DNS" in English, "Mail, Web und DNS" in German) |
| `{{group}}` | yes | yes | The name of the group |
| `{{impact}}` | yes | no | The impact of the incident |
| `{{start}}` | no | yes | Start of the maintenance |
| `{{end}}` | no | yes | End of the maintenance |
| `{{link}}` | yes | yes | The address of the message on the status page. It is known only after the message is saved, so it is filled in when the notification is created |

Word the text so that it fits one service and several. The list stands in one place:

```
An incident is open. Affected: {{services}}.
We are analysing the cause. We will inform you as soon as we know more.
```

## Inserting a Template into an Update

An incident gets further updates: "Cause found", "Monitoring", "Resolved". A maintenance gets them too: "In Progress", "Completed", "Cancelled". When you add a new update to an existing incident or maintenance, the field **Insert template** (Vorlage einfügen) appears above the message.

1. Choose the **Status** of the update.
2. Choose a template under **Insert template**. The list shows the templates of the type (incident or maintenance) for that status. Without a template for the status the list is empty and points to Status → Templates.
3. The message is filled in. `{{services}}` and `{{group}}` come from the affected services, `{{impact}}` (incidents) from the impact, `{{start}}` and `{{end}}` (maintenances) from the scheduled start and end, in the time zone and language of the installation, all as shown in the form. Without affected services, or without an end of the maintenance, the placeholder stays empty, and the form says so.
4. Change the text if needed. The update is saved only with **Save**.

If the message already has text, you are asked before it is replaced. If you change the inserted text, the SMS and ntfy texts of the template stay unchanged. They are not shown in the form. Together with the update they go into the notification draft. `{{link}}` is replaced by the address of the incident or maintenance when the update is saved.

Updates that are already saved show no template list: their text is already published.

