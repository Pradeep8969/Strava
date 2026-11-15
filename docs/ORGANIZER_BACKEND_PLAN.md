# Organizer backend connection plan

Design proposal only. No migration, Supabase write, publication endpoint, registration or payment action is enabled by Phase 5.5.

## Existing foundation

Reviewed `202610250001_initial.sql` and `202610250002_social_limits.sql`. They provide athlete profiles, settings, activities, routes, clubs, memberships, challenges, social permissions, subscriptions and related services. They do not provide organizer ownership/verification, publishable events, event registrations or payment records. Club membership and athlete authentication alone must not grant organizer permissions.

The local implementation separates pure draft/profile models, a versioned workspace repository and platform storage. Native storage reuses the existing SQLite `kv` table. Web uses organizer-only localStorage. Keys distinguish guests from individual authenticated accounts. Guest plans are never automatically assigned to the next person who signs in.

## Proposed tables

| Table | Purpose and important fields | Access |
| --- | --- | --- |
| `organizers` | UUID, owner profile ID, display name, description, location, supported sports, banner reference, verification status, timestamps | Owner/team can read private draft; sanitized public projection only after approval. Verification fields are server/staff controlled. |
| `organizer_contacts` | Organizer ID, private email, phone, contact/social links | Owner and explicitly authorized staff only. Exclude from public event/profile queries. |
| `organizer_members` | Organizer ID, profile ID, role; unique membership | Server-validated invitations and role changes. No self-granted organizer role. |
| `events` | UUID, organizer ID, client draft UUID, title, sport, description, venue, timezone, start/end timestamps, planning capacity, banner key, status, revision, timestamps | Owner/team draft access. Public SELECT only for published records belonging to approved organizers. |
| `event_schedule` | Event ID, ordered schedule items, start/end timestamps, description | Inherit parent event authorization. Translate the current freeform local schedule through explicit review. |
| `event_publication_requests` | Event ID, requesting owner, review status, reviewer, validation result, audit timestamps | Requester can submit/read; staff or protected service can approve. Immutable audit trail. |
| `organizer_draft_links` | Owner ID, local draft UUID, remote event UUID, acknowledged revision | Unique owner/local-draft pair provides idempotent import. Private to the owner. |
| `event_categories` | Event ID, category name/sport and eventual capacity constraints | Parent event authorization. Needed before category-based registration. |
| `event_registrations` (future) | Event/category IDs, athlete ID, authoritative registration state and timestamps | Athlete reads their own; approved event staff reads only permitted participant fields. No anonymous registration list. |
| Financial records (future) | Provider references, immutable webhook events, reconciled transactions/refunds | Trusted server only for writes; restricted reporting. Not implemented or simulated. |

## Authorization and publication workflow

1. Finish authentication/session restoration and require a current session before offering any remote import. Present guest-local plans separately and obtain an explicit choice about which plans to associate with the account.
2. Create an owner-bound organizer draft under row-level security. Keep verification, publication state, privileged memberships and financial status out of client-controlled metadata. Staff verification requires a protected server workflow.
3. Import explicitly selected local drafts through an authenticated operation. Use the local UUID plus authenticated owner ID as an idempotency key. Record remote IDs/revisions separately; a failed import never destroys local plans. Resolve competing revisions explicitly. This is not implemented synchronization.
4. Validate fields, supported sports, future start/end dates, Asia/Kathmandu timezone, venue, category constraints, capacity and content on the server. Validate media size/type and strip metadata where necessary. Local form checks are convenience checks, not authorization.
5. Keep draft banners in a private storage bucket with owner/team policies. Only publish approved media through a public projection or authorized URL strategy. Never publish organizer contact information incidentally through an event join.
6. A publication request is accepted only for an authorized member of an approved organizer. A transaction/secure RPC validates current verification and event revision before moving a reviewed event to `published`; record who published which revision. Anonymous clients cannot insert/update events. An arbitrary authenticated athlete cannot claim organizer ownership by sending an ID.
7. Restrict anonymous reads to a sanitized published-event projection. Revoking organizer verification or cancelling/unpublishing an event must remove it from discovery. Public responses must exclude private contact details, participant information and internal review notes.
8. Implement registrations, capacity transitions, exports and reporting only after authorization tests and authoritative records exist. Payments require provider contracts, idempotent signed webhooks, reconciliation and refund handling. UI buttons remain unavailable until those flows are actually connected.

## Required security and integration checks

Test guest access, wrong-owner access, team roles, revoked roles, unverified publication, forged verification/status fields, private contact joins, unpublished event/media access, duplicate imports, concurrent revision conflicts, deletion, session expiry and sign-out/account switching. Keep service-role credentials on the server. Use existing subscription entitlement checks only for subscription features; a Plus entitlement is not organizer authorization.

## Local storage boundaries

The current version-1 record contains event UUIDs, creation/update timestamps and organizer planning fields. All events are unconditionally unpublished in this client; no locally stored flag confers publication or verification. New schema versions require an explicit migration, not a silent reset. Reads validate stored values; unreadable data blocks editing until retry or an explicitly confirmed workspace reset.

Contact details stay on this device/browser origin and are never sent to a public service by this feature. SQLite/localStorage are not additional encrypted vaults. Clearing browser/app data or uninstalling can remove plans. Account-scoped local plans stay on the device when signed out but are not displayed in another account's workspace. There is no cloud backup, cross-device synchronization, import/export UI or concurrent multi-tab conflict resolution yet. Repository writes are serialized within one application runtime and reread current stored state before applying a mutation.
