# Phase 5 — Analytics, Plus & Organizer Studio

Implemented in the existing Expo SDK 58 / React Native application on 2026-11-14. No dependency upgrades, new packages, backend migrations or deployments were made.

Organizer session-only behavior described below is historical. [Phase 5.5](PHASE55_ORGANIZER_REVIEW.md) supersedes it with persistent local drafts and organizer profiles, confirmed deletion, previews and real draft reports. Live publication, registration and payments remain unavailable.

## Implemented

### Training analytics

The existing `/analytics` route now has a responsive dashboard with Week/Month/Year controls, sport filters, distance/moving-time/activity summaries, active-day counts, reusable native bar charts, a dark distance-trend card, per-sport breakdowns, weekly-goal progress, measured pace/ascent, personal bests and earned/locked milestone presentation.

All calculations use completed workouts from the existing store and `stats` utility. Unlinked local workouts and the current account's linked workouts are eligible; another account's linked workouts, unfinished sessions and future/invalid completion times are excluded. Calendar groups use local date boundaries. The monthly chart groups days 1–7, 8–14 and so on; yearly charts use calendar months. Active days count distinct local dates, not a synthesized fitness score.

The distance trend stops at the current calendar bucket, so it does not forecast a decline to zero in future months/days. The bar chart retains the full calendar labels with no fabricated future activity. The current bucket receives the orange accent. Empty datasets show zero totals and no invented bars or trend lines.

Personal bests use the existing whole-activity record logic and link to the source workout. Milestones are earned only from actual completion/distance thresholds. Weekly goals reuse preferences and remain explicitly all-sport goals even when a particular sport or period is selected. Unknown elevation is shown as unavailable; heart rate, power, VO₂ max, training load, heatmaps and structured plans are explicitly unavailable or planned. No sensor or physiological values are invented.

### StravaKinda Plus

The existing `/subscription` route now has a Nepal-inspired cover, Free foundation/Plus roadmap presentation, coaching setup status, store-plan layout, access-check state, restore controls and store-management links. Free recording/history/local analytics remain available without a paid entitlement.

`services/purchases.ts` and `utils/entitlements.ts` were not changed. The screen still calls the existing RevenueCat `packages`, `buy`, `restore` and `premiumStatus` functions. Titles/prices come only from returned store products. Purchase/restore status is set active only after the existing entitlement validation succeeds. Screen state resets on account changes.

Native store actions require a signed-in account and iOS/Android. Web shows a clearly explained mobile-store state with disabled purchase/restore/access-check controls. Apple/Google subscription settings remain real links. No hardcoded price, fake trial, discount, subscription period or checkout is shown. Plus features under development are not represented as unlocked merely because an entitlement exists.

### Organizer studio

A new `/organizer` route is reachable through the analytics and subscription screens, without changing earlier redesigned main screens. It provides:

- A dark desktop organizer sidebar; compact mobile/tablet navigation for Overview, Events, Participants, Reports and Organizer.
- A clearly labeled preview workspace, event-management area, event status badges and empty participant/registration tables.
- Create/edit forms with event name, proposed location/date, sport, description, optional proposed capacity and an existing-asset banner picker.
- Working validation and session-only preview draft save/edit/search/filter interactions. Editing a draft updates it rather than creating a duplicate.
- Organizer profile/contact fields kept only within the preview session. They do not edit the athlete account, create an organizer identity or grant permissions.
- Actual session-draft counts and a draft-planning chart, separately labeled from live event reporting.
- Unavailable live-event, participant and revenue figures shown as `—`, not invented zeroes or sample business results. Registration status chips are explicitly a presentation legend.
- Disabled publishing, participant export, financial export and registration-payment controls, with explanations.

No event/organizer/registration/payment tables or corresponding services were found in the current schema. Organizer drafts live solely in component state during the workspace session. Reloading resets them; no event data is written to workout storage, Supabase or a payment service. All preview dates, names and capacity values come from the form, never a fabricated confirmed inventory.

## Visual comparison and refinement

All three design-reference images were reviewed. Individual interfaces informed the implementation; no infographic is used as a background.

| Reference | Applied patterns |
| --- | --- |
| 01, Training & Analytics / Premium / Organizer dashboard | Compact metric cards, teal performance bars, chart controls, organizer sidebar and event/participant table layout |
| 02, Premium Features / Event Organizer Dashboard | Dark trend panel with real data, clearly grouped advanced metrics, reporting panels, visible event status and editing affordances |
| 03, Performance Analytics / Premium Features | Week/Month/Year navigation, sport-aware summaries, white/navy cards and restrained orange highlights |

Screenshots were inspected at **390 × 900**, **768 × 900** and **1440 × 900**, in both light and dark themes. Refinements tightened long mobile navigation groups so all five organizer sections fit at 390px, cleared form errors when inputs change, bounded chart labels, gave organizer charts a context-specific empty message, highlighted the current calendar bucket and removed future zeroes from the trend line. Tablet summaries use four columns; mobile summaries use two. Organizer forms and card layouts adapt without horizontal page overflow.

