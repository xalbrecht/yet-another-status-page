# Browser Checklist: Situation Overview and Availability Report

This is the English version of the [German checklist](./browser-checklist.md). The point numbers are identical, so results can be compared between both versions. The checklist covers the situation overview (sections 1 to 6) and the availability report in the admin (section 8) in the browser, after a new image runs on Dev or Test. The automatic tests (see [Testing](./testing.md)) do not cover mobile layout, the German interface and German time formats. A person checks these points.

For each point check on Dev first, then on Test. Set a tick (✓) and write findings into the "Note" column. The quoted interface texts follow the language of the server (`DEFAULT_LANGUAGE`); the German checklist quotes the German texts.

| Field | Entry |
|---|---|
| Image tag | |
| Date | |
| Tester | |
| Dev address | |
| Test address | |

## 1. Variant A: Home page

| No. | Check | How to check | Expectation | Dev | Test | Note |
|---|---|---|---|---|---|---|
| A1 | Groups and icons | Open the home page, look through all groups | 36 groups, each with its own icon. No square grid symbol (default icon `LayoutGrid`) on groups that should have another symbol | ☐ | ☐ | |
| A2 | Expand the services of a group | Click a group with several services, then click again | Services appear, the second click collapses them | ☐ | ☐ | |
| A3 | Bars and tooltip | Move the mouse over single strokes | Bar of 144 strokes. The tooltip shows an end time only | ☐ | ☐ | |
| A4 | Bar at 24 hours | Set the selection "Bar" to 24 hours (or append `?balken=24`), move over the leftmost stroke | Still 144 strokes (10 minutes each). The tooltip on the left says "yesterday" with a time, e.g. "yesterday 21:20" | ☐ | ☐ | |
| A5 | Time matches local time | Compare the tooltip of the last stroke with the clock of the computer | Deviation at most 10 minutes. A difference of one hour is a time zone error | ☐ | ☐ | |
| A6 | Switch the look-back | Choose 14, 30, 90, 180 and 365 days one after the other (or `?rueckschau=30`) | Availability per service changes, the address contains the parameter, no error at 365 | ☐ | ☐ | |
| A7 | "since …" for a short log | Choose a look-back of 365 days, look at the services | Below the percentage it says "since DD.MM.YYYY" where the log is shorter than the chosen period | ☐ | ☐ | |
| A8 | Availability values are plausible | Find two or three services with known incidents, compare the value with the incident list | Value between 0 and 100 %. A service without disruption shows 100 %. "Degraded Performance" and "Maintenance" count as available | ☐ | ☐ | |

## 2. Variant B (only in test mode "Both")

| No. | Check | How to check | Expectation | Dev | Test | Note |
|---|---|---|---|---|---|---|
| B1 | Show and expand variant B | Look at the tiles, expand a group | Tiles with bars, expanding shows the services. The page loads without a noticeable delay | ☐ | ☐ | |

## 3. Admin defaults

| No. | Check | How to check | Expectation | Dev | Test | Note |
|---|---|---|---|---|---|---|
| C1 | Default affects the home page | Under `/admin` change the period of the bar or the look-back, reload the home page | New default visible after 60 seconds at the latest (cache). Reset the values afterwards | ☐ | ☐ | |
| C2 | Visitor choice beats the default | With a changed default append `?balken=` or `?rueckschau=` | The address line wins over the admin default | ☐ | ☐ | |
| C3 | Change to a service visible at once | Change the status of a test service, reload the home page | Change visible without waiting 60 seconds. Reset the status afterwards | ☐ | ☐ | |
| C4 | Icon for a new group | Create a group under `/admin` | The field "Icon" is set to `LayoutGrid` and can be changed. Delete the test group afterwards | ☐ | ☐ | |

## 4. Phone

| No. | Check | How to check | Expectation | Dev | Test | Note |
|---|---|---|---|---|---|---|
| D1 | Use on a phone | Open the home page on a phone (test only in the company network or by VPN) | No sideways scrolling. Expanding works. The tooltip appears when a stroke is tapped | ☐ | ☐ | |

## 5. Repeated loading

| No. | Check | How to check | Expectation | Dev | Test | Note |
|---|---|---|---|---|---|---|
| E1 | Reload under load | Reload the home page 20 times with F5, also in two tabs | Always HTTP 200, every call under 1 second, no error page | ☐ | ☐ | |

## 6. New layout (A and B)

Applies to variant A, variant B and test mode "Both". The settings are under `/admin` in the website settings, area situation overview. Changes take effect after 60 seconds at the latest (cache of the situation overview); the boxes themselves are read on every call. Reset the values afterwards.

