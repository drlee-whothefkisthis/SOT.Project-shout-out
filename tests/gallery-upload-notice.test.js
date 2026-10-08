const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const mainSource = fs.readFileSync(path.join(root, "01-Main.js"), "utf8");
const mainCssSource = fs.readFileSync(path.join(root, "01-Main.css"), "utf8");
const galleryBodySource = fs.readFileSync(path.join(root, "02-Gallery-B.js"), "utf8");
const galleryRuntimeSource = fs.readFileSync(path.join(root, "02-Gallery-B.runtime.js"), "utf8");
const galleryHeadSource = fs.readFileSync(path.join(root, "02-Gallery-H.css"), "utf8");

assert.doesNotMatch(mainSource, /matchTerm:\s*"한경서울"/);
assert.doesNotMatch(mainSource, /matchTerm:\s*"시흥"/);
assert.doesNotMatch(mainSource, /matchTerm:\s*"강남"/);
assert.match(mainSource, /matchTerm:\s*"홍성"/);
assert.match(mainSource, /startAt:\s*Date\.parse\("2026-10-09T08:00:00\+09:00"\)/);
assert.match(mainSource, /progressStartAt:\s*Date\.parse\("2026-10-09T09:30:00\+09:00"\)/);
assert.match(mainSource, /completeAt:\s*Date\.parse\("2026-10-09T13:00:00\+09:00"\)/);
assert.match(mainSource, /UPLOAD_NOTICE_END_AT = Date\.parse\("2026-10-10T00:00:00\+09:00"\)/);
assert.match(mainSource, /shout-upload-notice-event-status">업로드 대기중/);
assert.match(mainSource, /const waiting = activeEvent\.progressStartAt && Date\.now\(\) < activeEvent\.progressStartAt/);
assert.match(mainSource, /function showGalleryUploadNoticeBeforeNavigation\(eventCode, targetUrl\)/);
assert.match(mainSource, />확인<\/button>/);
assert.match(mainSource, /if \(showGalleryUploadNoticeBeforeNavigation\(eventId, targetUrl\)\) return;/);
assert.doesNotMatch(mainSource, /shout_gallery_upload_notice/);
assert.match(mainCssSource, /#main-gallery-upload-notice/);
assert.match(mainCssSource, /@media \(max-width:767px\)/);

for (const source of [galleryBodySource, galleryRuntimeSource, galleryHeadSource]) {
  assert.doesNotMatch(source, /gallery-upload-notice/);
  assert.doesNotMatch(source, /shout_gallery_upload_notice/);
}

const activeEventMatch = mainSource.match(
  /(function getActiveUploadNoticeEvent\(eventName, now\) \{[\s\S]*?\n  \})\n\n  function syncUploadNoticeSpacing/
);
assert.ok(activeEventMatch, "active upload-event matcher must remain extractable");

const context = {
  Date,
  Number,
  String,
  UPLOAD_NOTICE_ENABLED: true,
  UPLOAD_NOTICE_END_AT: Date.parse("2026-10-10T00:00:00+09:00"),
  UPLOAD_NOTICE_EVENTS: [
    {
      name: "2026 제26회 홍성마라톤",
      matchTerm: "홍성",
      startAt: Date.parse("2026-10-09T08:00:00+09:00"),
      progressStartAt: Date.parse("2026-10-09T09:30:00+09:00"),
      completeAt: Date.parse("2026-10-09T13:00:00+09:00")
    }
  ]
};
vm.runInNewContext(`${activeEventMatch[1]}\nthis.getActive = getActiveUploadNoticeEvent;`, context);

assert.equal(
  context.getActive("2026 한경서울마라톤", Date.parse("2026-10-09T10:00:00+09:00")),
  null,
  "Yeouido notice must be removed"
);
assert.equal(
  context.getActive("제12회 시흥시 전국하프마라톤", Date.parse("2026-10-09T10:00:00+09:00")),
  null,
  "Siheung notice must be removed"
);
assert.equal(
  context.getActive("제23회 강남국제평화마라톤", Date.parse("2026-10-09T10:00:00+09:00")),
  null,
  "Gangnam notice must be removed"
);
assert.equal(
  context.getActive("2026 제26회 홍성마라톤", Date.parse("2026-10-09T07:59:59+09:00")),
  null,
  "Hongseong notice must not begin before race start"
);
assert.equal(
  context.getActive("2026 제26회 홍성마라톤", Date.parse("2026-10-09T08:00:00+09:00")).progressStartAt,
  Date.parse("2026-10-09T09:30:00+09:00"),
  "Hongseong notice must include its waiting cutoff"
);
assert.equal(
  context.getActive("2026 제26회 홍성마라톤", Date.parse("2026-10-09T12:59:59+09:00")).name,
  "2026 제26회 홍성마라톤"
);
assert.equal(
  context.getActive("2026 제26회 홍성마라톤", Date.parse("2026-10-09T13:00:00+09:00")),
  null,
  "Hongseong gallery notice must stop at 13:00"
);
assert.equal(
  context.getActive("다른 대회", Date.parse("2026-10-09T12:00:00+09:00")),
  null,
  "notice must not show for another event"
);

const percentMatch = mainSource.match(
  /(function getUploadNoticePercent\(event, now\) \{[\s\S]*?\n  \})\n\n  function getActiveUploadNoticeEvent/
);
assert.ok(percentMatch, "upload percentage function must remain extractable");
const percentContext = { Math };
vm.runInNewContext(`${percentMatch[1]}\nthis.getPercent = getUploadNoticePercent;`, percentContext);
const hongseong = context.UPLOAD_NOTICE_EVENTS[0];
assert.equal(percentContext.getPercent(hongseong, Date.parse("2026-10-09T09:29:59+09:00")), 0);
assert.equal(percentContext.getPercent(hongseong, Date.parse("2026-10-09T09:30:00+09:00")), 1);
assert.equal(percentContext.getPercent(hongseong, Date.parse("2026-10-09T11:15:00+09:00")), 51);
assert.equal(percentContext.getPercent(hongseong, Date.parse("2026-10-09T12:59:59+09:00")), 99);
assert.equal(percentContext.getPercent(hongseong, Date.parse("2026-10-09T13:00:00+09:00")), 100);

console.log("main pre-navigation upload-notice regression checks passed");
