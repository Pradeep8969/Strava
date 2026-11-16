# Safe Edge → Brave planned-route transfer

The user has confirmed the original routes still exist in Edge. The apparent
loss was separate browser storage, not deletion. Edge remains the source of truth.
No real routes were accessed, exported, imported or changed by this task.

This process copies planned routes only. It does not transfer sign-in sessions,
workouts, Supabase data, downloadable map tiles or navigation capabilities.

## 1. Export in Edge — read-only

1. In **Edge**, open the exact StravaKinda URL and browser profile where the
   routes are visible. Confirm their names in Route Studio. Pause route editing
   while taking the snapshot. Do not clear site data or change origin/port.
2. Open F12 → **Sources → Snippets → New snippet**. Open the repository file
   `scripts/route-storage-diagnostic.js` in your editor, review it, and paste its
   contents into the snippet. Run with Ctrl+Enter. This trusted local snippet
   reads storage; it does not modify IndexedDB or make network requests.
3. Inspect the console report. Find `IndexedDB:stravakinda/kv/routes` and confirm
   its route count and names match your Edge routes. If that location is absent,
   there are errors reading it, or the count differs, stop before transfer and
   investigate. Other legacy locations are diagnostic only, not auto-imported.
4. In the Edge Console run:

   ```js
   window.stravaRouteRecovery.exportPrivateBackup()
   ```

5. Save the resulting `stravakinda-private-routes-....json` file. This contains
   private coordinates. Keep it locally; do not upload it, paste its contents
   into chat/Console, or commit it. The diagnostic report contains names/counts,
   not coordinates. Keep the downloaded original as well as the verified copy.

There is **no import command to run in Edge**. Leave its route storage intact.

## 2. Create and verify a private disk backup

Open PowerShell in the repository. Replace the example filename with the actual
download path; leave the quotes around it:

```powershell
Set-Location 'D:\StravaKinda_Nepal_Redesigned_Project\StravaKinda-main'
node .\scripts\route-backup.mjs 'C:\path\to\Downloads\stravakinda-private-routes-....json'
```

Wait for `Verified private backup: ...`. This creates a uniquely named JSON file
and matching `<filename>.json.sha256` in `private-route-backups/`. It verifies
the copied bytes with SHA-256 and never overwrites an earlier backup. The folder
is Git-ignored; it is not encrypted. Keep it under your private local account
permissions. Do not proceed if verification fails. Save both files as a pair.

The next file-picker steps use **this verified JSON copy and its SHA-256 sidecar**,
not a JSON file opened and resaved in an editor. A checksum detects changed bytes;
it is not a signature proving the file came from a trusted person. Use only your
own freshly exported file.

## 3. Prepare in Brave — no import yet

1. Open the intended StravaKinda URL in your normal **Brave** profile. Visit
   Route Studio once so the app has initialized its normal storage. This can be
   a different browser origin from Edge; future Brave visits must use this same
   URL/profile to see the imported routes.
2. Close other StravaKinda tabs in Brave and stop route editing for this transfer.
   Keep the Edge originals intact. No browser profile directories are copied.
3. In Brave F12 → Sources → Snippets, create and run a new snippet containing
   the reviewed local file `scripts/route-import.js`. Loading it writes nothing.
4. In the Brave Console run:

   ```js
   await window.stravaRouteImport.chooseSource()
   ```

   Two file pickers open in sequence: select the **verified Edge JSON backup**,
   then its **matching `.json.sha256` file**. The tool verifies the actual bytes,
   validates the routes, and reports only the source origin and count.
5. Run:

   ```js
   await window.stravaRouteImport.preview()
   ```

   Review `existing`, `incoming`, `additions`, `duplicates`, `conflicts`, `names`
   and the destination `origin`. This is read-only. Counts should match your
   expectations. Identical ID/name/ordered geometry, or identical name/geometry
   under a different ID, is treated as a duplicate and skipped. A shared ID with
   different name/geometry is a conflict and blocks the entire import. Existing
   destination metadata is always retained. Malformed/duplicate IDs within a
   source, unsupported routing mode, bad geometry, or malformed destination data
   blocks import rather than silently discarding records. Zero additions means
   no transfer is necessary; you may stop here.

