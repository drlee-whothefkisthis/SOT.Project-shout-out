# v1.0.0 verification

- Archived all 45 previously tracked repository files and the complete Webflow export before editing; SHA-256 copies verified.
- Compared page editor scripts/styles with the exported HTML. AdminGate Head was recovered from the complete export because its editor was lazily rendered.
- 18 historical CDN assets under the renamed GitHub owner returned 200 and matched the original source bytes.
- All 19 root JavaScript files passed syntax checks; root distribution contains 33 JS/CSS assets.
- 48 existing automated checks passed (auth/payment, desktop/mobile checkout order, consent preservation, admin refresh, gallery notice and main sorting).
- Original browser render harness could not run because the local Playwright module is unavailable. Focused CUA checks on the exported layout passed: desktop/mobile recent cards, search suggestions, month filter, no mobile overflow, GeneralLog, AdminGate and payment loader.
- Local browser fetches were mocked. No real login, payment approval, order replay, form submission or protected download was performed.
- All original SVG/archived Embeds and generated Webflow HTML/CSS/JS are versioned in `originals` / `embeds`. Archived Weglot examples were preserved, not activated.
- This is a frontend code delivery migration. Webflow settings/Publish and Bubble were not changed.

Release CDN verification completed: all 33 v1.0.0 root assets returned HTTP 200 and match local SHA-256 hashes. Tag commit: `f7e293ea9199221e7fe94ff8406b9fbe7ff2ac4a`. See `evidence/release-cdn-verification.json`. The tag was not moved.