| No. | Check | How to check | Expectation | Dev | Test | Note |
|---|---|---|---|---|---|---|
| G1 | Boxes on the right in a wide window | Window at least 1024 pixels wide, open the home page | Situation overview on the left, on the right the boxes "Current incidents" and "Maintenance". The long list of groups and services is missing, the page is wider than in variant C | ☐ | ☐ | |
| G2 | Boxes on the phone | Drag the window narrower than 1024 pixels, set "Boxes on narrow screens" first to "Before the situation overview", then to "After the situation overview" | The boxes stand above or below the situation overview according to the setting. No sideways scrolling | ☐ | ☐ | |
| G3 | Number and content of the short form | Set "Entries per box" to 1, load with two open incidents. Then set "Content of the boxes" to "Title and time only" | One entry and the link "Show 1 more", which jumps to the block "Current incidents". With "Title and time only" the services and the latest update are missing | ☐ | ☐ | |
| G4 | Blocks below the situation overview | Load with one open and one resolved incident, look through the page | "Current incidents" shows all open ones with their history, "Scheduled Maintenance" the maintenances, "Past Incidents" only resolved ones of the last 5 days. Without an open incident the sentence "No current incidents." appears | ☐ | ☐ | |
| G5 | Tooltip with the mouse | Move slowly over a tile, then into the tooltip, then away | The tooltip appears below the tile with the services, each with a coloured dot, without description. When moving into the tooltip it stays open and does not flicker. A click in the tooltip shows the service panel. Moving the mouse away closes it after about a quarter of a second | ☐ | ☐ | |
| G6 | Tooltip with the keyboard | Tab to a tile, then press Esc | The tooltip appears with the focus and disappears with Esc. A screen reader reads the state ("Partial Outage") for the dot | ☐ | ☐ | |
| G7 | Tooltip on the phone | Tap a tile, tap again, then tap next to the tile | The first tap shows the tooltip, the second the service panel with bars. A tap next to it closes the tooltip | ☐ | ☐ | |
| G8 | Tooltip at the edge | Approach the tiles at the far left and far right with the mouse, also in a narrow window | The tooltip stays inside the grid and is not cut off. Width at most 340 pixels | ☐ | ☐ | |
| G9 | Tile "All" | Look at the first tile (grid symbol, below it "All" only once), click it, click a row, move the mouse over the tile | Meta "n groups · m affected", preselected in variant A. The panel shows one row per group with bar and availability, a click on a row selects the group. The tooltip names the affected groups and "n more groups operational" | ☐ | ☐ | |
| G10 | Address | Append `?gruppe=<group id>`, then choose "All" | The group is selected. With "All" there is no `gruppe` in the address | ☐ | ☐ | |
| G11 | Dark mode | Switch dark mode on, look at boxes, strips, tooltip and service panel | Everything readable, strips and dots in the state colours | ☐ | ☐ | |
| G12 | Variant C unchanged | Set the display to "Variant C (simple list)" | The old page as before: long list of groups and services with legend, no boxes, no tooltip. Open incidents appear in the daily listing | ☐ | ☐ | |
| G13 | Variant by address (only test mode "Both") | Set the display to "Both", open `/?lagebild=a` and `/?lagebild=b` in two browser tabs, then `/` without a parameter | Each tab shows only the chosen variant, without a parameter both are shown one below the other. With "Variant A" or "Variant B" in the settings the parameter changes nothing | ☐ | ☐ | |
| G14 | Badge "Test mode" in the header | In test mode "Both" look at the header, once wide, once narrow | Wide: badge between "System Status" and "Subscribe", with a single variant labelled "Variant A" or "Variant B", the boxes do not shift. Below 640 pixels width the badge is hidden | ☐ | ☐ | |

## 7. Operations only (shell access needed)

The operations team runs these points, not the tester in the browser.

| No. | Check | Command | Expectation | Dev | Test | Note |
|---|---|---|---|---|---|---|
| F1 | No restart of the container | Test: `ssh <test-host> "docker inspect -f '{{.RestartCount}}' yasp-app"` | Output `0` | ☐ | ☐ | |
| F2 | No out-of-memory kill | Test: `ssh <test-host> "docker events --since 24h --until 0s --filter event=oom"` | No output | ☐ | ☐ | |
| F3 | Check script for the stack | Run `scripts/check_stack.sh` in the deployment project | Runs through without errors | ☐ | ☐ | |

## 8. Availability report (admin)

Applies to the page `/admin/verfuegbarkeitsbericht` (report, export and email dispatch). Prerequisite: login to the admin, services with disruptions in the chosen period, a service with a long name, a service with an emoji in its name and at least one recipient in the email settings. Points H1 to H11 belong to the report view, H12 to H14 to the export, H15 to H20 to the email dispatch. Reset changed settings afterwards.

