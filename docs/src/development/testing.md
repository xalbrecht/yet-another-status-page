# Testing

This page describes how the tests of this fork are run, what they cover and which pitfalls have cost time. The basic setup (Docker environment, Playwright, helpers) is in [`tests/README.md`](https://github.com/xalbrecht/yet-another-status-page/blob/main/tests/README.md).

## What exists

- **End-to-end tests** (Playwright, project `chromium`, folder `tests/e2e/`).
- **Unit tests for pure calculation code** (`npm run test:unit`, folder `tests/unit/`, `tsx --test`). They need neither a browser nor a running server. They cover the availability rules in `src/lib/availability.ts`.
- The tests run against **`next dev`** in a Docker container, not against the production image. Behavior that differs in the production build (compile times, memory) is not covered.
- Most tests create their own data through the Payload REST API (`tests/utils/payload-helpers.ts`) and use unique names (`Date.now()`), so they do not depend on the seed data.

### Situation overview (`tests/e2e/lagebild.spec.ts`)

The file runs in `serial` mode, because the tests change the **global settings** (`lagebildVariant`, `lagebildPeriodDays`, `lagebildBarHours`). `afterAll` resets them.

| Test | Covers |
|---|---|
| hidden by default | Situation overview is off in the default settings |
| status change shows as tile, bar and entry | Tile, bar and list entry for variants A and B |
| click on a tile opens the services | `aria-expanded`, panel, 144 strokes per bar, tooltip with time and status, availability, close on second click |
| look-back | Admin default, visitor choice (`?rueckschau=`), invalid value |
| bar period | Admin default 12 or 24 hours, visitor choice (`?balken=`), header text, 144 strokes, invalid value |
| filter per group | Group filter, address (`?gruppe=`) |
| incident sets service status | Incident impact sets the status and resolving resets it |
| worst open status wins | Two open incidents on one service |

### Availability target and reconstruction

- `tests/e2e/availability-target.spec.ts` (serial, resets the setting): default 99, saving 99.5, value above 100 rejected.
- `tests/unit/availability.test.ts`: availability rules and target resolution (service, group, global).
- `tests/unit/incident-classification.test.ts` and `tests/unit/status-reconstruction.test.ts`: classification of incidents and the reconstructed status log.
- The E2E environment creates the schema by schema push, so the SQL of the migrations `20261112_100000` and `20261112_100100` does not run there. Run them against a copy of a database with real incidents (`npx payload migrate` with `DATABASE_URI` pointing to the copy) and check the counts the second migration logs.

### Status log maintenance

- `tests/e2e/status-log-rebuild.spec.ts` (serial): the preview writes nothing, running replaces only reconstructed entries and keeps the operation entries, a second run changes nothing.
- `tests/e2e/maintenance-conversion.spec.ts` (serial): preview, conversion of a resolved maintenance incident (completed maintenance, incident deleted, no notification draft), second run finds nothing, open incidents and incidents classified by hand stay.
- `tests/unit/maintenance-conversion.test.ts`, `tests/unit/status-log-view.test.tsx` and the additions to `tests/unit/incident-classification.test.ts`: planning of the conversion, display of the admin page, classification by hand.
- The admin page itself is not covered by an automatic browser test. Check it by hand: create a user (`POST /api/users/first-register` on a fresh test environment), log in, open `/admin/protokoll-pflege`, run both previews.

### Availability report

- `tests/unit/report-period.test.ts`, `report-maintenance-time.test.ts`, `report-metrics.test.ts`, `report-params.test.ts`, `report-aggregate.test.ts`: periods in the time zone of the settings (including the daylight saving change), maintenance time, the three maintenance types with the example from the concept, selection from the address and the aggregation (group value, months with target met, weakest services).
- `tests/unit/report-view.test.tsx`: display of the page and of the selection fields as text.
- `tests/e2e/availability-report.spec.ts`: the JSON route `/api/availability-report` (data of a group, invalid input gives status 400, at most 10 weakest services).
- The admin page itself is not covered by an automatic browser test. Check it by hand (see the note under "Status log maintenance"): open `/admin/verfuegbarkeitsbericht`, change every selection, compare a month with known outages.

### Not covered

- Mobile layout and tooltips by touch (checked by hand, see [Browser checklist](./browser-checklist.md)).
- The German interface (the test environment runs in English). Only the specs of this fork that accept both languages would notice a missing German text.
- German time formats (the test environment uses `en-US`, so times show as `08:37 PM` and the "yesterday" prefix is not checked).
- Production build, memory and response time under load (see [Measuring](#measuring-performance-and-memory)).
- Availability values against real data (only against test data).

## Running the tests

### Standard

```bash
npm run test:e2e                       # isolated Docker environment, all tests
npm run test:e2e -- tests/e2e/lagebild.spec.ts   # one file
```

The script starts the app on `http://localhost:3001` and a fresh database, seeds data, runs Playwright and removes the containers.

### Behind a TLS-intercepting proxy

`docker-compose.test.yml` runs `npm install` inside the container. A proxy that replaces TLS certificates makes it fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

Set `E2E_CA_FILE` to the CA file of the proxy. `scripts/run-e2e-tests.sh` then adds `docker-compose.test-ca.yml`, which mounts the file into the `app` container and sets `NODE_EXTRA_CA_CERTS`:

```bash
E2E_CA_FILE=/path/to/corporate-ca.pem npm run test:e2e
E2E_CA_FILE=/path/to/corporate-ca.pem npm run test:e2e -- tests/e2e/lagebild.spec.ts --workers=1 --timeout=120000
```

Without `E2E_CA_FILE` nothing changes. If the `app` container stops (for example because `npm install` fails), the script ends at once, prints the container logs and, for the certificate error, a hint to set `E2E_CA_FILE`.

To run the steps of the script by hand:

```bash
E2E_CA_FILE=/path/to/corporate-ca.pem docker compose -p yasp-test \
  -f docker-compose.test.yml -f docker-compose.test-ca.yml up -d
# wait until the container is healthy (npm install takes a few minutes the first time)
until [ "$(docker inspect -f '{{.State.Health.Status}}' yasp-test-app-1)" = healthy ]; do sleep 5; done

API_BASE=http://localhost:3001 node tests/seed/seed-test-data.mjs
curl -s -o /dev/null http://localhost:3001/          # warm up, see below

PLAYWRIGHT_BASE_URL=http://localhost:3001 CI= PAYLOAD_PUBLIC_ALLOW_WRITES=true \
  npx playwright test --project=chromium --workers=1 --timeout=120000 tests/e2e/lagebild.spec.ts

docker compose -p yasp-test -f docker-compose.test.yml -f docker-compose.test-ca.yml down -v --remove-orphans
```

The seed script reads `API_BASE`, Playwright reads `PLAYWRIGHT_BASE_URL`. Both default to different ports (`3001` and `3000`), so set them when you run steps by hand.

## Rules when running

- **Use `--workers=1`** for every spec that changes the global settings. Playwright runs files in parallel by default (`fullyParallel`), and two workers overwrite each other's settings.
- **Never use `--repeat-each` with several workers.** The copies run in parallel and create the row of the global `settings` twice (`select count(*) from settings` returns 2). After that, writes and reads hit different rows and settings seem to switch randomly: the situation overview appears and disappears. Rebuild the environment with `down -v` to recover. Repeat runs with `--workers=1`.
- **Warm up the dev server.** The first request after the container starts takes 6 to 9 seconds (compile). The default test timeout is 30 seconds, so the first test of a cold environment can fail. Request `/` once with `curl` and use `--timeout=120000` on slow machines.
- One run of `lagebild.spec.ts` takes about 25 to 45 seconds on a warm environment.

## Rules when writing tests

- **Wait for hydration before operating a control.** React attaches its handlers after the page has loaded. `selectOption` before that does nothing and the test fails later with a misleading message. Wait until the element has a React property:

  ```ts
  await page.waitForFunction((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`)
    return !!el && Object.keys(el).some((key) => key.startsWith('__reactProps'))
  }, 'lagebild-bar-hours-a')
  ```

- **Do not change the address twice in quick succession.** Opening a group calls `history.replaceState`, the selects call `router.replace`. Directly one after the other, they can overtake each other and the second change is lost (seen in about one of four runs on a fresh environment, not when operated by hand). Test them in separate steps.
- **A change by `router.replace` is only visible after the server has rendered the page.** On the dev server this can take several seconds. Give `toHaveURL` and the following assertions a longer timeout (`{ timeout: 30_000 }`).
- **Reset global settings** in `afterAll`, also when the test fails.
- **Unique names**: `Date.now()` in names of groups and services, and select by name, not by position.
- **The dev server in the container writes to your working directory.** By default Payload rewrites `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js` while it runs, in the language of the interface. The test compose file sets `PAYLOAD_AUTO_GENERATE=false`, so a test run does not change tracked files. If you start the dev server by hand, run `git status` afterwards and restore these two files instead of committing them.
- **Language**: The test compose file builds the application with `NEXT_PUBLIC_UI_LANG=en`, because the upstream specs read English texts ("Page Not Found", "Past Incidents"). Without it the page is German (the default of this fork) and 11 of them fail. Specs written in this fork accept both languages (`/(Letzte|Last) 24 (Stunden|hours)/`), so they pass in either setting.

## Measuring performance and memory

The situation overview calculates a bar per service on every request of the start page (`force-dynamic`). With 166 services this has already caused one outage (issue #23: about 11 seconds per request, container killed at 768 MiB). Measure before and after a change that adds work per service.

**Calculation time** (one-off script, `tsx` is part of the dev dependencies):

```ts
// measure.ts, run with: node_modules/.bin/tsx measure.ts
import { computeBarRuns, computeBarWindow } from './src/lib/lagebild'

