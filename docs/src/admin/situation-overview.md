# Situation Overview

The situation overview shows the state of every service group on the start page, modelled on the TI-Lagebild of the gematik. It is built only from the statuses maintained in this application.

## Enabling

Go to **Configuration → Site Settings → Situation overview** and choose **Display**:

| Option | Result |
|--------|--------|
| Off | No situation overview (default) |
| Variant A | Tiles per group, the bars of the last 12 hours below |
| Variant B | Tiles per group, each with its own small bar |
| Both (for testing) | Both variants one after the other, to compare them |

## What is shown

- **Tile per group** - icon and the worst status of the group's services. A click on a tile filters the list below.
- **Bars of the last 12 hours** - one segment per 5 minutes, coloured by the worst status of the group's services at that time. Grey means no data.
- **Disruptions of the last 14 days** - every period in which a group was not Operational, with start and end. A related incident or maintenance is linked. Chips filter by group. The filter is part of the address (`/?gruppe=<id>`).

## Status log

Every status change of a service is recorded in **Status → Status log** (automatically, entries cannot be created by hand). The bars and the 14-day list are calculated from it.

- There is no history from before the feature was introduced. Existing services get a first entry at the time of the update, earlier time ranges show as "No data".
- Changing a service status by hand is logged like any other change.

## Status from incidents

Each incident has the field **Impact on affected services**. Saving an incident sets that status on the affected services. The worst impact of all open incidents applies. When the last open incident of a service is resolved, the service returns to Operational. A service in **Under Maintenance** stays in maintenance.
