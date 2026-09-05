const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const adminJs = fs.readFileSync(path.join(__dirname, "..", "06_Admin-B.js"), "utf8");

test("legacy refresh stays in the legacy dashboard", () => {
  assert.match(adminJs, /id="sot_dash_refresh_btn">데이터 새로고침<\/button>/);
});

test("the ambiguous global snapshot refresh button is removed", () => {
  assert.doesNotMatch(adminJs, /id="sot_current_test_refresh_btn"/);
  assert.doesNotMatch(adminJs, />스냅샷 다시 불러오기<\/button>/);
});

test("report and event analysis render their own current-day refresh action", () => {
  assert.match(adminJs, /function renderCurrentDayRefreshButton\(\)/);
  assert.match(adminJs, /오늘 데이터 최신화/);
  assert.match(adminJs, /data-current-snapshot-refresh/);
  assert.match(adminJs, /<h3>리포트<\/h3>[\s\S]{0,700}\$\{renderCurrentDayRefreshButton\(\)\}/);
  assert.match(adminJs, /<h3>대회별 분석<\/h3>[\s\S]{0,400}\$\{renderCurrentDayRefreshButton\(\)\}/);
});

test("manual refresh moves the selected current view to today's period", () => {
  assert.match(adminJs, /function syncCurrentDashSelectionToToday\(\)/);
  assert.match(adminJs, /syncCurrentDashSelectionToToday\(\);[\s\S]{0,300}loadCurrentTestDashboard\(\{ manualRefresh: true \}\)/);
});
