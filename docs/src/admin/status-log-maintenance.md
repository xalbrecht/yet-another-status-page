# Maintaining the Status Log

The status log (Statusprotokoll) lists every change of a service status with its time. The situation overview and the availability report calculate from it. The page **Maintain the status log** (Statusprotokoll pflegen, `/admin/protokoll-pflege`, menu entry below the collections) has two functions. Both show a **preview** first. **Run** becomes available only after a preview and asks for a confirmation.

## Reconstruction

The status log starts with the first status change that is recorded in operation. For the time before, the history is calculated from the incidents and stored as entries with the source **Reconstructed from incidents**. Entries from operation are never changed.

Run the reconstruction again after you have reworked incidents. It deletes the reconstructed entries and builds them again from the current incidents. The preview shows the number of entries before and after, how many incidents fall under each classification and how many incidents are not clearly classified or have no service.

An incident is classified as follows:

1. A classification set by hand on the incident (**Classification for the availability report**, Einordnung für den Verfügbarkeitsbericht) always applies: No impact, Degraded Performance, Partial Outage or Major Outage. It counts as clear.
2. With **Automatic** (the default), the rules from the site settings decide (see below). If no rule matches, or if there are no rules, the incident counts as Partial Outage and is reported as not clearly classified.

### Rules for the automatic classification

The rules are in **Settings → Site Settings**, field **Classify old incidents automatically**. Each rule has four parts:

| Part | Values |
|---|---|
| Searches in | Title, or the text of all updates of the incident |
| Condition | contains, or starts with |
| Words | Words or phrases, separated by commas. One of them is enough |
| Counts as | Maintenance, No impact, Degraded Performance, Partial Outage or Major Outage |

The rules apply from top to bottom, the first matching rule decides. Upper and lower case do not matter. Example:

| Nr. | Searches in | Condition | Words | Counts as |
|---|---|---|---|---|
| 1 | Title | contains | maintenance | Maintenance |
| 2 | Text of the updates | contains | slow, loading time | Degraded Performance |
| 3 | Title | starts with | major outage | Major Outage |

| Incident | Result |
|---|---|
| "Major outage of service A", update "The service is not reachable." | Major Outage (rule 3) |
| "Major outage of service A", update "Pages are slow." | Degraded Performance (rule 2 comes first) |
| "Problem with service B" | Partial Outage, not clearly classified (no rule matches) |

A new installation has no rules. The rules are used only by the two functions on this page and by the footnote of the availability report. They never change a new incident: for the time after the status log started, the status set in operation counts. Changed rules take effect when you run the reconstruction again.

The reconstruction never runs by itself. It starts only with **Run** on this page.

The incident field **Impact on affected services** is not used.

## Maintenances entered as incidents

Maintenances that were entered as incidents are turned into maintenances. This affects resolved incidents that the rules above classify as **Maintenance**:

| Maintenance | Value |
|---|---|
| Title, affected services | as on the incident |
| Planned start | start of the incident |
| Planned end and completed at | time of the update "Resolved" |
| Status | Completed |
| Updates | the incident updates with their times, "Resolved" becomes "Completed", all others "In Progress" |
| Description | "Übernommen aus Störung <short ID> (Vorgängerverfahren)" |

No notification drafts are created. The incident is deleted afterwards and the status log is reconstructed again. Service statuses set by hand stay unchanged. Only incidents created **before the first operation entry of the status log** are converted, so a real incident entered later that matches a maintenance rule is never touched. Open incidents, incidents with a classification set by hand and incidents created after the status log started are skipped and listed with the reason.

If a run is interrupted, run it again: a maintenance with the same title and start that already exists is not created twice. If only the reconstruction fails after the conversion, the page says so. Run the reconstruction again.

**Back up the database before running.** Deleting the incidents cannot be undone, and the application does not create a backup itself: the person who operates the server has to do it. **Run** stays locked until a preview was shown and the checkbox **The database was backed up** is ticked.
