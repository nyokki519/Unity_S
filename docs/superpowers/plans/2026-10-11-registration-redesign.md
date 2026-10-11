# Unity registration redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Select published events, prompt first-time participants to add official LINE and send 初参加/参加希望, review submissions and retain the Google Forms workflow without exposing contact information.

**Architecture:** Keep static HTML/CSS/JS in Unity_S. Add a current/next-month scheduling API and authenticated Sheets participant reading in Analytics. Keep legacy three-entry submissions functional; save optional metadata only with verified Form mappings.

**Tech Stack:** HTML/CSS/JavaScript, Node 22 node:test, Python Playwright/Chromium, existing Next.js/TypeScript and Google Apps Script.

**Spec:** docs/registration-approved-spec.md (user reviewed; implementation and routine approvals explicitly authorized).

## Global Constraints

- No email input or collection; first-time LINE addition/message required by guidance; returning 参加希望 unchanged; experience has no default.
- No production fake submissions or real LINE/email delivery.
- No personal data in public feeds, growth, logs, URLs or browser persistent storage.
- Preserve existing Form entry IDs, sheet headers, answers and anonymous tracking trigger.
- Use existing isolated checkouts; no extra worktree.
- No fee/capacity/registration-acceptance inference from public schedules or no-cors responses.

## Review Focus

- API refresh during editing must preserve personal inputs and must not silently submit a changed event.
- Missing optional metadata must preserve legacy submissions; invalid or duplicate configured entries must stop sending.
- Failed POST may already be accepted: preserve inputs, prohibit automatic retries and duplicate sends.
- Sheet credential absence must fail closed after private reading is configured; no anonymous fallback.
- Same title/date with different event IDs must remain distinct; legacy rows remain supported.

## Task 1: Event and submission model

**Files:** registration-core.js; tests/registration-core.test.cjs.
**Interfaces:** normalizeFeed(payload, now), japanDate(value), validateRegistration(data), readiness(config), buildPayload(data, config).

- [x] Write tests for JST boundaries, future current/next events, invalid feeds, experience-dependent LINE guide/copy and absence of email, configuration gate and exact payload.
- [x] Run `node --test tests/registration-core.test.cjs`; observe missing behavior.
- [x] Implement pure model with no personal-data persistence; run tests to green.

## Task 2: Static UI and functional browser checks

**Files:** index.html; registration.css; registration.js; registration-config.js; tools/check-registration-browser.py; .github/workflows/tracking-test.yml.
**Interfaces:** browser controller consumes Task 1 model and explicit public config; renders selection/manual/details/review/result steps; actual submit event fires once per send attempt.

- [x] Write browser checks for experience selection, event/manual input, review/edit, result unknown, mapping gate, refresh removal, keyboard, responsive widths and no-PII tracking.
- [x] Run checks against old UI; observe absent controls.
- [x] Implement mobile-first cream/brown/gold interface, honest result and LINE action; run browser checks and inspect screenshots.

## Task 3: Google Form setup and private participant source

**Files:** integrations/google-form/RegistrationSetup.gs and tests; Analytics lib/participant-sheet-reader.ts, lib/participants-source.ts, app/api/participants/route.ts, components/EventParticipants.tsx and parser tests.
**Interfaces:** Form setup returns verified entry mapping without contacting participant data; private reader requests approved fields only; participant API uses existing admin authentication; eventId optional supports old rows.

- [x] Write mocked Apps Script tests for idempotence, private destination precondition, actual prefill entries and experience-dependent LINE guide/copy and absence of email; reader/auth/parser regression tests.
- [x] Observe failures before implementing; implement fail-closed setup and read-only Sheets source.
- [x] Run focused tests; document actual owner actions and migration order without claiming production execution.

## Task 4: Scheduling API and HP link

**Files:** Analytics lib/public-monthly-events.ts, lib/public-registration-events.ts, app/api/public/registration-events/route.ts and tests; HP script.js and browser check.
**Interfaces:** new feed `{version:1,timeZone:'Asia/Tokyo',months:[current,next],events:[public fields]}`; existing monthly response unchanged; HP local registration link appends only event_id.

- [x] Write current/next feed tests including month boundary, hidden data exclusion, past events and unchanged current-month API; HP event-specific fallback link test.
- [x] Observe failures; implement additive API and query-safe local link; run focused tests.

## Task 5: Verification and handoff

**Files:** docs/registration-rollout.md; README.md; /workspace/reports implementation evidence and patches.

- [x] Run Unity_S full Node suite and browser suite; HP relevant Node/browser checks; Analytics focused/full tests, typecheck and build.
- [x] Dispatch one fresh final reviewer as required by executing-plans; reproduce important findings as failing tests before fixing.
- [x] Save verified diffs/commits, deployment order and outstanding external prerequisites. Never collect email. Document unconfigured downstream event ID distinction.
- [x] Preserve applicable configuration and report tested versus externally blocked capabilities.

External activation prerequisites remain pending; completed checkboxes describe code, mock verification and handoff, not production Google execution.