| No. | Check | How to check | Expectation | Dev | Test | Note |
|---|---|---|---|---|---|---|
| H1 | Group list stays put on click | Open the group reports, scroll down the list, click a group further down | The group sheet changes, the list does not jump to the top, the page does not scroll up, the chosen group is marked | ☐ | ☐ | |
| H2 | Group list in a narrow window | Drag the window narrower than 800 pixels, look at the group reports | The list stands above the group sheet at full width (at most 40 % of the window height, then scrollable), no sideways scrolling | ☐ | ☐ | |
| H3 | Bar at 100 % | Look at the group sheet of a group with a service at 100 % (block "Services of the group, weakest first"), light and dark | The bar fills the whole track in light blue, it does not look empty | ☐ | ☐ | |
| H4 | Service names in block 4 | Choose a month with outages of a service with a long name (16 characters or more), look at the block "Disruptions in <month>, by day" | The name stands vertically below the axis and is not cut off at the bottom (if shortened it ends with "…") | ☐ | ☐ | |
| H5 | Decimal mark in the tooltip | Move the mouse over a bar in block 4 | The duration uses the decimal mark of the language (e.g. "2,0 h" in German, "2.0 h" in English) | ☐ | ☐ | |
| H6 | Short outage visible | Find a day with an outage under five minutes in block 4 | The outage appears as a thin but visible stroke | ☐ | ☐ | |
| H7 | Heading for a part of a month | Choose the running month or a custom period (e.g. 5th to 20th), look at the group sheet | The headings of blocks 3 and 4 name the days ("… (days 1–20)"), the axis ends at the last day. A whole month has no addition | ☐ | ☐ | |
| H8 | Singular | Choose a group with exactly one service and one outage, and next to it one with several | "1 service" and "1 outage", with several "services" and "outages" | ☐ | ☐ | |
| H9 | Fields in the group reports | Switch between the overall report and the group reports, look at the selection fields | The overall report has "Weakest services" and "Show maintenance time", the group reports do not. Back in the overall report they have their old values | ☐ | ☐ | |
| H10 | Group stays when switching | Group reports: choose a group, switch to the overall report, change the period there, go back to the group reports | The same group is selected (the address carries `group=`) | ☐ | ☐ | |
| H11 | Preselected group | Open the group reports without `group` in the address, then change the period | The weakest group (first entry of the list) is selected, the page loads without a noticeable wait | ☐ | ☐ | |
| H12 | File name for a custom period | Choose a custom period, download ZIP, PDF and Excel | The names read `verfuegbarkeitsbericht-YYYY-MM-DD_YYYY-MM-DD…`, not `…-custom` | ☐ | ☐ | |
| H13 | Excel: minutes and maintenance type B | Open the Excel file, once with maintenance type A, once with B | Durations have one decimal place (an outage of 20 seconds shows 0.3). With B the sheet "Notes" has a row "Maintenance type B", with A it is missing | ☐ | ☐ | |
| H14 | Images: emoji and long names | Create a service with an emoji in its name and a group with more than 40 characters, download the ZIP | The images show no box or "?" for the emoji. The group folder in the ZIP has at most 40 characters | ☐ | ☐ | |
| H15 | Dispatch with the keyboard | With the keyboard only: tab to "Send by email", press Enter. Then "Cancel" with Enter | The focus jumps to "Send now", after "Cancel" back to "Send by email", after sending to the message | ☐ | ☐ | |
| H16 | Mail server not reachable | Enter an unreachable server under email settings, start the dispatch, reset the value afterwards | After about 10 seconds at most it says "The mail server does not respond … Nothing was sent." | ☐ | ☐ | |
| H17 | Mail text | Dispatch to the catch-all server on `<test-host>` (interface through an SSH tunnel), open mail 1 | The text names "Services in the report: n", PDF and Excel are attached | ☐ | ☐ | |
| H18 | Invalid recipient address | Enter `<a@x.de>` in the field "Recipients of the availability report" and save | Saving is refused, the message names the entry | ☐ | ☐ | |
| H19 | SMTP data when logged out | In a private window without login call `/api/globals/email-settings` | Server, user and sender are missing in the answer | ☐ | ☐ | |
| H20 | Two dispatches at once | Start "Send now" in two tabs at the same time | One tab reports "A dispatch is already running.", the other dispatches normally | ☐ | ☐ | |

## Create the PDF

Run from the directory of the repository. The output is in landscape format so that the tables stay readable:

```bash
pandoc docs/src/development/browser-checklist.en.md \
  --from gfm --to html5 --standalone --metadata pagetitle="Browser Checklist" \
  --pdf-engine=weasyprint --css docs/pdf/checklist.css \
  -o browser-checklist-en.pdf
```

The file `browser-checklist-en.pdf` is not versioned. Hand it to testers to fill in on screen or on paper.
