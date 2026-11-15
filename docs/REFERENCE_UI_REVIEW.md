# Reference-led Home and Record redesign

All three supplied images were inspected visually. This pass implements real React Native screens, not a screenshot or infographic background.

## Visual mapping

| Reference | Observed design | Translation into the app |
| --- | --- | --- |
| 01 primary concept, Home mockup | Compact greeting, neutral segmented filters, white activity cards, scenic photography, restrained typography, orange navigation accent | Greeting and For you/Following/Clubs filters; photo-led editorial card; real activity cards; smaller corners and text; quieter mobile bottom tabs |
| 01 primary concept, Record mockup | Full charcoal surface, large white timer/distance/pace, red-orange central control, two smaller circular controls | Dark recording instrument panel in idle, recording and paused states; vertically stacked primary measurements; circular map/start-pause/finish controls |
| 02 detailed features | Map-based activity tracking, secondary speed/elevation information, feed cards with image and caption | Existing native map retained; mobile map toggle; native map and measurements side by side on desktop; secondary speed and elevation metrics |
| 03 architecture and journeys | Feed-first mobile layout, lower navigation, activity tracking connected to local save and later sync | Existing local recording, recovery, SQLite, authentication and synchronization services retained; no service/database replacement |

The full references are design guides only; none is used as an app image. The new standalone landscape is generated editorial artwork, not a purported athlete photo, named real trail, event or GPS recording.

## Screenshot comparison and corrections

Browser screenshots are captured at **390 × 844** and **1440 × 844** under `artifacts/reference-review/` by `tests/browser/reference-design.spec.ts`.

First review found and corrected these differences:

- Replaced the previous oversized illustrated hero and statistics-first composition with the reference's compact feed and standalone photographic card.
- Removed the extra mobile brand header on Home and Record, retaining the desktop brand header and all existing tab destinations.
- Gave Home a cooler neutral background and reduced card corners. Used an explicit platform sans-serif typeface in the new components and shared activity cards.
- Replaced the previous multi-card recording dashboard with the charcoal instrument panel. Enlarged and centered pace alongside the timer/distance hierarchy, and removed an unnecessary metrics/map segmented bar; the circular map button switches views instead.
- Removed a duplicate desktop Settings action; Home's desktop avatar control now opens Profile.
- Preserved genuine empty states. The web screenshots show zero timer/distance and unavailable pace/speed/elevation, rather than copying the sample numbers in the mockups.

## Behavior and limitations

For you shows editorial inspiration, actual local finished activities and any summaries returned by Supabase. Following queries existing follows and then activity summaries under existing RLS; no follows means an empty feed. Clubs opens the existing community screen. No fictitious members, likes or comments are attached to the editorial image.

Record buttons call the existing start/pause/resume/finish/background/discard services. Sport selection is locked during an existing recording or pending action. The live GPS status uses the freshness of accepted points, and never declares a signal before one is received. Timers update only while recording. The Record screen intentionally keeps its reference's dark instrument surface in both app themes.

Native maps are unchanged. Web uses a clearly labeled grid placeholder with no synthetic route or map coordinates. The browser cannot record GPS. Photography uploads, notifications, camera capture, verified events, wearable metrics and new competition features are not implemented in this pass. No notification or camera buttons are presented as working functionality.

## Asset and generation prompt

Saved asset: `assets/himalayan-editorial.jpg` (1536 × 1024, approximately 668 KB). Created with the built-in imagegen tool; original output copied/converted to JPEG inside the workspace, with the original left intact. No licensed third-party photo was downloaded or embedded. The attempted Wikimedia download failed due to the workspace network restriction.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: landscape photograph for a Nepal fitness mobile app's editorial discovery card. Create an original highly realistic travel photograph of a Himalayan landscape in Nepal: a sunlit narrow stone hiking trail winds from the foreground past a small traditional stone chorten with a few prayer flags, green terraced foothills, immense dramatic white snow covered peaks, clear deep blue sky. Natural late morning light, rich but believable greens, crisp mountain air. Wide landscape 3:2 composition, mountain peaks in upper half, trail and greenery in lower half, all subjects within safe central crop for a 16:9 card. Documentary travel photography, real natural textures, no illustration or vector style. No people, no text, no logos, no UI, no infographic, no numbers, no watermark. This is atmospheric editorial art, not a depiction of an identified actual trail.

## Verification

Completed locally: TypeScript and ESLint pass; all **28 unit tests** pass; Android, iOS and web bundles export successfully; all **29 Playwright tests pass against both production and development web builds**. Console checks find no unexpected text-node or runtime errors. Browser checks cover both themes, mobile/tablet/desktop layout, actual photo loading, feed filters, map switching, zero-value recording display and disabled web recording. The new feed tests verify that Following only requests followed users, handles no follows, excludes GPS fields and surfaces query errors.

Final screenshots were visually reviewed at both requested widths after correcting the first-pass differences listed above. The original GPS/storage/auth/sync services were not changed. Physical-device GPS/background behavior and live Supabase operations still need their existing integration checks. Expo used a fallback React Native DevTools version because the sandbox prevented writing the latest download to its external cache; the development app and tests ran successfully. No commit, push or deployment was performed.
