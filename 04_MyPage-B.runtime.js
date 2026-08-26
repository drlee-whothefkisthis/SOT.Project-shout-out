(function () {
function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

onReady(function () {
  document.documentElement.classList.remove("mp-zip-enabled");
  function getMyPageEventSelectEl(){
    return (
      document.getElementById("mypage-event-filter") ||
      document.getElementById("mp-event-select") ||
      document.querySelector('select[name="mypage-event-filter"]') ||
      document.querySelector('select')
    );
  }

  function isZipEnabledSelection(val) {
    const v = (val || "").trim();
    if (!v) return false;

    const low = v.toLowerCase();

    if (low === "all") return false;
    if (low === "전체") return false;
    if (low.includes("선택")) return false;

    return true;
  }

  function syncZipEnabledClass(){
    const sel = getMyPageEventSelectEl();
    const val = sel ? sel.value : "";
    if (isZipEnabledSelection(val)){
      document.documentElement.classList.add("mp-zip-enabled");
    }else{
      document.documentElement.classList.remove("mp-zip-enabled");
    }
  }

  console.log("[MyPage] Loaded");

  const API_BASE = "https://plp-62309.bubbleapps.io/api/1.1";
  const WF_GET_PURCHASES = `${API_BASE}/wf/get_my_purchases`;
  const WF_SIGNED_URL = `${API_BASE}/wf/get_signed_download_url`;
  const WF_SIGNED_ZIP_URL = `${API_BASE}/wf/get_signed_zip_url`; // ZIP WF

  const usersId = localStorage.getItem("shout_users_id");
  const accessToken = sessionStorage.getItem("shout_access_token") || "";

  const selectEl = document.getElementById("mypage-event-filter");
  const listEl = document.getElementById("sh-purchase-list");
  const template = document.querySelector(".purchased-card.is-template");
  const zipBtn = document.getElementById("mp-download-all");

  const eventTitleEl = document.getElementById("mp-event-title");
  const eventDateEl = document.getElementById("mp-event-date");
  const eventBibEl = document.getElementById("mp-event-bib");

  function pickElByIds(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  function ensureEventHeaderEls() {
    let titleEl = pickElByIds(["mp-event-title", "mp-event-name", "mypage-event-title", "mypage-event-name", "event-title", "event-name"]);
    let dateEl  = pickElByIds(["mp-event-date", "mp-date", "mypage-event-date", "event-date"]);
    let bibEl   = pickElByIds(["mp-event-bib", "mp-bib", "mypage-event-bib", "event-bib"]);

    if (!titleEl && !dateEl && !bibEl) {
      const label = [...document.querySelectorAll("body *")].find(el => {
        const t = (el.textContent || "").trim();
        if (t !== "대회명") return false;
        return el.children.length === 0 || el.tagName.toLowerCase() === "div" || el.tagName.toLowerCase() === "h";
      });

      if (label && label.parentElement) {
        const wrap = document.createElement("div");
        wrap.className = "mp-event-meta-auto";
        wrap.style.marginTop = "6px";
        wrap.style.fontSize = "13px";
        wrap.style.lineHeight = "18px";
        wrap.style.opacity = "0.8";

        titleEl = document.createElement("div");
        titleEl.id = "mp-event-title";
        titleEl.style.fontWeight = "600";

        dateEl = document.createElement("div");
        dateEl.id = "mp-event-date";

        bibEl = document.createElement("div");
        bibEl.id = "mp-event-bib";

        wrap.appendChild(titleEl);
        wrap.appendChild(dateEl);
        wrap.appendChild(bibEl);

        label.parentElement.insertBefore(wrap, label.nextSibling);
      }
    }

    return {
      titleEl: titleEl || document.getElementById("mp-event-title"),
      dateEl: dateEl || document.getElementById("mp-event-date"),
      bibEl: bibEl || document.getElementById("mp-event-bib"),
    };
  }

  const __eventHeaderEls = ensureEventHeaderEls();

  const pageLoader = document.getElementById("ids-loading");

  if (!usersId || !accessToken) {
    console.warn("[MyPage] authenticated session not found");
    if(pageLoader) pageLoader.style.display = "none";
    try {
      sessionStorage.setItem("shout_auth_intent", JSON.stringify({
        after: "mypage",
        return_to: window.location.href,
        fallback_to: window.location.origin + "/mypage",
        created_at: Date.now()
      }));
    } catch (e) {
      console.warn("[MyPage] auth intent store failed", e);
    }
    window.location.href = "/login";
    return;
  }
  if (!listEl || !template) {
    console.warn("[MyPage] list/template not found");
    if(pageLoader) pageLoader.style.display = "none";
    return;
  }

  function extractEventCodeFromPath(pathOrUrl) {
    if (!pathOrUrl) return "";
    const s = String(pathOrUrl);
    const clean = s.replace(/^https?:\/\/[^/]+/i, "");
    const parts = clean.split("/").filter(Boolean);
    if (parts.length >= 1 && /^[0-9]{6}-/.test(parts[0])) return parts[0];
    return parts[2] || "";
  }

  function safeJoinCodes(codes) {
    return (Array.isArray(codes) ? codes : []).filter(Boolean).join(",");
  }

  function clearRenderedCards() {
    const cards = listEl.querySelectorAll(".purchased-card:not(.is-template)");
    cards.forEach(c => c.remove());
  }

  function applyFilter(selectedCode) {
    const cards = listEl.querySelectorAll(".purchased-card:not(.is-template)");
    const code = (selectedCode || "ALL").trim();

    cards.forEach(card => {
      if (code === "ALL") {
        card.style.display = "";
        return;
      }
      const codes = (card.dataset.eventCodes || "").split(",").filter(Boolean);
      card.style.display = codes.includes(code) ? "" : "none";
    });

    updateEventHeader(code);
  }

  async function postJson(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    return await r.json();
  }

  function waitForEventMap(maxTries, intervalMs) {
    return new Promise(resolve => {
      (function tick(triesLeft) {
        const m = window.__SHOUT_EVENT_MAP__ || {};
        if (Object.keys(m).length > 0 || triesLeft <= 0) {
          resolve(m);
          return;
        }
        setTimeout(() => tick(triesLeft - 1), intervalMs);
      })(maxTries);
    });
  }

  async function downloadFile(fileName, cardEl, index) {
    if (!fileName) return;

    const eventCode = (cardEl && cardEl.dataset && cardEl.dataset.eventCodePrimary) ? String(cardEl.dataset.eventCodePrimary) : "";
    const eventMap = window.__SHOUT_EVENT_MAP__ || {};
    const displayName = String(eventMap[eventCode] || eventCode || "");
    const bib = (cardEl && cardEl.dataset && cardEl.dataset.bib) ? String(cardEl.dataset.bib) : "";
    const safeIndex = String(index || "").padStart(3, "0") || "001";

    let __shLoadingTimer = null;
    try {
      if (cardEl && cardEl.classList) cardEl.classList.add("is-downloading");

      __shLoadingTimer = setTimeout(() => {
        try { if (cardEl && cardEl.classList) cardEl.classList.remove("is-downloading"); } catch (e) {}
      }, 15000);

      const signed = await postJson(WF_SIGNED_URL, { fileName: fileName, users_id: usersId, index: safeIndex, event_display_name: displayName, bib: bib, event_code: eventCode, access_token: accessToken });
      const signedUrl = signed?.response?.signed_url || signed?.response?.url || signed?.signed_url || signed?.url;

      if (!signedUrl) {
        console.warn("[MyPage] signed url missing", signed);
        return;
      }

      window.location.href = signedUrl;

    } catch(err) {
      console.error("Download Error", err);
      alert("다운로드 중 오류가 발생했습니다.");
    } finally {
      if (__shLoadingTimer) clearTimeout(__shLoadingTimer);
      try { if (cardEl && cardEl.classList) cardEl.classList.remove("is-downloading"); } catch (e) {}
    }
  }

  window.downloadFile = downloadFile;

  let __currentBib = "";

  function renderPurchaseList(purchases) {
    clearRenderedCards();

    function normalizeUrlList(value) {
      if (Array.isArray(value)) return value;
      if (typeof value === "string" && value.trim()) return [value.trim()];
      return [];
    }

    (purchases || []).forEach(purchase => {
      const previewUrls = normalizeUrlList(purchase.preview_urls || purchase.preview_url);
      const standardUrls = normalizeUrlList(purchase.standard_urls || purchase.standard_url);
      const names = Array.isArray(purchase.purchased_files) ? purchase.purchased_files : [];
      const rawCodes = Array.isArray(purchase.event_codes) ? purchase.event_codes : [];

      const totalCount = Math.max(previewUrls.length, standardUrls.length, names.length);

      for (let i = 0; i < totalCount; i += 1) {
        const previewUrl = previewUrls[i] || "";
        const standardUrl = standardUrls[i] || "";
        const displayUrl = standardUrl || previewUrl;
        const fileName = names[i];

        if (!fileName) return;
        if (!displayUrl) return;

        let effectiveCodes = rawCodes.slice();
        if (!effectiveCodes.length) {
          const parsed = extractEventCodeFromPath(fileName) || extractEventCodeFromPath(displayUrl);
          if (parsed) effectiveCodes = [parsed];
        }

        const card = template.cloneNode(true);
        card.classList.remove("is-template");
        card.style.display = "";

        card.dataset.eventCodes = safeJoinCodes(effectiveCodes);
        card.dataset.eventCodePrimary = String((effectiveCodes && effectiveCodes[0]) || "");
        card.dataset.index = String(i + 1).padStart(3, "0");
        if (!__currentBib) {
          const b = String(purchase.searched_bib || "").trim();
          if (b) __currentBib = b;
        }
        card.dataset.bib = String(purchase.searched_bib || "");
        card.dataset.fileName = fileName;

        const imgBox = card.querySelector(".purchased-image") || card.querySelector(".purchased-img-wrapper");
        if (imgBox) {
          imgBox.style.backgroundImage = `url("${displayUrl}")`;
          imgBox.style.backgroundSize = "cover";
          imgBox.style.backgroundPosition = "center";
          imgBox.style.backgroundRepeat = "no-repeat";
        } else {
          const img = card.querySelector("img");
          if (img) img.src = displayUrl;
        }

        listEl.appendChild(card);
      }
    });

    const selected = selectEl ? (selectEl.value || "ALL") : "ALL";
    applyFilter(selected);
  }

  let __filterBound = false;

  function fillEventSelectOptionsFromCards() {
    if (!selectEl) return;

    const first = selectEl.querySelector("option");
    selectEl.innerHTML = "";
    if (first) {
      selectEl.appendChild(first);
    } else {
      const optAll = document.createElement("option");
      optAll.value = "ALL";
      optAll.textContent = "전체";
      selectEl.appendChild(optAll);
    }

    const cards = listEl.querySelectorAll(".purchased-card:not(.is-template)");
    const set = new Set();
    cards.forEach(c => {
      (c.dataset.eventCodes || "").split(",").filter(Boolean).forEach(code => set.add(code));
    });

    const eventMap = window.__SHOUT_EVENT_MAP__ || {};
    Array.from(set).sort().forEach(code => {
      const opt = document.createElement("option");
      const key = String(code || "").trim();
      opt.value = key;
      opt.textContent = eventMap[key] || key;
      selectEl.appendChild(opt);
    });

    if (!__filterBound) {
      __filterBound = true;
      selectEl.addEventListener("change", function () {
        applyFilter(selectEl.value || "ALL");
        updateEventHeader(selectEl.value || "ALL");
        updateZipBtnVisibility();
      });
    }
  }

  listEl.addEventListener("click", function (e) {
    const target = e.target;
    const card = target.closest(".purchased-card:not(.is-template)");
    if (!card) return;

    const fileName = card.dataset.fileName;
    if (fileName) {
      e.preventDefault();
      e.stopPropagation();
      downloadFile(fileName, card, card.dataset.index);
    }
  });

  const zipBtnDefaultText = zipBtn ? (zipBtn.textContent || "").trim() : "";

  let zipLabelEl = null;
  let zipSpinnerEl = null;

  function ensureZipBtnParts() {
    if (!zipBtn) return;

    const existingLabel = zipBtn.querySelector(".mp-zip-label");
    const existingSpinner = zipBtn.querySelector(".mp-zip-spinner");
    if (existingLabel && existingSpinner) {
      zipLabelEl = existingLabel;
      zipSpinnerEl = existingSpinner;
      return;
    }

    const label = document.createElement("span");
    label.className = "mp-zip-label";

    while (zipBtn.firstChild) {
      label.appendChild(zipBtn.firstChild);
    }

    if (!label.textContent || !label.textContent.trim()) {
      label.textContent = zipBtnDefaultText || "전체 다운로드";
    }

    const spinner = document.createElement("span");
    spinner.className = "mp-zip-spinner";
    spinner.setAttribute("aria-hidden", "true");

    try {
      spinner.style.display = "none";
      spinner.style.width = "14px";
      spinner.style.height = "14px";
      spinner.style.marginLeft = "0px";
      spinner.style.borderRadius = "999px";
      spinner.style.border = "2px solid rgba(0,0,0,0.18)";
      spinner.style.borderTopColor = "rgba(0,0,0,0.55)";
      spinner.style.boxSizing = "border-box";
      spinner.style.opacity = "0";
    } catch (e) {}


    zipBtn.appendChild(label);
    zipBtn.appendChild(spinner);

    zipLabelEl = label;
    zipSpinnerEl = spinner;
  }


function setZipBtnState(state) {
    if (!zipBtn) return;
    ensureZipBtnParts();

    const selectedCode = (selectEl && selectEl.value) ? String(selectEl.value).trim() : "ALL";
    const eventOnly = (selectedCode !== "ALL");

    if (state === "loading") {
      zipBtn.disabled = true;
      zipBtn.setAttribute("aria-busy", "true");
      zipBtn.classList.add("is-loading");
      try { if (zipSpinnerEl) { zipSpinnerEl.style.display = "inline-block"; zipSpinnerEl.style.opacity = "1"; } } catch (e) {}

      if (zipLabelEl) zipLabelEl.textContent = "ZIP 생성중...";
      return;
    }

    zipBtn.setAttribute("aria-busy", "false");
    zipBtn.classList.remove("is-loading");

    try { if (zipSpinnerEl) { zipSpinnerEl.style.opacity = "0"; zipSpinnerEl.style.display = "none"; } } catch (e) {}

    if (!eventOnly) {
      zipBtn.disabled = true;
      if (zipLabelEl) zipLabelEl.textContent = zipBtnDefaultText || "전체 다운로드";
      return;
    }

    zipBtn.disabled = false;
    if (zipLabelEl) zipLabelEl.textContent = zipBtnDefaultText || "전체 다운로드";
  }



  function updateZipBtnVisibility() {
    if (!zipBtn) return;
    syncZipEnabledClass();
    const enabled = document.documentElement.classList.contains("mp-zip-enabled");
    if (enabled) {
      setZipBtnState("ready");
    } else {
      setZipBtnState("ready");
    }
  }

function collectVisibleFileNamesForSelectedEvent() {
    const cards = Array.from(document.querySelectorAll("#sh-purchase-list .purchased-card:not(.is-template)"));
    const selectedEvent = (selectEl && selectEl.value) ? String(selectEl.value) : "ALL";
    const wantAll = (selectedEvent === "ALL");

    const fileNames = cards
      .filter(card => {
        if (card.style && String(card.style.display).toLowerCase() === "none") return false;
        if (!wantAll) {
          const eventCodes = (card.dataset && card.dataset.eventCodes) ? String(card.dataset.eventCodes) : "";
          if (!eventCodes.split(",").includes(selectedEvent)) return false;
        }
        const fileName = (card.dataset && card.dataset.fileName) ? String(card.dataset.fileName).trim() : "";
        return !!fileName;
      })
      .map(card => String(card.dataset.fileName).trim());

    return Array.from(new Set(fileNames));
  }

  async function requestZipSignedUrl(fileNames, bib, displayName) {
    const res = await postJson(WF_SIGNED_ZIP_URL, {
      fileNames: fileNames,
      bib: String(bib || ""),
      displayName: String(displayName || "")
    });

    const url =
      (res && res.response && (res.response.url || res.response.zip_url || res.response.signed_zip_url)) ||
      (res && (res.url || res.zip_url || res.signed_zip_url));

    if (!url) throw new Error("ZIP signed url missing");
    return url;
  }

  function resolveDisplayNameForEventCode(eventCode) {
    const m = window.__SHOUT_EVENT_MAP__ || {};
    const code = String(eventCode || "").trim();
    return String(m[code] || code || "");
  }

  function pickBibFromVisibleCards() {
    const cards = Array.from(document.querySelectorAll("#sh-purchase-list .purchased-card:not(.is-template)"))
      .filter(card => {
        if (card.style && String(card.style.display).toLowerCase() === "none") return false;
        const b = (card.dataset && card.dataset.bib) ? String(card.dataset.bib).trim() : "";
        return !!b;
      });
    return cards.length ? String(cards[0].dataset.bib).trim() : "";
  }

  function parseDateFromFileName(fileName) {
    const s = String(fileName || "");
    const m = s.match(/(?:^|\/)(\d{6})-/);
    if (!m) return "";
    const y = Number(m[1].slice(0, 2));
    const mm = m[1].slice(2, 4);
    const dd = m[1].slice(4, 6);
    if (!y || !mm || !dd) return "";
    const yyyy = 2000 + y;
    return `${yyyy}.${mm}.${dd}`;
  }

  function pickFirstVisibleFileName() {
    const cards = Array.from(document.querySelectorAll("#sh-purchase-list .purchased-card:not(.is-template)"))
      .filter(card => {
        if (card.style && String(card.style.display).toLowerCase() === "none") return false;
        const f = (card.dataset && card.dataset.fileName) ? String(card.dataset.fileName).trim() : "";
        return !!f;
      });
    return cards.length ? String(cards[0].dataset.fileName).trim() : "";
  }

  function updateEventHeader(selectedCode) {
    const code = String(selectedCode || "ALL").trim();

    if (code === "ALL") {
      if (__eventHeaderEls.titleEl) __eventHeaderEls.titleEl.textContent = "전체";
      if (__eventHeaderEls.bibEl) __eventHeaderEls.bibEl.textContent = "";
      if (__eventHeaderEls.dateEl) __eventHeaderEls.dateEl.textContent = "";
      return;
    }

    if (__eventHeaderEls.titleEl) {
      __eventHeaderEls.titleEl.textContent = resolveDisplayNameForEventCode(code);
    }

    const bib = (__currentBib || pickBibFromVisibleCards() || "").trim();
    if (__eventHeaderEls.bibEl) {
      __eventHeaderEls.bibEl.textContent = bib ? `참가번호 ${bib}번` : "";
    }

    const fileName = pickFirstVisibleFileName();
    const dateStr = parseDateFromFileName(fileName);
    if (__eventHeaderEls.dateEl) {
      __eventHeaderEls.dateEl.textContent = dateStr || "";
    }
  }

  function startUrlDownload(url) {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (zipBtn) {
    setZipBtnState("ready");
    if (selectEl) {
      selectEl.addEventListener("change", function () {
        setZipBtnState("ready");
        syncZipEnabledClass();
        updateEventHeader(selectEl ? (selectEl.value || "ALL") : "ALL");
      });
    }

    zipBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const selectedCode = (selectEl && selectEl.value) ? String(selectEl.value).trim() : "ALL";
      if (selectedCode === "ALL") return;

      const fileNames = collectVisibleFileNamesForSelectedEvent();
      if (!fileNames.length) {
        alert("다운로드할 이미지가 없습니다.");
        return;
      }

      try {
        setZipBtnState("loading");
        const displayName = resolveDisplayNameForEventCode(selectedCode);
        const bib = pickBibFromVisibleCards();
        if (!bib) { alert("참가번호(bib)를 찾지 못했습니다."); setZipBtnState("ready"); return; }
        const url = await requestZipSignedUrl(fileNames, bib, displayName);
        startUrlDownload(url);
      } catch (err) {
        console.error("[MyPage][ZIP] failed:", err);
        alert("ZIP 생성 실패. 다시 시도해주세요.");
      } finally {
        setZipBtnState("ready");
      }
    });
  }

  (async () => {
    if(pageLoader) pageLoader.style.display = "flex";

    try {
      const j = await postJson(WF_GET_PURCHASES, { users_id: usersId, access_token: accessToken });
      const list = j?.response?.purchase_list || [];
      renderPurchaseList(list);

      try {
        if (typeof window.shLoadEventMap === "function") {
          await window.shLoadEventMap();
        }
      } catch (e) {
        console.warn("[MyPage] shLoadEventMap failed", e);
      }

      await waitForEventMap(20, 120);
      fillEventSelectOptionsFromCards();
      updateEventHeader(selectEl ? (selectEl.value || "ALL") : "ALL");

    } catch (err) {
      console.error("[MyPage] init failed", err);
    } finally {
      document.documentElement.classList.add("mypage-ready");
      syncZipEnabledClass();

      if(pageLoader) pageLoader.style.display = "none";
      updateZipBtnVisibility();
    }
  })();
});
})();
