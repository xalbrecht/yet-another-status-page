# Situation Overview

The situation overview shows the state of every service group on the start page, modelled on the TI-Lagebild of the gematik. It is built only from the statuses maintained in this application.

## Enabling

Go to **Configuration → Site Settings → Situation overview** (Konfiguration → Website-Einstellungen → Lagebild) and choose **Display**:

| Option | German | Result |
|--------|--------|--------|
| Off | Aus | No situation overview (default) |
| Variant A | Variante A | Tiles per group, a click opens the services of the group below the tile row |
| Variant B | Variante B | Tiles per group, each with its own small bar |
| Both (for testing) | Beide (zum Testen) | Both variants one after the other, to compare them |

## What is shown

- **Tile per group** - icon, the worst status of the group's services and the number of services (with the number of affected ones). A click on a tile opens the services of the group below the tile row, a second click closes them. The tiles below move down. The click also filters the list of disruptions to that group.
- **Services of a group** - for every service the bar of the last 12 hours and its availability in the selected look-back period. The bar has one stroke per 5 minutes (144 strokes). Each stroke shows the worst status within its 5 minutes, so a short outage stays visible. Grey means no data. Hovering over a stroke or tapping it shows the end of its 5 minutes (for example 12:05) and the status. The start and end of the bar are shown as times above the bars.
- **Availability** - share of the known time in which the service was neither Partial Outage nor Major Outage. Degraded and Maintenance count as available. Time before the first log entry is not counted. The value is rounded down to two decimals.
- **Disruptions** - every period of the selected look-back in which a group was not Operational, with start and end. A related incident or maintenance is linked. Chips filter by group. The filter is part of the address (`/?gruppe=<id>`).

## Look-back period

The field **Look-back period** (Rückschau) in the same section sets the default: 14 days (default), month (30), quarter (90), half year (180) or year (365). Visitors can change it with the list **Look-back** above the disruptions. The choice is part of the address (`/?rueckschau=<days>`) and applies to the list of disruptions and the availability. Invalid values fall back to the admin default. The bars always show the last 12 hours.

## Bar period

The field **Bar period** (Zeitraum der Balken) in the same section sets the default: 12 hours (default, 5 minutes per stroke) or 24 hours (10 minutes per stroke). The bar always has 144 strokes. Visitors can change it with the list **Bars** next to the heading "Situation overview". The choice is part of the address (`/?balken=<hours>`), invalid values fall back to the admin default. For 24 hours the times of the previous day are marked with "yesterday" (gestern), for example "yesterday 21:20". The status log must reach back far enough: A stroke before the first log entry shows "No data".

## Caching

The start page calculates one bar per service and group. To keep the load low, the result is cached for all visitors for 60 seconds (environment variable `LAGEBILD_CACHE_SECONDS`, `0` switches the cache off, see [Configuration](../getting-started/configuration.md)). The cache is separate for each look-back, bar period, language and time zone.

- A change of a service status, of a service or of a group discards the cache at once. The new state appears on the next load of the page.
- Other changes (for example the title of an incident that is linked in the list of disruptions) appear after at most 60 seconds.
- The bars and the times above them can be up to 60 seconds old.

## Status log

Every status change of a service is recorded in **Status → Status log** (Status → Statusprotokoll) (automatically, entries cannot be created by hand). The bars, the availability and the list of disruptions are calculated from it.

- There is no history from before the feature was introduced. Existing services get a first entry at the time of the update, earlier time ranges show as "No data".
- Changing a service status by hand is logged like any other change.

## Status from incidents

Each incident has the field **Impact on affected services**. Saving an incident sets that status on the affected services. The worst impact of all open incidents applies. When the last open incident of a service is resolved, the service returns to Operational. A service in **Under Maintenance** stays in maintenance.