Existing approved generated editorial assets (`himalayan-editorial.jpg`, `pokhara-editorial.jpg`, `ridge-editorial.jpg`) provide Plus/organizer covers and form banner choices. These are decorative Nepal-inspired artwork, not claims about a real event venue or athlete photograph.

## Screenshot artifacts

Saved in `artifacts/phase5-review/`, each at 390/768/1440 widths and light/dark themes:

- `analytics-empty-…png`: real empty local-history state.
- `analytics-year-test-fixture-…png`, `analytics-analysis-test-fixture-…png`: isolated populated calculations and lower analysis sections.
- `subscription-…png`, `subscription-store-state-…png`: premium presentation and disabled web-store state.
- `organizer-overview-…png`, `organizer-participants-…png`, `organizer-reports-…png`: honest unavailable-service states.
- `organizer-form-test-fixture-…png`, `organizer-events-test-fixture-…png`, `organizer-profile-test-fixture-…png`: preview-form interactions using explicit test input.

Files marked `test-fixture` are test evidence, not real user history, confirmed events or organizer accounts. Test workouts are injected into the preview's existing in-memory store only. Organizer test drafts are created through the UI. Tests reload and verify both draft and workout counts return to zero; no fake workouts, registrations or payments are inserted into user storage.

## Verification

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed without warnings.
- `npm.cmd test`: **56 tests passed across 13 files**.
- `npx.cmd expo export --platform web`: passed.
- `npx.cmd playwright test`: **60 browser tests passed**, including all earlier screen suites.
- After the final trend refinement, TypeScript/lint and the six focused Phase 5 viewport/theme workflows passed again and screenshots were refreshed.

New unit tests cover empty analytics, calendar/year/leap-month boundaries, account/completion eligibility, actual metric sums, distinct active days, sport filtering, unavailable altitude, milestone thresholds and preview-event date/capacity validation. RevenueCat service tests use a mocked SDK to verify store-package passthrough, fail-closed purchase entitlement checks, restoration, expired status and native-store rejection on web. They perform no purchases or real SDK calls.

Browser tests cover actual fixture totals across periods/sports, time chart switching, future-free trend labels, disabled web billing, preview creation/editing, banner selection, validation, unavailable payment/publishing/export controls, organizer sections/profile, reload reset, image loading, bounds/overflow and browser errors at every required width/theme.

## Changed files

| File | Purpose |
| --- | --- |
| `src/app/analytics.tsx` | Real-workout analytics dashboard |
| `src/app/subscription.tsx` | Subscription presentation retaining RevenueCat calls/validation |
| `src/app/organizer.tsx` | Organizer preview workspace and session state |
| `components/dashboard-ui.tsx` | Scoped headers, controls, metrics, notices and native bar/line charts |
| `components/organizer-ui.tsx` | Organizer navigation, draft cards/forms and empty tables |
| `features/analytics/dashboard.ts` | Eligible workout selection, calendar grouping and actual summaries/milestones |
| `features/organizer/drafts.ts` | Preview form types/defaults and validation |
| `tests/dashboard.test.ts` | Analytics and preview-form calculation/boundary tests |
| `tests/purchases.test.ts` | Existing RevenueCat/entitlement contract checks with mocks |
| `tests/browser/phase5-design.spec.ts` | Responsive screenshots and workflows |
| `.gitignore` | Ignore generated Phase 5 screenshots |
| `docs/PHASE5_UI_REVIEW.md`, `docs/PROGRESS.md`, `DESIGN_REDESIGN_README.md` | Current report and navigation notes |

The local `dist/` export and screenshots were regenerated. Home, Record, Explore, Events, Activities, Profile, Clubs, Challenges and Social source files were not edited. GPS, offline recording/storage, synchronization, Supabase authentication/privacy/schema and existing purchase services were not modified. No commit, push or deployment was performed.

## Remaining backend and device requirements

- Organizer authentication/roles, event ownership/storage, publishing lifecycle, custom image upload and event inventory APIs.
- Participant/registration models, access-controlled personal data, real status transitions, check-in and export/reporting services.
- Payment-provider integration, verified webhooks, reconciliation/refunds and authoritative revenue data. No such actions are simulated as working.
- Durable organizer draft/profile persistence; current previews intentionally end with the session.
- Validated sensor ingestion/processing for heart rate, power, VO₂ max or training load. Heatmaps, structured plans and advanced comparisons remain planned.
- RevenueCat products, offerings, platform SDK keys, store review and sandbox/device validation for actual purchases, restore and cancellation behavior. These were not exercised against a live store.
- Existing AI-coach server configuration, verified premium access and explicit summary-sharing consent remain required. The coaching service was not modified or represented as producing results here.
- Native device and live Supabase validation remain outstanding; this pass validated TypeScript, unit behavior, web exports and browser layouts/flows. Analytics covers completed workouts already present on the device; existing sync/restore remains responsible for linked cloud history.
