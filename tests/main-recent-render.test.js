const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const bodySource = fs.readFileSync(path.join(root, "01-Main.js"), "utf8");
const headSource = fs.readFileSync(path.join(root, "01-Main.css"), "utf8");
const scripts = [bodySource];
const style = headSource;

const events = [
  ["260628-sd", "2026 송도 이봉주 마라톤", "2026-06-27T15:00:00.000Z", "2026-06-27T15:00:00.000Z"],
  ["260620-cj", "2026 제25회 충주마라톤", "2026-06-19T15:00:00.000Z", "2026-06-19T15:00:00.000Z"],
  ["260614-dj", "2026 대전 월드런 마라톤", "2026-06-13T15:00:00.000Z", "2026-06-12T21:25:00.000Z"],
  ["260531-gs", "2026 금산 월드런 마라톤", "2026-05-30T15:00:00.000Z", "2026-05-21T01:39:00.000Z"],
  ["260614-ic", "2026 인천광역시장기배 건강달리기", "2026-06-13T15:00:00.000Z", "2026-06-13T00:13:00.000Z"],
  ["260607-yd", "2026 iM뱅크 코리아오픈 마라톤", "2026-06-06T15:00:00.000Z", "2026-06-04T01:41:00.000Z"],
  ["260517-ic", "2026 인천광역시 육상연맹회장배 마라톤", "2026-05-16T15:00:00.000Z", "2026-05-12T10:01:00.000Z"],
  ["260502-bs", "2026 제21회 보성 녹차 마라톤", "2026-05-01T15:00:00.000Z", "2026-04-30T08:20:00.000Z"],
  ["260419-kk", "2026 제24회 경기마라톤대회", "2026-04-18T15:00:00.000Z", "2026-04-18T16:00:00.000Z"]
].map(([event_code, event_display_name, event_date, publish_at]) => ({
  event_code,
  event_display_name,
  event_date,
  publish_at,
  is_public: true,
  name_search_enabled: true,
  bib_min_digits: 4
}));

// Ranking and publication time must not override event-date ordering.
events.find(event => event.event_code === "260531-gs").home_rank = 1;
events.find(event => event.event_code === "260531-gs").home_score = 9999;
events.find(event => event.event_code === "260531-gs").publish_at = "2026-07-01T00:00:00.000Z";
events.find(event => event.event_code === "260620-cj").event_course_info = "Full, Half, 10K";
events.find(event => event.event_code === "260620-cj").course = ["10K", "5K"];
events.find(event => event.event_code === "260607-yd").event_course_info = "Half, 10K";
events.reverse();

