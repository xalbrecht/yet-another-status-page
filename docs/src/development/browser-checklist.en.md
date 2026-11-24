# Browser Checklist: Situation Overview and Availability Report

This is the English version of the [German checklist](./browser-checklist.md). The point numbers are identical, so results can be compared between both versions. The checklist covers the situation overview (sections 1 to 6) and the availability report in the admin (section 8) in the browser, after a new image runs on Dev or Test. The automatic tests (see [Testing](./testing.md)) run against `next dev`, not against the image. They check content and logic, not the appearance in a real browser, the admin interface, the real mail server, the fonts in the image and the time zone of the computer. A person checks these points. What a test already covers is listed in the "Automatic" column; the rest of the row stays manual. Points that a test covers completely are listed in the section "Removed" at the end; their numbers stay reserved.

For each point check on Dev first, then on Test. Set a tick (✓) and write findings into the "Note" column. The quoted interface texts follow the language of the server (`DEFAULT_LANGUAGE`); the German checklist quotes the German texts.

| Field | Entry |
|---|---|
| Image tag | |
| Date | |
| Tester | |
| Dev address | |
| Test address | |

## 1. Variant A: Home page

| No. | Check | How to check | Expectation | Automatic | Dev | Test | Note |
|---|---|---|---|---|---|---|---|
| A1 | Groups and icons | Open the home page, look through all groups | 36 groups, each with its own icon. No square grid symbol (default icon `LayoutGrid`) on groups that should have another symbol |  | ☐ | ☐ |  |
| A3 | Bars and tooltip | Move the mouse over single strokes | Bar of 144 strokes. The tooltip shows an end time only | E2E: 144 strokes, tooltip with time and status. Open: only one end time. | ☐ | ☐ |  |
| A4 | Bar at 24 hours | Set the selection "Bar" to 24 hours (or append `?balken=24`), move over the leftmost stroke | Still 144 strokes (10 minutes each). The tooltip on the left says "yesterday" with a time, e.g. "yesterday 21:20" | E2E: 144 strokes, heading "Last 24 hours · 10 minutes". Open: the text "yesterday" in the tooltip. | ☐ | ☐ |  |
| A5 | Time matches local time | Compare the tooltip of the last stroke with the clock of the computer | Deviation at most 10 minutes. A difference of one hour is a time zone error |  | ☐ | ☐ |  |
| A6 | Switch the look-back | Choose 14, 30, 90, 180 and 365 days one after the other (or `?rueckschau=30`) | Availability per service changes, the address contains the parameter, no error at 365 | E2E: 14, 90 and 180 days, invalid value, address. Open: 30 and 365 days, no error at 365. | ☐ | ☐ |  |
| A7 | "since …" for a short log | Choose a look-back of 365 days, look at the services | Below the percentage it says "since DD.MM.YYYY" where the log is shorter than the chosen period | Unit (`all-groups-panel`): "since …" in the "All" panel. Open: display at the individual services. | ☐ | ☐ |  |
| A8 | Availability values are plausible | Find two or three services with known incidents, compare the value with the incident list | Value between 0 and 100 %. A service without disruption shows 100 %. "Degraded Performance" and "Maintenance" count as available |  | ☐ | ☐ |  |

## 2. Variant B

| No. | Check | How to check | Expectation | Automatic | Dev | Test | Note |
|---|---|---|---|---|---|---|---|
| B1 | Show and expand variant B | Look at the tiles, expand a group | Tiles with bars, expanding shows the services. The page loads without a noticeable delay | E2E: a click expands the services with bar and availability. Open: load time. | ☐ | ☐ |  |

## 3. Admin defaults

| No. | Check | How to check | Expectation | Automatic | Dev | Test | Note |
|---|---|---|---|---|---|---|---|
| C1 | Default affects the home page | Under `/admin` change the period of the bar or the look-back, reload the home page | New default visible after 60 seconds at the latest (cache). Reset the values afterwards | E2E: default set through the API, home page follows. Open: entry in the admin form. | ☐ | ☐ |  |
| C4 | Icon for a new group | Create a group under `/admin` | The field "Icon" is set to `LayoutGrid` and can be changed. Delete the test group afterwards |  | ☐ | ☐ |  |

