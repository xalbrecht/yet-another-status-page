# Availability Report

The availability report (Verfügbarkeitsbericht, `/admin/verfuegbarkeitsbericht`, menu entry below the collections) shows how available the services were in a period. It is meant for management and product managers. Only signed-in users can open it. The page has two views, **Overall report** and **Group reports** (see [Views](#views)).

The report calculates from the status log (see [Maintaining the Status Log](./status-log-maintenance.md)). It does not read incidents.

## Selection

All choices are on the page. Changing a selection reloads the page and puts the choice into the address, so a selection can be shared as a link. The two date fields for a custom period do not reload the page: choose "Custom period", enter the dates and click **Apply**.

| Field | Meaning |
|---|---|
| Period | a month, quarter, half year, year or a custom period (from and to, both days included) |
| Calculation | **One value for the period** (default) or **Mean of the monthly values** |
| Maintenance | A, B or C, see below. With B the maintenance time is part of the outage time and is named next to the outages in the ranking |
| Weakest services | 3 to 10, default 5 |
| Show maintenance time | shows or hides the maintenance line, no effect on the percentage |

The previous period has the same length and directly precedes the selected one. A period that has not ended yet ends now and is marked as not complete.

## Views

Two tabs below the selection switch the view. The selection (period, calculation, maintenance) applies to both. The address holds the view (`view=groups`) and the group (`group=<id>`), so a group sheet can be shared as a link.

**Overall report:** key figures, the weakest services, the development over 12 months, a heat map by service group and a ranking of all services. The heat map shows 12 rows at once, further rows are folded in blocks of 12.

**Group reports:** a list of all groups on the left, weakest first. Each row shows a colored dot (the level of the heat map) and the availability of the group. The weakest group is selected when the view opens. A click shows the group sheet on the right:

| Block | Content |
|---|---|
| 1 | Development of the group over 12 months with the target line |
| 2 | The services of the group, weakest first, with availability and outage duration |
| 3 | Disruptions in the month by service: Major Outage, Partial Outage and Degraded Performance in hours. Only if the group had a disruption |
| 4 | Disruptions in the month by day: for every affected service on a day a narrow bar, the service name stands upright below it. Only if the group had an outage |
| 5 | Heat map of the services |

Blocks 3 and 4 show the **last month of the selected period**. For a quarter that is the third month, for a month that has not ended yet only the days up to now. Block 4 shows Partial Outage and Major Outage only, because Degraded Performance has no separate time segments in the calculation.

## Export

Above the tabs, links download the report. The selection of period, calculation and maintenance applies to the files.

| Link | Content |
|---|---|
| Download everything (ZIP) | PDF, Excel and all images of all groups |
| PDF | the overall report and one sheet per group, one image per block, notes at the end |
| Excel | the Excel file alone |
| Download this group only | in the group reports: the images of the selected group (a ZIP file without PDF and Excel) |

The ZIP file has one folder `verfuegbarkeitsbericht-<period>` with the PDF and the Excel file, the folder `gesamt` and a folder `gruppen/<group>`. File names have no umlauts or spaces. Two groups with the same name get the id appended.

- `gesamt`: `01-kennzahlen.png`, `02-entwicklung-12-monate.png`, `03-schwaechste-dienste.png`, `04-waermekarte-gruppen-<n>.png` (12 groups per image, the total row in every image), `05-dienste-schwaechste-zuerst.png` (the first 12 services).
- `gruppen/<group>`: `00-gruppenblatt.png` (all blocks below each other, block 4 with all days) and the blocks alone: `01-entwicklung-12-monate.png`, `02-dienste-schwaechste-zuerst.png`, `03-stoerungen-je-dienst.png`, `04-stoerungen-je-tag.png` (only the days with an outage), `05-waermekarte-dienste.png` (12 services per image). Blocks 3 and 4 are missing if the group had no disruption in the month.
- All images are PNG with a white background and 2000 pixels width.

The Excel file has three sheets with a filter in the header row: **Services** (one row per service with group, target, value for the period, the 12 monthly values and the durations in minutes, so a person can filter by "their" groups), **Outages** (one row per outage with start, end, duration and type) and **Notes** (selection and footnotes). An unknown value is an empty cell, not 0.

The images are drawn on the server from SVG. The image needs a font (`fontconfig` and `font-dejavu` in the `Dockerfile`), otherwise the images show no text.

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
