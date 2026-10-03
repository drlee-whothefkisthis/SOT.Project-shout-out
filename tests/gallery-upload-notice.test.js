const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const mainSource = fs.readFileSync(path.join(root, "01-Main.js"), "utf8");
const galleryBodySource = fs.readFileSync(path.join(root, "02-Gallery-B.js"), "utf8");
const galleryRuntimeSource = fs.readFileSync(path.join(root, "02-Gallery-B.runtime.js"), "utf8");
const galleryHeadSource = fs.readFileSync(path.join(root, "02-Gallery-H.css"), "utf8");

assert.match(mainSource, /matchTerm:\s*"안동"/);
assert.match(mainSource, /completeAt:\s*Date\.parse\("2026-10-04T17:00:00\+09:00"\)/);
assert.match(mainSource, /matchTerm:\s*"홍천"/);
assert.match(mainSource, /completeAt:\s*Date\.parse\("2026-10-04T15:00:00\+09:00"\)/);
assert.match(mainSource, /prepareGalleryUploadNotice\(eventId\);\s*window\.location\.href = targetUrl;/);

for (const source of [galleryBodySource, galleryRuntimeSource]) {
  assert.match(source, /sessionStorage\.removeItem\(GALLERY_UPLOAD_NOTICE_KEY\)/);
  assert.match(source, /now >= completeAt/);
  assert.match(source, /expectedEventCode !== currentEventCode/);
  assert.match(source, /사진 업로드 진행 중/);
  assert.match(source, /검색 결과에 모든 사진이 표시되지 않을 수 있습니다/);
}

assert.match(galleryHeadSource, /#gallery-upload-notice/);
assert.match(galleryHeadSource, /@media \(max-width:767px\)/);

const consumeMatch = galleryRuntimeSource.match(
  /(function consumeGalleryUploadNotice\(eventCode\) \{[\s\S]*?\n  \})\n\n  function showGalleryUploadNotice/
);
assert.ok(consumeMatch, "consumeGalleryUploadNotice must remain extractable for regression checks");

function consumeAt(now, payload, eventCode) {
  const values = new Map([["shout_gallery_upload_notice", JSON.stringify(payload)]]);
  const context = {
    Date: { now: () => now },
    JSON,
    Number,
    String,
    console,
    sessionStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      removeItem: key => values.delete(key)
    }
  };
  vm.runInNewContext(
    `const GALLERY_UPLOAD_NOTICE_KEY = "shout_gallery_upload_notice";\n${consumeMatch[1]}\nthis.consume = consumeGalleryUploadNotice;`,
    context
  );
  const result = context.consume(eventCode);
  return { result, remaining: values.size };
}

const active = consumeAt(999, {
  eventCode: "261004-ad",
  completeAt: 1000,
  endAt: 2000
}, "261004-ad");
assert.equal(active.result.completeAt, 1000);
assert.equal(active.remaining, 0, "notice marker must be one-shot");

assert.equal(consumeAt(1000, {
  eventCode: "261004-ad",
  completeAt: 1000,
  endAt: 2000
}, "261004-ad").result, null, "notice must not show at or after completion");

assert.equal(consumeAt(999, {
  eventCode: "261004-ad",
  completeAt: 1000,
  endAt: 2000
}, "261004-hc").result, null, "notice must not leak to another event");

assert.equal(consumeAt(2000, {
  eventCode: "261004-ad",
  completeAt: 3000,
  endAt: 2000
}, "261004-ad").result, null, "notice must not show after the global end time");

console.log("gallery-upload-notice regression checks passed");