const now = Date.now()
const timeline = [{ at: now - 3 * 3600_000, status: 'operational' as const }]
const window = computeBarWindow(now)
const t0 = performance.now()
for (let i = 0; i < 202; i++) computeBarRuns([timeline], window) // 36 groups + 166 services
console.log(`${(performance.now() - t0).toFixed(0)} ms`)
```

Reference values for 202 timelines on the development machine: 11 s before the fix of issue #23, 650 ms after it, 16 ms with the strokes of issue #29. Do not format times per slot on the server: `formatTime` costs about 0.6 ms per call.

**Memory under load** (container with limit, here the test environment of the deployment project):

```bash
docker stats --no-stream --format '{{.MemUsage}}' yasp-app          # memory against the limit
docker exec yasp-app curl -s -o /dev/null http://localhost:3000/    # one request inside the container
docker inspect yasp-app --format 'RestartCount={{.RestartCount}} OOMKilled={{.State.OOMKilled}}'
docker events --since 60m --until 0s --filter container=yasp-app --filter event=oom   # empty = no kill
```

Increase the load in small steps and stop at about 80 % of the limit. A container **without** a limit grew much more than one with a limit under a similar load (observed: 1.2 GiB without, below 300 MiB with a 768 MiB limit), so measure in the setting that has the limit.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Application failed to start after 60 attempts", empty logs | `npm install` in the container fails or is still running | `docker logs yasp-test-app-1`, see the proxy section |
| Situation overview appears and disappears between runs | Row of the settings exists twice | `down -v`, rebuild, no parallel repeats |
| First test times out, later ones pass | Cold dev server | Warm up with `curl`, raise `--timeout` |
| `toHaveURL` never matches after `selectOption` | Not hydrated yet, or two quick address changes | Wait for hydration, separate the steps |
| Test passes alone, fails in the full run | Test depends on global settings of another test | Set the settings it needs at its start |
| Many tests fail with "element not found" for English texts | Application was built in German (`NEXT_PUBLIC_UI_LANG` not `en`) | Use `docker-compose.test.yml`, or set `NEXT_PUBLIC_UI_LANG=en` when you start the dev server by hand |
