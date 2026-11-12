# Availability Report

The availability report (Verfügbarkeitsbericht, `/admin/verfuegbarkeitsbericht`, menu entry below the collections) shows how available the services were in a period. It is meant for management and product managers: key figures, the weakest services, the development over 12 months, a heat map and a ranking of all services. Only signed-in users can open it.

The report calculates from the status log (see [Maintaining the Status Log](./status-log-maintenance.md)). It does not read incidents.

## Selection

All choices are on the page. Changing a selection reloads the page and puts the choice into the address, so a selection can be shared as a link. The two date fields for a custom period do not reload the page: choose "Custom period", enter the dates and click **Apply**.

| Field | Meaning |
|---|---|
| Period | a month, quarter, half year, year or a custom period (from and to, both days included) |
| Group | all groups, or one group with its individual services |
| Calculation | **One value for the period** (default) or **Mean of the monthly values** |
| Maintenance | A, B or C, see below. With B the maintenance time is part of the outage time and is named next to the outages in the ranking |
| Weakest services | 3 to 10, default 5 |
| Show maintenance time | shows or hides the maintenance line, no effect on the percentage |

The previous period has the same length and directly precedes the selected one. A period that has not ended yet ends now and is marked as not complete.

## Availability

The share of the known time without Partial Outage and Major Outage. Degraded Performance counts as available and is shown as its own time. Time before the first log entry of a service is not counted. The value is rounded down to two decimals. The value of a group, and the total, is the mean of its services, every service weighted equally.

## Maintenance

The maintenance time comes **only from entered maintenances**, not from the service status Under Maintenance. It is the actual time as far as entered, otherwise the planned time:

| Case | Start | End |
|---|---|---|
| Completed, updates "In Progress" and "Completed" entered by hand | time of the update "In Progress" | time of the update "Completed" |
| Completed without updates (switched automatically) | planned start | planned end |
| Still running | as above | end of the period or now |
| Cancelled after it started | as above | time of the cancellation |
| Cancelled before it started, or only planned | no maintenance time | no maintenance time |

Example for a month of 31 days (44,640 minutes) with an outage of 90 minutes outside the maintenance and a maintenance of 600 minutes:

| Type | Maintenance counts as | Result |
|---|---|---|
| A (default) | available, outages during the maintenance do not count | 99.79 % |
| B | outage | 98.45 % |
| C | taken out of the total time | 99.79 % |

## Target

The availability target applies to a month. It is taken from the service, else from its group, else from the setting **Availability target** (default 99 %). The key figure **Months with target met** counts the calendar months of the selected period whose value reaches the target. In the ranking, a service below its target is marked "below target".

## Footnotes

The report names how many incidents before the start of the status log are not clearly classified (counted as Partial Outage) and how many incidents have no service and are not considered.
