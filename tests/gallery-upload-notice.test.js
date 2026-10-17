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

function extractFunction(name) {
  const match = mainSource.match(new RegExp(`(function ${name}\\([^]*?\\n  \\})`));
  assert.ok(match, `${name} must remain extractable`);
  return match[1];
}

assert.match(mainSource, /UPLOAD_EXTRA_HOURS = 3/);
assert.match(mainSource, /UPLOAD_NOTICE_EVENTS = \[\]/);
assert.doesNotMatch(mainSource, /2026-10-09T(?:08|09|13):/);
assert.match(mainSource, /limit=100&cursor=/);
assert.match(mainSource, /setInterval\(refreshUploadNoticeEvents, UPLOAD_NOTICE_REFRESH_MS\)/);
assert.match(mainSource, /notice\.getActiveEvent\(race\)/);
assert.match(mainSource, /function showGalleryUploadNoticeBeforeNavigation\(eventCode, targetUrl\)/);
assert.match(mainSource, />확인<\/button>/);
assert.match(mainSource, /if \(showGalleryUploadNoticeBeforeNavigation\(eventId, targetUrl\)\) return;/);
assert.doesNotMatch(mainSource, /shout_gallery_upload_notice|업로드 대기중/);
assert.match(mainCssSource, /#main-gallery-upload-notice/);
assert.match(mainCssSource, /@media \(max-width:767px\)/);

for (const source of [galleryBodySource, galleryRuntimeSource, galleryHeadSource]) {
  assert.doesNotMatch(source, /gallery-upload-notice|shout_gallery_upload_notice/);
}

const context = {
  Array,
  Date,
  Math,
  Number,
  String,
  HOUR_MS: 60 * 60 * 1000,
  DAY_MS: 24 * 60 * 60 * 1000,
  KST_OFFSET_MS: 9 * 60 * 60 * 1000,
  UPLOAD_EXTRA_HOURS: 3,
  UPLOAD_NOTICE_ENABLED: true,
  UPLOAD_NOTICE_EVENTS: []
};
const names = [
  "getCourseDurationHours",
  "nextKstMidnight",
  "buildUploadNoticeEvent",
  "isUploadNoticeActive",
  "getUploadNoticePercent",
  "getActiveUploadNoticeEvent"
];
vm.runInNewContext(`${names.map(extractFunction).join("\n")}\n${names.map(name => `this.${name} = ${name};`).join("\n")}`, context);

const start = Date.parse("2026-10-18T07:30:00+09:00");
const fixture = {
  event_code: "261018-ghm",
  event_display_name: "2026 아시아 오픈 마라톤대회",
  event_date: "2026-10-17T22:30:00.000Z",
  publish_at: "2026-10-17T21:00:00.000Z",
  course: ["Half", "10K"],
  is_public: true
};
const event = context.buildUploadNoticeEvent(fixture, start);
assert.ok(event);
assert.equal(event.startAt, start);
assert.equal(event.progressStartAt, Date.parse("2026-10-18T08:30:00+09:00"));
assert.equal(event.completeAt, Date.parse("2026-10-18T13:30:00+09:00"));
assert.equal(event.endAt, Date.parse("2026-10-19T00:00:00+09:00"));

assert.equal(context.getUploadNoticePercent(event, start), 1);
assert.equal(context.getUploadNoticePercent(event, start + 60 * 60 * 1000 - 1), 1);
assert.equal(context.getUploadNoticePercent(event, start + 60 * 60 * 1000), 1);
assert.equal(context.getUploadNoticePercent(event, Date.parse("2026-10-18T11:00:00+09:00")), 51);
assert.equal(context.getUploadNoticePercent(event, event.completeAt - 1), 99);
assert.equal(context.getUploadNoticePercent(event, event.completeAt), 100);

context.UPLOAD_NOTICE_EVENTS = [event];
assert.equal(context.isUploadNoticeActive(start - 1), false);
assert.equal(context.isUploadNoticeActive(start), true);
assert.equal(context.isUploadNoticeActive(event.endAt - 1), true);
assert.equal(context.isUploadNoticeActive(event.endAt), false);
assert.equal(context.getActiveUploadNoticeEvent({ id: event.id }, start - 1), null);
assert.equal(context.getActiveUploadNoticeEvent({ id: event.id }, event.completeAt - 1).name, event.name);
assert.equal(context.getActiveUploadNoticeEvent({ id: event.id }, event.completeAt), null);
assert.equal(context.getActiveUploadNoticeEvent({ id: "another-event" }, start), null);

const full = context.buildUploadNoticeEvent({ ...fixture, course: ["Full", "Half"] }, start);
assert.equal(full.completeAt, Date.parse("2026-10-18T15:30:00+09:00"));
const short = context.buildUploadNoticeEvent({ ...fixture, course: ["10K", "5K"] }, start);
assert.equal(short.completeAt, Date.parse("2026-10-18T12:30:00+09:00"));
assert.equal(context.buildUploadNoticeEvent({ ...fixture, is_public: false }, start), null);
assert.equal(context.buildUploadNoticeEvent({ ...fixture, home_visible: false }, start), null);
assert.equal(context.buildUploadNoticeEvent({ ...fixture, publish_at: "2026-10-18T00:00:00.000Z" }, start), null);
assert.equal(context.buildUploadNoticeEvent({ ...fixture, course: ["Unknown"] }, start), null);
assert.equal(context.buildUploadNoticeEvent({ ...fixture, event_date: "2026-10-17T15:00:00.000Z" }, start), null);

let renderNow = start;
let hidden = false;
const elements = { "shout-upload-notice-list": { innerHTML: "" } };
const renderContext = {
  Date: { now: () => renderNow },
  UPLOAD_NOTICE_EVENTS: [event],
  document: { getElementById: id => elements[id] },
  createUploadNotice: () => {},
  hideUploadNotice: () => { hidden = true; },
  isUploadNoticeActive: now => context.isUploadNoticeActive(now),
  getUploadNoticePercent: context.getUploadNoticePercent,
  escapeUploadNoticeHtml: value => value,
  syncUploadNoticeSpacing: () => {},
  scheduleNextUploadNoticeUpdate: () => {}
};
vm.runInNewContext(`${extractFunction("updateUploadNotice")}\nthis.update = updateUploadNotice;`, renderContext);
renderContext.update();
assert.match(elements["shout-upload-notice-list"].innerHTML, /1% 업로드/);
assert.match(elements["shout-upload-notice-list"].innerHTML, /width:1%/);
renderNow = event.completeAt;
renderContext.update();
assert.match(elements["shout-upload-notice-list"].innerHTML, /업로드 완료/);
assert.match(elements["shout-upload-notice-list"].innerHTML, /width:100%/);
renderNow = event.endAt;
renderContext.update();
assert.equal(hidden, true);

console.log("automatic main upload-notice and pre-navigation regression checks passed");
