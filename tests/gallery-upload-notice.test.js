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

assert.match(mainSource, /matchTerm:\s*"한경서울"/);
assert.match(mainSource, /additionalUpload:\s*true/);
assert.match(mainSource, /completeAt:\s*Date\.parse\("2026-10-05T13:30:00\+09:00"\)/);
assert.match(mainSource, /matchTerm:\s*"시흥"/);
assert.match(mainSource, /completeAt:\s*Date\.parse\("2026-10-05T15:00:00\+09:00"\)/);
assert.match(mainSource, /matchTerm:\s*"강남"/);
assert.match(mainSource, /completeAt:\s*Date\.parse\("2026-10-05T17:00:00\+09:00"\)/);
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

const renderEventMatch = mainSource.match(
  /(function getUploadNoticePercent\(event, now\) \{[\s\S]*?\n  \})\n\n  (function renderUploadNoticeEvent\(event, now\) \{[\s\S]*?\n  \})\n\n  function getActiveUploadNoticeEvent/
);
assert.ok(renderEventMatch, "upload-event renderer must remain extractable");
const renderContext = { Date, Math };
vm.runInNewContext(`${renderEventMatch[1]}\n${renderEventMatch[2]}\nthis.renderEvent = renderUploadNoticeEvent;`, renderContext);
const yeouidoHtml = renderContext.renderEvent(
  { name: "2026 한경서울마라톤", additionalUpload: true },
  Date.parse("2026-10-05T14:00:00+09:00")
);
assert.match(yeouidoHtml, /추가 업로드 중/);
assert.doesNotMatch(yeouidoHtml, /shout-upload-notice-track|% 업로드|업로드 완료/);
const siheungHtml = renderContext.renderEvent(
  {
    name: "제12회 시흥시 전국하프마라톤",
    startAt: Date.parse("2026-10-05T09:00:00+09:00"),
    completeAt: Date.parse("2026-10-05T15:00:00+09:00")
  },
  Date.parse("2026-10-05T14:00:00+09:00")
);
assert.match(siheungHtml, /shout-upload-notice-track|% 업로드/);

const context = {
  Date,
  Number,
  String,
  UPLOAD_NOTICE_ENABLED: true,
  UPLOAD_NOTICE_END_AT: Date.parse("2026-10-06T00:00:00+09:00"),
  UPLOAD_NOTICE_EVENTS: [
    {
      name: "2026 한경서울마라톤",
      matchTerm: "한경서울",
      startAt: Date.parse("2026-10-05T07:30:00+09:00"),
      completeAt: Date.parse("2026-10-05T13:30:00+09:00")
    },
    {
      name: "제12회 시흥시 전국하프마라톤",
      matchTerm: "시흥",
      startAt: Date.parse("2026-10-05T09:00:00+09:00"),
      completeAt: Date.parse("2026-10-05T15:00:00+09:00")
    },
    {
      name: "제23회 강남국제평화마라톤",
      matchTerm: "강남",
      startAt: Date.parse("2026-10-05T09:00:00+09:00"),
      completeAt: Date.parse("2026-10-05T17:00:00+09:00")
    }
  ]
};
vm.runInNewContext(`${activeEventMatch[1]}\nthis.getActive = getActiveUploadNoticeEvent;`, context);

assert.equal(
  context.getActive("2026 한경서울마라톤", Date.parse("2026-10-05T13:29:59+09:00")).name,
  "2026 한경서울마라톤"
);
assert.equal(
  context.getActive("2026 한경서울마라톤", Date.parse("2026-10-05T13:30:00+09:00")),
  null,
  "Yeouido notice must stop at 13:30"
);
assert.equal(
  context.getActive("제12회 시흥시 전국하프마라톤", Date.parse("2026-10-05T14:59:59+09:00")).name,
  "제12회 시흥시 전국하프마라톤"
);
assert.equal(
  context.getActive("제12회 시흥시 전국하프마라톤", Date.parse("2026-10-05T15:00:00+09:00")),
  null,
  "Siheung notice must stop at 15:00"
);
assert.equal(
  context.getActive("제23회 강남국제평화마라톤", Date.parse("2026-10-05T16:59:59+09:00")).name,
  "제23회 강남국제평화마라톤"
);
assert.equal(
  context.getActive("제23회 강남국제평화마라톤", Date.parse("2026-10-05T17:00:00+09:00")),
  null,
  "Gangnam notice must stop at 17:00"
);
assert.equal(
  context.getActive("다른 대회", Date.parse("2026-10-05T12:00:00+09:00")),
  null,
  "notice must not show for another event"
);

console.log("main pre-navigation upload-notice regression checks passed");
