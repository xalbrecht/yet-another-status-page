# Templates

Templates (Vorlagen) are ready-made texts for incidents and maintenances. One template holds a title and the texts for the status page and the email, and optionally a text for SMS and one for a push message via ntfy. The placeholders in the texts are filled in when a message is created.

Templates are kept apart from the real incidents and maintenances. A template starts no notification, changes no service status, writes nothing to the status log and appears on no public page or feed. Only signed-in users can read or change templates.

Go to **Status → Templates** (Status → Vorlagen).

> **Status of the feature.** You can create and maintain templates. Choosing a template while you report an incident or a maintenance follows in a later step.

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