(async () => {
  const executablePath = process.env.CHROME_EXECUTABLE_PATH;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {})
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(5000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error));
  try {
    await page.route("**/*", route => {
      if (route.request().resourceType() === "image") return route.abort();
      return route.continue();
    });
    await page.route("**/obj/event?limit=200", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ response: { results: events } })
    }));

    await page.setContent(`<!doctype html><html><head><style>${style}</style></head><body>
      <section id="main-search">
        <div id="app-search-photos-form">
          <form><input id="app-event-id-input"><div id="app-event-suggestions"></div><input id="app-bib-input"><div id="app-bib-action-btn"><img><span id="app-bib-action-icon"></span></div></form>
        </div>
      </section>
      <section class="section-recent"><div class="recent-wrapper w-container"><div class="passion-bg">legacy</div></div></section>
    </body></html>`);
    for (const script of scripts) await page.addScriptTag({ content: script });

    await page.waitForSelector(".sot-recent-past-card").catch(error => {
      if (pageErrors.length) throw pageErrors[0];
      throw error;
    });
    assert.equal(await page.locator(".passion-bg").count(), 0, "legacy Webflow DOM should be replaced");
    assert.equal(await page.locator(".sot-recent-feature, .sot-recent-feature__overlay").count(), 0);
    assert.equal(await page.locator(".sot-recent-title, .sot-recent-heading").count(), 0);
    assert.equal(await page.locator("#sot-recent-hot-title").textContent(), "인기 대회");
    assert.equal(await page.locator(".sot-recent-hot-card").count(), 4);
    assert.deepEqual(
      await page.locator(".sot-recent-hot-card").evaluateAll(cards => cards.map(card => card.dataset.eventCode)),
      ["260628-sd", "260620-cj", "260614-dj", "260614-ic"]
    );
    assert.equal(await page.locator(".sot-recent-hot-badge").count(), 1);
    assert.equal(await page.locator(".sot-recent-group").getAttribute("aria-labelledby"), "sot-recent-hot-title");
    assert.equal(await page.locator(".recent-event[href]").count(), 0);
    assert.equal(await page.locator("button.recent-event").count(), 9);
    assert.equal(await page.locator(".sot-recent-panel").count(), 1);
    assert.equal(
      await page.locator(".sot-recent-panel").evaluate(panel => getComputedStyle(panel).backgroundColor),
      "rgb(245, 245, 245)"
    );
    assert.equal(
      await page.locator(".sot-recent-panel").locator(".sot-recent-group, .sot-recent-past").count(),
      2,
      "hot and past sections should share one outer card"
    );
    const pastCodes = await page.locator(".sot-recent-past-card").evaluateAll(cards => cards.map(card => card.dataset.eventCode));
    assert.equal(pastCodes.length, 5, `unexpected past cards: ${pastCodes.join(", ")}`);
    assert.equal(pastCodes[0], "260607-yd");
    assert.equal(await page.locator("#sot-recent-events-root img").count(), 0);
    assert.equal(await page.locator(".sot-recent-message").count(), 0);
    assert.equal(await page.locator(".sot-recent-subtitle").count(), 0);
    assert.equal(await page.locator(".sot-recent-hot-card__chevron").count(), 0);
    assert.equal(
      await page.locator(".sot-recent-hot-card").first().evaluate(card => getComputedStyle(card).boxShadow),
      "rgba(32, 51, 70, 0.024) 0px 7px 18px 0px"
    );
    assert.equal(await page.locator(".sot-recent-past-grid").evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(" ").length), 1);
    assert.equal(await page.locator('[data-event-code="260607-yd"] .sot-recent-past-card__title').textContent(), "iM뱅크 코리아오픈 마라톤");
    assert.equal(await page.locator('[data-event-code="260607-yd"] .sot-recent-past-card__day').textContent(), "7");
    assert.equal(await page.locator('[data-event-code="260607-yd"] .sot-recent-past-card__month').textContent(), "6월");
    assert.equal(await page.locator('[data-event-code="260607-yd"] .sot-recent-past-card__course').textContent(), "Half, 10K");
    assert.equal(await page.locator('[data-event-code="260517-ic"] .sot-recent-past-card__course').textContent(), "Full, Half, 10K, 5K");
    assert.equal(await page.locator(".sot-recent-past-card .arrow").count(), 5);
    assert.equal(await page.locator(".sot-recent-hot-card .arrow").count(), 4);
    assert.equal(await page.locator('[data-event-code="260620-cj"] .sot-recent-hot-card__day').textContent(), "20");
    assert.equal(await page.locator('[data-event-code="260620-cj"] .sot-recent-hot-card__month').textContent(), "6월");
    assert.equal(await page.locator('[data-event-code="260620-cj"] .sot-recent-hot-card__course').textContent(), "10K, 5K");
    assert.equal(await page.locator('[data-event-code="260628-sd"] .sot-recent-hot-card__course').textContent(), "Full, Half, 10K, 5K");
    assert.equal(await page.locator(".sot-recent-hot-card .arrow").first().textContent(), "›");
    assert.deepEqual(await page.locator(".sot-recent-month option").allTextContents(), [
      "전체 월", "2026년 6월", "2026년 5월", "2026년 4월"
    ]);

    await page.locator("#app-event-id-input").fill("광역시 갖기배");
    assert.equal(await page.locator(".suggestion-item").count(), 1);
    assert.equal(await page.locator(".suggestion-item").first().textContent(), "2026 인천광역시장기배 건강달리기");
    await page.locator(".suggestion-item").click();
    assert.equal(await page.locator("#app-event-id-hidden").inputValue(), "260614-ic");
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "app-bib-input");

    await page.locator('[data-event-code="260620-cj"]').click();
    assert.equal(await page.locator("#app-event-id-input").inputValue(), "2026 제25회 충주마라톤");
    assert.equal(await page.locator("#app-event-id-hidden").inputValue(), "260620-cj");
    assert.equal(await page.locator(".sot-recent-message").count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "app-bib-input");
    await page.waitForTimeout(500);
    assert.equal(await page.locator("#app-event-id-input").inputValue(), "2026 제25회 충주마라톤");
    assert.equal(await page.locator("#app-event-id-hidden").inputValue(), "260620-cj");
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "app-bib-input");

    await page.locator(".sot-recent-month").selectOption("2026-04");
    assert.equal(await page.locator(".sot-recent-past-card").count(), 1);
    assert.equal(await page.locator('.sot-recent-past-card[data-event-code="260419-kk"]').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

    const mobileHotBoxes = await page.locator(".sot-recent-hot-card").evaluateAll(cards => cards.map(card => {
      const rect = card.getBoundingClientRect();
      return { top: rect.top, width: rect.width };
    }));
    assert.equal(new Set(mobileHotBoxes.map(box => box.top)).size, 1, "mobile cards should share a horizontal scrolling row");
    assert.ok(mobileHotBoxes.every(box => Math.abs(box.width - mobileHotBoxes[0].width) < 1));

    await page.locator(".sot-recent-month").selectOption("all");
    const carousel = page.locator(".sot-recent-hot-list");
    assert.ok(await carousel.evaluate(el => el.scrollWidth > el.clientWidth));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SOT_MOBILE_PREVIEW) {
      await page.locator(".sot-recent-events").screenshot({ path: process.env.SOT_MOBILE_PREVIEW });
    }
    await carousel.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: "instant" }));
    await page.waitForFunction(() => document.querySelector(".sot-recent-hot-list").scrollLeft > 0);
    await page.locator('.sot-recent-hot-card[data-event-code="260614-ic"]').click();
    assert.equal(await page.locator("#app-event-id-hidden").inputValue(), "260614-ic");
    assert.equal(await page.evaluate(() => document.activeElement.id), "app-bib-input");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.mouse.move(0, 0);
    assert.equal(await page.locator(".sot-recent-past-grid").evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(" ").length), 2);
    const hotBoxes = await page.locator(".sot-recent-hot-card").evaluateAll(cards => cards.map(card => {
      const rect = card.getBoundingClientRect();
      return { top: rect.top, width: rect.width, height: rect.height };
    }));
    assert.equal(new Set(hotBoxes.map(box => box.top)).size, 1, "desktop cards should share one row");
    assert.ok(Math.max(...hotBoxes.map(box => box.width)) - Math.min(...hotBoxes.map(box => box.width)) < 1);
    assert.equal(new Set(hotBoxes.map(box => box.height)).size, 1);
    await page.locator('.sot-recent-hot-card[data-event-code="260620-cj"]').hover();
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll(".sot-recent-hot-card");
      return cards[1].getBoundingClientRect().width > cards[0].getBoundingClientRect().width * 1.5;
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SOT_DESKTOP_PREVIEW) {
      await page.locator(".sot-recent-events").screenshot({ path: process.env.SOT_DESKTOP_PREVIEW });
    }
    await page.locator('[data-event-code="260628-sd"]').click();
    await page.waitForTimeout(500);
    assert.equal(await page.locator("#app-event-id-input").inputValue(), "2026 송도 이봉주 마라톤");
    assert.equal(await page.locator("#app-event-id-hidden").inputValue(), "260628-sd");
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "app-bib-input");
    // Put the cards well below the search inputs and disable the browser's
    // implicit focus scrolling: card clicks must explicitly reveal both inputs.
    await page.addStyleTag({ content: "#main-search{margin-top:500px;margin-bottom:1400px} body{padding-bottom:1200px}" });
    await page.evaluate(() => {
      const bib = document.getElementById("app-bib-input");
      const nativeFocus = bib.focus.bind(bib);
      bib.focus = () => nativeFocus({ preventScroll: true });
    });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const code of ["260620-cj", "260419-kk"]) {
        await page.locator(`button.recent-event[data-event-code="${code}"]`).click();
        await page.waitForFunction(() => {
          const input = document.getElementById("app-event-id-input").getBoundingClientRect();
          const bib = document.getElementById("app-bib-input").getBoundingClientRect();
          return input.top >= 0 && input.bottom <= innerHeight && bib.top >= 0 && bib.bottom <= innerHeight;
        });
        assert.equal(await page.locator("#app-event-id-hidden").inputValue(), code);
        assert.equal(await page.evaluate(() => document.activeElement.id), "app-bib-input");
        await page.keyboard.type("1234");
        assert.equal(await page.locator("#app-bib-input").inputValue(), "1234");
      }
    }
    assert.deepEqual(pageErrors, []);

    console.log("main recent events render test: ok");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
