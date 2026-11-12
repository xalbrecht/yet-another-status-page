# Maintaining the Status Log

The status log (Statusprotokoll) lists every change of a service status with its time. The situation overview and the availability report calculate from it. The page **Maintain the status log** (Statusprotokoll pflegen, `/admin/protokoll-pflege`, menu entry below the collections) has two functions. Both show a **preview** first. **Run** becomes available only after a preview and asks for a confirmation.

## Reconstruction

The status log starts on 10 Nov 2026. For the time before, the history is calculated from the incidents and stored as entries with the source **Reconstructed from incidents**. Entries from operation are never changed.

Run the reconstruction again after you have reworked incidents. It deletes the reconstructed entries and builds them again from the current incidents. The preview shows the number of entries before and after, how many incidents fall under each classification and how many incidents are not clearly classified or have no service.

An incident is classified as follows:

1. A classification set by hand on the incident (**Classification for the availability report**, Einordnung für den Verfügbarkeitsbericht) always applies: No impact, Degraded Performance, Partial Outage or Major Outage. It counts as clear.
2. With **Automatic** (the default), the title and the text of the updates decide: "Hinweis" at the start of the title means no impact, the words "Performance", "Ladezeit", "Wartezeit", "langsam" or "Verzögerung" in an update mean Degraded Performance, "Vollständiger Serviceausfall" means Major Outage, "Teilweiser Ausfall" means Partial Outage. Everything else counts as Partial Outage and is reported as not clearly classified.

The incident field **Impact on affected services** is not used.

## Maintenances entered as incidents

Maintenances that were taken over as incidents (the title contains "Wartung") are turned into maintenances:

| Maintenance | Value |
|---|---|
| Title, affected services | as on the incident |
| Planned start | start of the incident |
| Planned end and completed at | time of the update "Resolved" |
| Status | Completed |
| Updates | the incident updates with their times, "Resolved" becomes "Completed", all others "In Progress" |
| Description | "Übernommen aus Störung <short ID> (Vorgängerverfahren)" |

No notification drafts are created. The incident is deleted afterwards and the status log is reconstructed again. Service statuses set by hand stay unchanged. Only incidents created **before the first operation entry of the status log** are converted, so a real incident entered later whose title contains "Wartung" is never touched. Open incidents, incidents with a classification set by hand and incidents created after the status log started are skipped and listed with the reason.

If a run is interrupted, run it again: a maintenance with the same title and start that already exists is not created twice. If only the reconstruction fails after the conversion, the page says so. Run the reconstruction again.

**Create a backup before running.** Deleting the incidents cannot be undone.