## 4. Back up Brave before any write

1. In Brave run:

   ```js
   window.stravaRouteImport.exportDestinationBackup()
   ```

   This downloads the exact route-list snapshot used for preview, including an
   empty list if Brave has none. It records when the original key was absent.
2. Run the same PowerShell backup command from step 2 on **this new destination
   download**. Keep the resulting new JSON/checksum pair; it must not replace
   the Edge backup. The unique filenames prevent accidental overwrite.
3. Back in Brave run:

   ```js
   await window.stravaRouteImport.verifyDestinationBackup()
   ```

   Select the **verified Brave destination JSON**, then its matching sidecar.
   The tool checks checksum, destination origin, and equality with the preview
   snapshot. A source backup, stale destination backup, or wrong origin is
   rejected. No route has been imported at this point.

## 5. Optional explicit import — only when you decide to proceed

The development task stopped before executing this on real data. If you later
choose to transfer after reviewing all counts and securing both backups, run
**in Brave only**:

```js
await window.stravaRouteImport.commit("IMPORT ADDITIONS")
```

It appends only validated nonduplicate records, retaining all original destination
records and unknown metadata. It never deletes keys, clears a store, reroutes
geometry or replaces an existing route. Because the current format stores one
array under `routes`, appending necessarily writes an extended array to that
key; it does not replace the database or overwrite existing route records.

The commit holds the same Web Lock used by current app saves, opens one read/write
IndexedDB transaction, and rechecks the destination against the preview inside
that transaction. A changed destination aborts with no write. Request failure,
quota failure or transaction abort rolls the whole operation back automatically;
success is reported only after transaction completion. Repeated import previews
identify already-added records as duplicates. No automatic retries or imports
occur. Backup verification is consumed by each commit attempt.

If anything fails, stop and retain both backups. For a changed destination,
preview again and export/verify a fresh destination backup before retrying. Do
not manually clear data or use `setValue`, `put` or pasted JSON to force recovery.
There is no automatic post-success undo: such an undo could delete later user
edits. The private pre-import backup remains available for a separately reviewed
recovery if needed.

After success, reload Brave and confirm both old Brave routes and new copies in
Route Studio and Explore. Fully close/reopen Brave at the same URL/profile and
check again. Independently reopen Edge and confirm every original route is still
present. Retain the Edge source, source backup and Brave pre-import backup.

Refreshing the page removes the in-memory tool; rerun its snippet, select the
source and repeat preview/backup verification if needed. Web Locks and Web Crypto
are required; use HTTPS or localhost. Legacy sources outside the canonical
IndexedDB route array need separate review and are not guessed or migrated.

## Implementation and verification

Added files only: `scripts/route-import.js`,
`tests/browser/route-transfer.spec.ts`, `playwright.route-transfer.config.ts`,
this document and `artifacts/route-transfer/` preservation manifests.
All pre-existing Phase 1A–1B.6 source files and tools retain their baseline hashes.
No app screen, map, persistence format, OAuth, Supabase data, key or service was
changed. No commit, push, deployment or real import was performed.

Validation:

- TypeScript, ESLint and all 212 unit tests passed.
- Transfer browser suite runs against installed Edge and Brave executables in
  isolated automation profiles, never the user's normal profiles. It covers
  additive preservation, repeat import deduplication, malformed and unsupported
  source/destination records, ID conflicts, checksum mismatch, wrong destination
  backup/origin, missing confirmation, stale preview and rollback after a real
  queued IDB write is deliberately aborted.
- Final browser run: 12 tests passed (6 Edge, 6 Brave), no failures or skips.
- Integration test exercises the actual diagnostic export/download, private disk
  backup command/checksum, file-picker import, preserved source records, page
  reload and Explore display, using synthetic fixtures only.
- Web export passed to `dist/route-transfer-check`.

Reproduce: `npm.cmd exec -- playwright test --config playwright.route-transfer.config.ts --workers=1`.
Override `BRAVE_EXECUTABLE` only if Brave is installed elsewhere. Native apps are
unaffected; this is specifically a browser-to-browser route-copy process.
