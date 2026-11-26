# Situation Overview

The situation overview shows the state of every service group on the start page, modelled on the TI-Lagebild of the gematik. It is built only from the statuses maintained in this application. Next to it, two boxes show the current incidents and the maintenance.

## Enabling

Go to **Configuration → Site Settings → Situation overview** (Konfiguration → Website-Einstellungen → Lagebild) and choose **Display** (Anzeige):

| Option | German | Result |
|--------|--------|--------|
| List (original) | Liste (Original) | No situation overview and no boxes. The start page shows the list of services per group, the legend and the incidents of the last days (default) |
| Situation overview A | Lagebild A | Tiles per group. The tile **All** is preselected. A click on a tile opens the services of the group below the tile row |
| Situation overview B | Lagebild B | Tiles per group, each with its own small bar. Nothing is preselected. A click opens the services of the group below the tile row, like in variant A |

The options Situation overview A and B also show the boxes and the three blocks described below. The settings for the boxes apply to these options only.

## Layout of the start page

With variant A or B the start page has this order:

1. The status banner.
2. The situation overview on the left and the boxes **Current incidents** (Aktuelle Störungen) and **Maintenance** (Wartungen) on the right. On wide screens (1024 pixels and more) the situation overview takes about two thirds of the width. On narrow screens the boxes stand above or below it, see [Settings](#settings-for-the-boxes).
3. The block **Current incidents** (anchor `#incidents`): all open incidents with their updates.
4. The block **Scheduled Maintenance** (Geplante Wartungen, anchor `#maintenance`), only if there is a maintenance to show: scheduled and running ones, and finished ones for the time set in **Maintenance retention (hours)**.
5. The block **Past Incidents** (Vergangene Störungen, anchor `#past-incidents`): resolved incidents of the last five days, by day, with a link to the incident history.

## What is shown

- **Tile per group** - icon, the worst status of the group's services and the number of services (with the number of affected ones). In variant B the tile also shows a small bar. A click on a tile opens the services of the group below the tile row, a second click closes them. The tiles below move down. The click also filters the list of disruptions to that group and puts the group into the address (`/?gruppe=<id>`).
- **Tile All** (Alle) - the first tile, with a grid symbol. It shows the worst status of all groups and the number of groups (with the number of affected ones). A click opens a panel with one row per group: its bar and its availability. A click on a row selects that group. **Close** returns to the tile row. In variant A the tile is preselected, in variant B nothing is. The tile **All** does not put anything into the address.
- **Tooltip** - hovering over a tile shows the services of the group with a coloured dot and the status of each service. The tooltip of the tile **All** lists the groups that are not Operational, and below them how many other groups are operational ("All groups operational" if none is affected). Details: [Tooltip](#tooltip).
- **Services of a group** - for every service the bar of the last 12 hours and its availability in the selected look-back period. The bar has one stroke per 5 minutes (144 strokes). Each stroke shows the worst status within its 5 minutes, so a short outage stays visible. Grey means no data. Hovering over a stroke or tapping it shows the end of its 5 minutes (for example 12:05) and the status. The start and end of the bar are shown as times above the bars.
- **Availability** - share of the known time in which the service was neither Partial Outage nor Major Outage. Degraded and Maintenance count as available. Time before the first log entry is not counted. The value is rounded down to two decimals. If the status log reaches back less far than the look-back period, a note shows since when the value is known ("since <date and time>"), instead of the name of the period. The note appears for services and, in the panel of the tile **All**, for groups. The availability of a group is the worst state of its services at each moment: an outage of one service counts for the group.
- **Disruptions** - every period of the selected look-back in which a group was not Operational, with start and end. A related incident or maintenance is linked. Chips filter by group. The filter is part of the address (`/?gruppe=<id>`).

### Tooltip

| Input | Behaviour |
|-------|-----------|
| Mouse | The tooltip opens when the mouse moves over the tile. It stays open while the mouse is on the tile or in the tooltip and closes shortly after the mouse leaves both. A click on the tile or in the tooltip selects the group and closes the tooltip. It stays closed until the mouse has left the tile |
| Keyboard | Tab to the tile shows the tooltip. **Esc** closes it. Enter or Space selects the group |
| Touch | The first tap shows the tooltip, the second tap selects the group. A tap outside closes it |

**Esc** also closes a tooltip that was opened with the mouse. The list of services stands in the page for screen readers and is read as the description of the tile, even while the tooltip is closed.

## Boxes

The two boxes show a short form of what is happening now:

- **Current incidents** - open incidents (the latest update is not "Resolved"), newest first. The status label shows the latest update (for example "Identified"), the colour at the left edge the impact of the incident.
- **Maintenance** - maintenances that are scheduled or in progress, earliest start first. The time of a maintenance is shown as a period (start – end) or, without an end, as "from <start>".

The number in the head of a box is the number of all entries. The box shows as many entries as **Entries per box** allows. The rest is behind the link "Show N more", which jumps to the block **Current incidents** or **Scheduled Maintenance** further down. Every entry links to the detail page of the incident or maintenance. An empty box shows a short note.

## Settings for the boxes

All settings are in the same section **Situation overview** and apply to variants A, B and "Both".

| Setting | German | Values | Default |
|---------|--------|--------|---------|
| Entries per box | Einträge je Box | 1 to 10 | 3 |
| Content of the boxes | Inhalt der Boxen | **With services and latest update** (Mit Diensten und letztem Stand): the services as chips and the text of the latest update. **Title and time only** (Nur Titel und Zeit): a compact entry | With services and latest update |
| Boxes on narrow screens | Boxen auf schmalen Bildschirmen | **Before the situation overview** (Vor dem Lagebild) or **After the situation overview** (Nach dem Lagebild). Below 1024 pixels the boxes stand above or below the situation overview. On wide screens they are always on the right | Before the situation overview |

## Look-back period

The field **Look-back period** (Rückschau) in the same section sets the default: 14 days (default), month (30), quarter (90), half year (180) or year (365). Visitors can change it with the list **Look-back** above the disruptions. The choice is part of the address (`/?rueckschau=<days>`) and applies to the list of disruptions and the availability. Invalid values fall back to the admin default. The bars always show the last 12 hours.

## Bar period

The field **Bar period** (Zeitraum der Balken) in the same section sets the default: 12 hours (default, 5 minutes per stroke) or 24 hours (10 minutes per stroke). The bar always has 144 strokes. Visitors can change it with the list **Bars** next to the heading "Situation overview". The choice is part of the address (`/?balken=<hours>`), invalid values fall back to the admin default. For 24 hours the times of the previous day are marked with "yesterday" (gestern), for example "yesterday 21:20". The status log must reach back far enough: A stroke before the first log entry shows "No data".

## Caching

The start page calculates one bar per service and group. To keep the load low, the result is calculated once and reused for all visitors. The duration is the setting **Cache of the situation overview** in the site settings (1, 3, 5 or 10 minutes). If the setting is empty, the environment variable `LAGEBILD_CACHE_SECONDS` applies (default 60 seconds, `0` switches the cache off, see [Configuration](../getting-started/configuration.md)). The cache is separate for each look-back, bar period, language and time zone.

- After the duration has passed, the next visit calculates the situation overview again and waits for the result. It never shows the old state once more.
- A change of a service status, of a service, of a group, of an incident or of a maintenance discards the cache at once, whatever the duration is. The new state appears on the next load of the page. A calculation that was already running when the change was saved is not stored.
- The bars and the times above them can be as old as the duration.
- The cache lives in the memory of each application instance and is empty after a restart. With several instances (for example several Helm replicas) a change discards the cache only in the instance that received it. The others catch up after at most the duration.

## Status log

Every status change of a service is recorded in **Status → Status log** (Status → Statusprotokoll) (automatically, entries cannot be created by hand). The bars, the availability and the list of disruptions are calculated from it.

- There is no history from before the feature was introduced. Existing services get a first entry at the time of the update, earlier time ranges show as "No data".
- Changing a service status by hand is logged like any other change.

## Status from incidents

Each incident has the field **Impact on affected services**. Saving an incident sets that status on the affected services. The worst impact of all open incidents applies. When the last open incident of a service is resolved, the service returns to Operational. A service in **Under Maintenance** stays in maintenance.