## 4. Phone

| No. | Check | How to check | Expectation | Automatic | Dev | Test | Note |
|---|---|---|---|---|---|---|---|
| D1 | Use on a phone | Open the home page on a phone (test only in the company network or by VPN) | No sideways scrolling. Expanding works. The tooltip appears when a stroke is tapped | E2E: at 375 and 768 pixels not wider than the window, touch (tooltip, service panel). Open: a real device. | ☐ | ☐ |  |

## 5. Repeated loading

| No. | Check | How to check | Expectation | Automatic | Dev | Test | Note |
|---|---|---|---|---|---|---|---|
| E1 | Reload under load | Reload the home page 20 times with F5, also in two tabs | Always HTTP 200, every call under 1 second, no error page |  | ☐ | ☐ |  |

## 6. New layout (A and B)

Applies to variant A and variant B. The settings are under `/admin` in the website settings, area situation overview. Changes take effect after 60 seconds at the latest (cache of the situation overview); the boxes themselves are read on every call. Reset the values afterwards.

| No. | Check | How to check | Expectation | Automatic | Dev | Test | Note |
|---|---|---|---|---|---|---|---|
| G1 | Boxes on the right in a wide window | Window at least 1024 pixels wide, open the home page | Situation overview on the left, on the right the boxes "Current incidents" and "Maintenance". The long list of groups and services is missing, the page is wider than in variant C | E2E: boxes present, list of services absent. Open: placement to the right of the overview from 1024 pixels. | ☐ | ☐ |  |
| G2 | Boxes on the phone | Drag the window narrower than 1024 pixels, set "Boxes on narrow screens" first to "Before the situation overview", then to "After the situation overview" | The boxes stand above or below the situation overview according to the setting. No sideways scrolling | E2E: setting "after" is in the grid, no horizontal scrolling. Open: the actual order above or below the overview. | ☐ | ☐ |  |
| G4 | Blocks below the situation overview | Load with one open and one resolved incident, look through the page | "Current incidents" shows all open ones with their history, "Scheduled Maintenance" the maintenances, "Past Incidents" only resolved ones of the last 5 days. Without an open incident the sentence "No current incidents." appears | E2E: open and resolved incidents, 5-day limit, the sentence "No current incidents.". Open: the block "Scheduled maintenance". | ☐ | ☐ |  |
| G5 | Tooltip with the mouse | Move slowly over a tile, then into the tooltip, then away | The tooltip appears below the tile with the services, each with a coloured dot, without description. When moving into the tooltip it stays open and does not flicker. A click in the tooltip shows the service panel. Moving the mouse away closes it after about a quarter of a second | E2E: hover, moving into the tooltip, a click shows the service panel, closing within 500 ms. Open: coloured dots, flicker, position below the tile. | ☐ | ☐ |  |
| G7 | Tooltip on the phone | Tap a tile, tap again, then tap next to the tile | The first tap shows the tooltip, the second the service panel with bars. A tap next to it closes the tooltip | E2E: the first tap shows the tooltip, the second the service panel. Open: tapping beside the tile closes the tooltip. | ☐ | ☐ |  |
| G8 | Tooltip at the edge | Approach the tiles at the far left and far right with the mouse, also in a narrow window | The tooltip stays inside the grid and is not cut off. Width at most 340 pixels |  | ☐ | ☐ |  |
| G9 | Tile "All" | Look at the first tile (grid symbol, below it "All" only once), click it, click a row, move the mouse over the tile | Meta "n groups · m affected", preselected in variant A. The panel shows one row per group with bar and availability, a click on a row selects the group. The tooltip names the affected groups and "n more groups operational" | E2E and unit: symbol, preselection in variant A, a row selects the group, one row per group with availability. Open: meta "n groups · m affected", text in the tooltip. | ☐ | ☐ |  |
| G11 | Dark mode | Switch dark mode on, look at boxes, strips, tooltip and service panel | Everything readable, strips and dots in the state colours |  | ☐ | ☐ |  |
| G15 | Maintenance bar | Create a maintenance with status "In progress" and impact "Yes" for a service, look at the home page in light and dark, once wide, once narrow | Below the status banner a blue bar "Maintenance in progress: …" shows the counts. The service shows "Maintenance until …, restricted availability". Text readable, the bar wraps when narrow | E2E: bar, counts, suffix on the badge, banner with an incident (`maintenance-bar.spec.ts`), unit tests for counting and text. Open: appearance in light and dark, wrapping when narrow. | ☐ | ☐ |  |

