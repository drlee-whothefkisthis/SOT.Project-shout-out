# SOT Webflow custom code

Canonical custom JavaScript and CSS are the numbered files at the repository root.
Repository: https://github.com/project01-SOT/SOT.Project-shout-out
Release: global snippets `v1.0.1`; existing page snippets `v1.0.0` — never move a published tag; release fixes as `v1.0.1`, etc.

The former `00-Global-Head.js` is merged into `00-Global.js` under the existing DOM-ready initializer. Global Head now contains CSS only. Page snippets remain at v1.0.0.

## Editing and delivery

- Root `00-Name.js` / `00-Name.css`: edit these files for active custom behavior/styles.
- `webflow/snippets/`: exact Head/Footer/page replacement snippets, preserving SDK order and the existing Admin `defer`.
- `webflow/source-manifest.json`: source commits, hashes, page mappings and Embed inventory.
- `webflow/originals/`: read-only pre-migration editor input and complete exported HTML/generated JS/CSS.
- `webflow/embeds/`: all 249 exported Embed occurrences, including static SVG and archived Weglot examples. Static markup continues to be placed by Webflow; its original is versioned here.
- `legacy/`: previous filenames retained as reference, not active source. Existing SHA-pinned production URLs remain available in their original commits.
- `versions/`: historical material retained.

`00-Auth.js` is a canonical shared helper mirrored in Login/MyPage/Admin. It is not an additional site-wide script tag in this release.
`06-Admin.js` now contains the former body code directly; `06-Admin.css` includes the same responsive style formerly fetched by the runtime loader. No dynamic filename-dependent loader remains.
`04-MyPage-Head.js` preserves the early event-map helper. `08-Payment-Loader.js` and `08-Payment.css` preserve the payment-return loading UI before the approval script.
Toss/Kakao/Webflow/jQuery vendor dependencies retain their official distribution URLs or Webflow-generated loading. Do not put server secrets in frontend files.

## Scope and deployment

This release reorganizes frontend source/delivery only. Authentication/payment contracts, standard/master access and the deferred photo ZIP feature are preserved. Bubble needs no changes.
Webflow settings and Publish were not changed by this migration. Replace Site Settings common Head/Footer and each page's Head/Body using the guide, then publish and verify the live site.
Archived Untitled is not promoted or refactored: its old multiple Weglot script examples are versioned in originals/embeds. Keep it archived. Utility 404/Search have no extra page code; they receive the global snippets.

See [Webflow paste guide](webflow/PASTE-GUIDE.md) and [source verification](webflow/VERIFICATION.md).
