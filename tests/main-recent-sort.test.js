const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "01-Main.js"), "utf8");
const start = source.indexOf("  function recentEventDay(race) {");
const end = source.indexOf("  function eventMonthKey(race) {", start);
assert.ok(start >= 0 && end > start, "recent-event sort functions must be present");
assert.match(source, /const newestGroup = homeEvents\.filter\(race => race\.recent_group === 0\)/);
assert.match(source, /participant_count:\s*Number\.isFinite\(Number\(item\.people\)\)/);
assert.doesNotMatch(source, /TODAY_HOT_EVENT_ORDER/);

const context = { Date, Intl };
vm.runInNewContext(`${source.slice(start, end)}\nthis.sortRecentEvents = sortRecentEvents;`, context);

const events = [
  ["261005-sh", "2026-10-05T00:00:00.000Z", 5000],
  ["260920-sd", "2026-09-19T23:00:00.000Z", 15000],
  ["261004-hc", "2026-10-04T00:00:00.000Z", 3000],
  ["261005-gn", "2026-10-05T00:00:00.000Z", 10000],
  ["261004-ad", "2026-10-03T23:00:00.000Z", 10000],
  ["261005-yyd", "2026-10-04T22:30:00.000Z", 7000]
].map(([id, date, people]) => ({ id, name: id, event_date: new Date(date), participant_count: people }));

const sorted = context.sortRecentEvents(events);
assert.deepEqual(Array.from(sorted, event => event.id), [
  "261005-gn", "261004-ad", "261005-yyd", "261005-sh", "261004-hc", "260920-sd"
]);
assert.equal(sorted[0].recent_group, sorted[4].recent_group, "October 4 and 5 must be one group");
assert.notEqual(sorted[4].recent_group, sorted[5].recent_group, "September 20 must be another group");
console.log("main recent-event group and people sorting checks passed");