## 7. Operations only (shell access needed)

The operations team runs these points, not the tester in the browser.

| No. | Check | Command | Expectation | Dev | Test | Note |
|---|---|---|---|---|---|---|
| F1 | No restart of the container | Test: `ssh <test-host> "docker inspect -f '{{.RestartCount}}' yasp-app"` | Output `0` | ☐ | ☐ | |
| F2 | No out-of-memory kill | Test: `ssh <test-host> "docker events --since 24h --until 0s --filter event=oom"` | No output | ☐ | ☐ | |
| F3 | Check script for the stack | Run `scripts/check_stack.sh` in the deployment project | Runs through without errors | ☐ | ☐ | |

## 8. Availability report (admin)

Applies to the page `/admin/verfuegbarkeitsbericht` (report, export and email dispatch). Prerequisite: login to the admin, services with disruptions in the chosen period, a service with a long name, a service with an emoji in its name and at least one recipient in the email settings. Points H1 to H11 belong to the report view, H12 to H14 to the export, H15 to H20 to the email dispatch. Reset changed settings afterwards.

| No. | Check | How to check | Expectation | Automatic | Dev | Test | Note |
|---|---|---|---|---|---|---|---|
| H1 | Group list stays put on click | Open the group reports, scroll down the list, click a group further down | The group sheet changes, the list does not jump to the top, the page does not scroll up, the chosen group is marked |  | ☐ | ☐ |  |
| H2 | Group list in a narrow window | Drag the window narrower than 800 pixels, look at the group reports | The list stands above the group sheet at full width (at most 40 % of the window height, then scrollable), no sideways scrolling |  | ☐ | ☐ |  |
| H3 | Bar at 100 % | Look at the group sheet of a group with a service at 100 % (block "Services of the group, weakest first"), light and dark | The bar fills the whole track in light blue, it does not look empty |  | ☐ | ☐ |  |
| H4 | Service names in block 4 | Choose a month with outages of a service with a long name (16 characters or more), look at the block "Disruptions in <month>, by day" | The name stands vertically below the axis and is not cut off at the bottom (if shortened it ends with "…") |  | ☐ | ☐ |  |
| H11 | Preselected group | Open the group reports without `group` in the address, then change the period | The weakest group (first entry of the list) is selected, the page loads without a noticeable wait | Unit: the weakest group is preselected. Open: load time. | ☐ | ☐ |  |
| H14 | Images: emoji and long names | Create a service with an emoji in its name and a group with more than 40 characters, download the ZIP | The images show no box or "?" for the emoji. The group folder in the ZIP has at most 40 characters | Unit: the PDF does not fail on emoji, folder name at most 40 characters. Open: emoji in the image (depends on the fonts in the image). | ☐ | ☐ |  |
| H15 | Dispatch with the keyboard | With the keyboard only: tab to "Send by email", press Enter. Then "Cancel" with Enter | The focus jumps to "Send now", after "Cancel" back to "Send by email", after sending to the message | Unit: the status region exists in every state and can take focus. Open: focus movement with a real keyboard. | ☐ | ☐ |  |
| H16 | Mail server not reachable | Enter an unreachable server under email settings, start the dispatch, reset the value afterwards | After about 10 seconds at most it says "The mail server does not respond … Nothing was sent." |  | ☐ | ☐ |  |
| H17 | Mail text | Dispatch to the catch-all server on `<test-host>` (interface through an SSH tunnel), open mail 1 | The text names "Services in the report: n", PDF and Excel are attached |  | ☐ | ☐ |  |
| H20 | Two dispatches at once | Start "Send now" in two tabs at the same time | One tab reports "A dispatch is already running.", the other dispatches normally | Unit and PostgreSQL test (both run in CI): the second dispatch does not get the lock, a dropped connection frees it, message "running". Open: two tabs in the browser. | ☐ | ☐ |  |
| H21 | Hide ended services | Create a service with an end date of yesterday, then look at the status page, the situation overview, `/api/v1/services` and the incident wizard | The service is missing everywhere. A group with only ended services does not appear | E2E: status page, situation overview and `/api/v1/services` show only active services. Open: the incident wizard. | ☐ | ☐ |  |
| H23 | Report with the switch | Open the report with and without "Include ended services" (light, dark, 390 px) | Ended services appear only with the switch, grey, with "ended on …". The two option circles differ without colour (check against empty ring) | Unit: ranking fields, "ended on", grey row. Open: appearance in light, dark and at 390 pixels, distinction without colour. | ☐ | ☐ |  |
| H24 | Export with ended services | Download ZIP, PDF and Excel with the switch on | Ranking with marks and grey row, Excel with three columns at the end, the switch applies to the export | Unit: Excel columns, image with two marks, grey row, switch in the export addresses. Open: appearance of the downloaded files. | ☐ | ☐ |  |

## 9. Removed, covered by tests

A test covers these points completely. They no longer appear in the tables; their numbers stay reserved. All tests run in CI (`npm run test:unit`, E2E job).

| No. | Check | Test |
|---|---|---|
| A2 | Expand the services of a group | `lagebild.spec.ts` (Klick auf eine Kachel) |
| C2 | Visitor choice beats the default | `lagebild.spec.ts` (Rückschau und Zeitraum des Balkens: Vorgabe, Auswahl, ungültiger Wert) |
| C3 | Change to a service visible at once | `lagebild.spec.ts` (Statusänderung trotz Zwischenspeicher sofort sichtbar) |
| G3 | Number and content of the short form | `status-boxes.spec.ts` (`statusBoxEntries`, `statusBoxContent`) |
| G6 | Tooltip with the keyboard | `status-boxes.spec.ts` (Tab, Esc, `aria-describedby`), `group-tooltip.test.tsx` (Zustandstext) |
| G10 | Address | `lagebild.spec.ts` (Filter je Gruppe), `status-boxes.spec.ts` (Kachel „Alle“) |
| G12 | List (original) unchanged | `status-boxes.spec.ts` (Variante off), `status-page.spec.ts` (Legende) |
| G13, G14 | Variant by address and badge "Test mode" | removed with the test mode "Both" (#21) |
| H5 | Decimal mark in the tooltip | `report-group-sheet-view.test.tsx` (Dezimalzeichen im Tooltip) |
| H6 | Short outage visible | `report-group-sheet-view.test.tsx` (Mindesthöhe eines kurzen Ausfalls) |
| H7 | Heading for a part of a month | `report-group-sheet.test.ts` (Überschrift mit Tagen) |
| H8 | Singular | `report-group-sheet-view.test.tsx`, `report-default-group.test.ts` (Einzahl) |
| H9 | Fields in the group reports | `report-view.test.tsx` (Felder der Gruppenberichte) |
| H10 | Group stays when switching | `report-view-state.test.ts` (Gruppe bleibt beim Wechsel) |
| H12 | File name for a custom period | `report-export-files.test.ts` (`reportBaseName`) |
| H13 | Excel: minutes and maintenance type B | `report-export-excel.test.ts` (Minuten, Wartungsart B) |
| H18 | Invalid recipient address | `report-recipients.test.ts` (`validateRecipients`) |
| H19 | SMTP data when logged out | `email-settings-access.test.ts` (Feldzugriff anonym) |
| H22 | Delete only after the end | `service-delete-rule.test.ts`, `service-delete-notice.test.tsx`, `service-delete.spec.ts` |

## Create the PDF

Run from the directory of the repository. The output is in landscape format so that the tables stay readable:

```bash
pandoc docs/src/development/browser-checklist.en.md \
  --from gfm --to html5 --standalone --metadata pagetitle="Browser Checklist" \
  --pdf-engine=weasyprint --css docs/pdf/checklist.css \
  -o browser-checklist-en.pdf
```

The file `browser-checklist-en.pdf` is not versioned. Hand it to testers to fill in on screen or on paper.
