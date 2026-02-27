<script>
document.addEventListener("DOMContentLoaded", function () {
const AUTH_INTENT_KEY = "shout_auth_intent";
const AUTH_LOGIN_URL = "/login";
const UNIT_PRICE = 5000;
const PACKAGE_THRESHOLD = 5;
const PACKAGE_PRICE = 24900;
const PACKAGE_LABEL_TEXT = "무제한 패키지";
function calcAmountByCount(count) {
const c = Number(count) || 0;
if (c >= PACKAGE_THRESHOLD) return PACKAGE_PRICE;
return c * UNIT_PRICE;
}
function formatKRW(n) {
return Number(n).toLocaleString("ko-KR") + "원";
}
function getGroupKey(it){
const eventId = String(it && (it.event_id || it.event_code || it.eventId) || "").trim();
const bib = String(it && it.bib || "").trim();
return `${eventId}__${bib}`;
}
function groupItemsByEventBib(items){
const map = new Map();
for(const it of (items || [])){
const k = getGroupKey(it);
if(!map.has(k)) map.set(k, []);
map.get(k).push(it);
}
return map;
}
function calcGroupAmountByCount(count){
const c = Number(count) || 0;
if(c >= PACKAGE_THRESHOLD) return PACKAGE_PRICE;
return c * UNIT_PRICE;
}
function calcTotalAmountByGroups(items){
const groups = groupItemsByEventBib(items);
let total = 0;
for(const arr of groups.values()){
total += calcGroupAmountByCount(arr.length);
}
return total;
}
function buildBibMeta(items){
const groups = groupItemsByEventBib(items);
const out = [];
for(const [k, arr] of groups.entries()){
const [eventId, bib] = k.split("__");
out.push({ event_id: eventId, bib: bib, count: arr.length });
}
return out;
}
function updateFooterMeta(groups) {
const selectedIds = getSelectedIds();
const count = selectedIds.length;
if (selectedCountText) selectedCountText.textContent = `${count}장`;
const selectedSet = new Set(selectedIds);
const hasPackage = Array.isArray(groups)
? groups.some(g => {
const arr = Array.isArray(g.items) ? g.items : [];
const c = arr.reduce((n, it) => n + (selectedSet.has(getItemId(it)) ? 1 : 0), 0);
return c >= PACKAGE_THRESHOLD;
})
: (count >= PACKAGE_THRESHOLD);
if (packageLabelText) {
packageLabelText.textContent = hasPackage ? PACKAGE_LABEL_TEXT : "";
}
}
const TOSS_CLIENT_KEY = "test_ck_0RnYX2w532qQQl9gBdJl8NeyqApQ";
const SUCCESS_URL = window.location.origin + "/payments-results/success";
const FAIL_URL = window.location.origin + "/payments-results/fail";
const THUMB_SCROLL_STEP = 280;
const BUBBLE_API_ORIGIN = "https://plp-62309.bubbleapps.io/version-test/api/1.1/wf";
const WF_SYNC_CART = "/api/1.1/wf/sync_cart_from_local";
const WF_CREATE_ORDER = "/api/1.1/wf/create_order";
const CART_SYNC_DEBOUNCE_MS = 350;
const currentImgEl = document.getElementById("cart-current-img");
const thumbRowEl = document.getElementById("cart-thumb-row");
let prevBtn = document.getElementById("cart-prev-btn");
let nextBtn = document.getElementById("cart-next-btn");
let container = document.getElementById("cart-list-container");
let priceText = document.getElementById("cart-total-price");
let checkoutBtn = document.getElementById("btn-checkout");
let checkoutLocked = true;
let agreeCheckbox = document.getElementById("checkout-agree");
function nudgeAgreeCheckbox() {
if (!agreeCheckbox) return;
try {
agreeCheckbox.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
} catch (e) {
try { agreeCheckbox.scrollIntoView(true); } catch (e2) {}
}
try { agreeCheckbox.focus({ preventScroll: true }); } catch (e) { try { agreeCheckbox.focus(); } catch (e2) {} }
try {
agreeCheckbox.classList.add("is-attn");
} catch (e) {}
}
async function startPayment(){
try{
if (agreeCheckbox && !agreeCheckbox.checked) { alert("약관에 동의해 주세요."); return; }
const userId = localStorage.getItem("shout_users_id");
if(!userId){ try{ sessionStorage.setItem(AUTH_INTENT_KEY, JSON.stringify({ after: "start_payment" })); sessionStorage.setItem("shout_cart_sync_needed", "true"); }catch(e){} window.location.href = AUTH_LOGIN_URL; return; }
const allItems = (window.ShoutCart && typeof window.ShoutCart.getItems === 'function') ? window.ShoutCart.getItems() : cartItems;
ensureSelectedIds({ save: true });
const items = getSelectedItemsFrom(allItems);
if(!items || items.length === 0){ alert("장바구니가 비어있습니다."); return; }
const seen = new Set(); const photoIds = [];
for(const it of items){ const id = String(it && it._id || "").trim(); if(!id) continue; if(seen.has(id)) continue; seen.add(id); photoIds.push(id); }
const bibMeta = buildBibMeta(items); const amount = calcTotalAmountByGroups(items); const orderName = `사진 ${photoIds.length}장`; let orderId = `shout_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;
try{
const url = BUBBLE_API_ORIGIN.replace(/\/$/, "") + WF_CREATE_ORDER; const body = new URLSearchParams();
body.set("users_id", userId); body.set("amount", String(amount)); body.set("photo_ids_json", JSON.stringify(photoIds)); body.set("bib_meta_json", JSON.stringify(bibMeta)); body.set("success_url", SUCCESS_URL); body.set("fail_url", FAIL_URL);
const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: body.toString() });
const j = await res.json().catch(() => null); const bubble = j && (j.response || j); if(bubble && (bubble.order_id || bubble.orderId)){ orderId = bubble.order_id || bubble.orderId; }
}catch(e){}
if(typeof TossPayments !== "function"){ alert("결제 모듈을 불러오지 못했습니다. (TossPayments)"); return; }
const tossPayments = TossPayments(TOSS_CLIENT_KEY);
await tossPayments.requestPayment("카드", { amount: amount, orderId: orderId, orderName: orderName, successUrl: SUCCESS_URL, failUrl: FAIL_URL });
}catch(err){ console.error("[startPayment] error:", err); alert("결제 진행 중 오류가 발생했습니다."); }
}
function callStartPayment(e) {
if (agreeCheckbox && !agreeCheckbox.checked) {
if (e && typeof e.preventDefault === "function") e.preventDefault();
if (e && typeof e.stopPropagation === "function") e.stopPropagation();
nudgeAgreeCheckbox();
return;
}
return startPayment(e);
}
let packageLabelText = document.getElementById("cart-package-label");
let selectedCountText = document.getElementById("cart-selected-count");
let eventListEl = document.getElementById("cart-event-list");
const __secPreviewIdxByGroupKey = new Map();
let eventTemplateEl = document.getElementById("cart-event-template");
let thumbLeftBtn = null;
let thumbRightBtn = null;
let cartData = { items: [] };
let cartItems = [];
function getItemId(it) {
const id = (it && (it._id || it.photo_id || it.photoId || it.id)) || "";
return String(id).trim();
}
function uniqueStrings(arr) {
const out = [];
const seen = new Set();
(Array.isArray(arr) ? arr : []).forEach((v) => {
const s = String(v || "").trim();
if (!s || seen.has(s)) return;
seen.add(s);
out.push(s);
});
return out;
}
function getAllCartIds() {
const ids = [];
(Array.isArray(cartItems) ? cartItems : []).forEach((it) => {
const id = getItemId(it);
if (id) ids.push(id);
});
return uniqueStrings(ids);
}
function ensureSelectedIds({ save } = { save: false }) {
const allIds = getAllCartIds();
const before = Array.isArray(cartData && cartData.selected_ids) ? cartData.selected_ids.slice() : null;
if (!cartData || typeof cartData !== "object") cartData = { items: Array.isArray(cartItems) ? cartItems : [] };
if (!Array.isArray(cartData.selected_ids)) cartData.selected_ids = allIds.slice();
const allSet = new Set(allIds);
cartData.selected_ids = uniqueStrings(cartData.selected_ids).filter((id) => allSet.has(id));
if (cartData.selected_ids.length === 0 && allIds.length > 0) cartData.selected_ids = allIds.slice();
const after = cartData.selected_ids.slice();
const changed = JSON.stringify(before || []) !== JSON.stringify(after);
if (save && changed) {
try { localStorage.setItem("shout_cart_data", JSON.stringify(cartData)); } catch (e) {}
}
return { changed, allIds, selectedIds: after };
}
function getSelectedIds() {
if (!cartData || !Array.isArray(cartData.selected_ids)) return getAllCartIds();
return uniqueStrings(cartData.selected_ids);
}
function getSelectedItemsFrom(items) {
const selectedSet = new Set(getSelectedIds());
const out = [];
(Array.isArray(items) ? items : []).forEach((it) => {
const id = getItemId(it);
if (!id) return;
if (selectedSet.has(id)) out.push(it);
});
return out;
}
function removeFromSelectedIds(photoId, { save } = { save: true }) {
const pid = String(photoId || "").trim();
if (!pid) return;
if (!cartData || !Array.isArray(cartData.selected_ids)) return;
const beforeLen = cartData.selected_ids.length;
cartData.selected_ids = cartData.selected_ids.filter((x) => String(x || "").trim() !== pid);
if (save && cartData.selected_ids.length !== beforeLen) {
try { localStorage.setItem("shout_cart_data", JSON.stringify(cartData)); } catch (e) {}
}
}
let __shout_cart_render_seq = 0;
let __shout_cart_sync_timer = null;
function loadCartFromStorage() {
if (window.ShoutCart && typeof window.ShoutCart.getItems === "function") {
try {
cartItems = window.ShoutCart.getItems() || [];
cartData = { items: cartItems };
ensureSelectedIds({ save: false });
return;
} catch (e) {}
}
const savedData = localStorage.getItem("shout_cart_data");
if (!savedData) {
cartItems = [];
return;
}
try {
const parsed = JSON.parse(savedData);
if (parsed && Array.isArray(parsed.items)) {
cartData = parsed;
cartItems = parsed.items;
ensureSelectedIds({ save: true });
}
} catch (e) {
cartItems = [];
}
}
function getUsersId() {
return localStorage.getItem("shout_users_id") || "";
}
function getCartPhotoIds() {
return cartItems.map(it => (it && it._id ? String(it._id) : "")).filter(Boolean);
}
async function syncCartNow(reason) {
const usersId = getUsersId();
if (!usersId) return;
const photoIds = getCartPhotoIds();
const body = new URLSearchParams();
body.set("users_id", usersId);
body.set("photo_ids", JSON.stringify(photoIds));
const url = BUBBLE_API_ORIGIN.replace(/\/$/, "") + WF_SYNC_CART;
try {
await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: body.toString() });
} catch (err) {}
}
function scheduleCartSync(reason) {
if (__shout_cart_sync_timer) clearTimeout(__shout_cart_sync_timer);
__shout_cart_sync_timer = setTimeout(() => { syncCartNow(reason); }, CART_SYNC_DEBOUNCE_MS);
}
function ensureCartUi() {
if (!container) {
container = document.createElement("div");
container.id = "cart-list-container";
container.classList.add("sh-cart-list-container");
document.body.appendChild(container);
}
if (!priceText || !checkoutBtn) {
const bar = document.createElement("div");
bar.id = "sh-cart-footer-bar";
bar.classList.add("sh-cart-footer-bar");
const inner = document.createElement("div");
inner.className = "sh-cart-footer-inner";
const priceWrap = document.createElement("div");
priceWrap.className = "sh-cart-footer-price";
const priceLabel = document.createElement("div");
priceLabel.textContent = "총 결제금액";
priceLabel.className = "sh-cart-footer-price-label";
priceText = document.createElement("div");
priceText.id = "cart-total-price";
priceText.className = "sh-cart-footer-price-value";
priceText.textContent = "0";
priceWrap.appendChild(priceLabel);
priceWrap.appendChild(priceText);
inner.appendChild(priceWrap);
const rightCol = document.createElement("div");
rightCol.className = "sh-cart-footer-right";
const agreeWrap = document.createElement("label");
agreeWrap.className = "sh-cart-agree-wrap";
if (!agreeCheckbox) {
agreeCheckbox = document.createElement("input");
agreeCheckbox.type = "checkbox";
agreeCheckbox.id = "checkout-agree";
}
const agreeText = document.createElement("span");
agreeText.textContent = "구매 조건 및 환불 규정에 동의합니다.";
agreeText.className = "sh-cart-agree-text";
agreeWrap.appendChild(agreeCheckbox);
agreeWrap.appendChild(agreeText);
checkoutBtn = document.createElement("button");
checkoutBtn.id = "btn-checkout";
checkoutBtn.disabled = false;
checkoutBtn.className = "sh-cart-checkout-btn";
checkoutBtn.textContent = "결제하기";
rightCol.appendChild(agreeWrap);
rightCol.appendChild(checkoutBtn);
inner.appendChild(rightCol);
bar.appendChild(inner);
document.body.appendChild(bar);
}
if (thumbRowEl) {
thumbRowEl.classList.add("sh-thumb-strip");
const thumbsWrap = thumbRowEl.closest(".cart-preview-thumbs-wrap") || thumbRowEl.parentElement;
if (thumbsWrap) {
if (!thumbLeftBtn) {
thumbLeftBtn = document.createElement("button");
thumbLeftBtn.type = "button";
thumbLeftBtn.className = "sh-thumb-nav-btn is-left";
thumbLeftBtn.textContent = "‹";
thumbsWrap.appendChild(thumbLeftBtn);
}
if (!thumbRightBtn) {
thumbRightBtn = document.createElement("button");
thumbRightBtn.type = "button";
thumbRightBtn.className = "sh-thumb-nav-btn is-right";
thumbRightBtn.textContent = "›";
thumbsWrap.appendChild(thumbRightBtn);
}
const updateThumbNav = () => {
const max = thumbRowEl.scrollWidth - thumbRowEl.clientWidth;
const hasOverflow = max > 2;
thumbsWrap.classList.toggle("is-overflow", hasOverflow);
if (!hasOverflow) { thumbLeftBtn.disabled = true; thumbRightBtn.disabled = true; return; }
const x = thumbRowEl.scrollLeft;
thumbLeftBtn.disabled = x <= 1;
thumbRightBtn.disabled = x >= (max - 1);
};
thumbLeftBtn.onclick = () => { thumbRowEl.scrollBy({ left: -Math.round(thumbRowEl.clientWidth * 0.8), behavior: "smooth" }); };
thumbRightBtn.onclick = () => { thumbRowEl.scrollBy({ left: Math.round(thumbRowEl.clientWidth * 0.8), behavior: "smooth" }); };
thumbRowEl.addEventListener("scroll", updateThumbNav, { passive: true });
window.addEventListener("resize", updateThumbNav);
setTimeout(updateThumbNav, 0);
}
}
if (currentImgEl) {
const host = currentImgEl.parentElement;
if (host) {
host.classList.add("sh-cart-preview-host");
if (!prevBtn) { prevBtn = document.createElement("button"); prevBtn.id = "cart-prev-btn"; prevBtn.className = "sh-cart-nav-btn is-prev"; prevBtn.type = "button"; prevBtn.innerHTML = "‹"; host.appendChild(prevBtn); }
if (!nextBtn) { nextBtn = document.createElement("button"); nextBtn.id = "cart-next-btn"; nextBtn.className = "sh-cart-nav-btn is-next"; nextBtn.type = "button"; nextBtn.innerHTML = "›"; host.appendChild(nextBtn); }
}
}
}
let currentIndex = 0;
function setCurrentPreview(src){
if (!src) { __shout_setActivePreviewBg(""); return; }
__shout_setActivePreviewBg(src);
}
function setIndex(nextIdx){
if (cartItems.length === 0) return;
currentIndex = (nextIdx + cartItems.length) % cartItems.length;
}
let __pvDeleteBtn = null;
let __pvSelectBtn = null;
function getCurrentPreviewItem() {
if (!Array.isArray(cartItems) || cartItems.length === 0) return null;
if (currentIndex < 0 || currentIndex >= cartItems.length) return cartItems[0] || null;
return cartItems[currentIndex] || null;
}
function getCurrentPreviewPhotoId() {
const it = getCurrentPreviewItem();
return it && it._id ? String(it._id) : "";
}
function isPhotoSelected(photoId) {
const pid = String(photoId || "").trim();
if (!pid) return false;
try {
const set = new Set(getSelectedIds());
return set.has(pid);
} catch (e) {
return false;
}
}
function toggleSelectedId(photoId) {
const pid = String(photoId || "").trim();
if (!pid) return;
if (!cartData) cartData = { items: Array.isArray(cartItems) ? cartItems : [] };
if (!Array.isArray(cartData.selected_ids)) ensureSelectedIds({ save: false });
const list = Array.isArray(cartData.selected_ids) ? cartData.selected_ids.map(x => String(x || "").trim()).filter(Boolean) : [];
const has = list.includes(pid);
const next = has ? list.filter(x => x !== pid) : list.concat([pid]);
cartData.selected_ids = uniqueStrings(next);
try { localStorage.setItem("shout_cart_data", JSON.stringify(cartData)); } catch (e) {}
}
function mountPreviewBadges() {
if (!currentImgEl) return;
if (__pvDeleteBtn && __pvSelectBtn) return;
try { currentImgEl.classList.add("sh-cart-preview-host"); } catch (e) {}
__pvDeleteBtn = document.createElement("button");
__pvDeleteBtn.type = "button";
__pvDeleteBtn.className = "sh-pv-badge is-delete";
__pvDeleteBtn.setAttribute("aria-label", "사진 삭제");
__pvDeleteBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M10 7V5h4v2m-6 3v9m4-9v9m4-9v9M8 7l1 14h6l1-14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
__pvSelectBtn = document.createElement("button");
__pvSelectBtn.type = "button";
__pvSelectBtn.className = "sh-pv-badge is-select";
__pvSelectBtn.setAttribute("aria-label", "결제 대상 선택/해제");
__pvSelectBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
__pvDeleteBtn.addEventListener("click", (e) => {
e.preventDefault(); e.stopPropagation();
if (!Array.isArray(cartItems) || cartItems.length === 0) return;
removeItem(currentIndex);
});
__pvSelectBtn.addEventListener("click", (e) => {
e.preventDefault(); e.stopPropagation();
const pid = getCurrentPreviewPhotoId();
if (!pid) return;
toggleSelectedId(pid);
try { rerenderCartUI(); } catch (e2) { try { updatePreviewBadgesUI(); } catch (e3) {} }
});
currentImgEl.appendChild(__pvDeleteBtn);
currentImgEl.appendChild(__pvSelectBtn);
updatePreviewBadgesUI();
}
function updatePreviewBadgesUI() {
if (!__pvSelectBtn) return;
const pid = getCurrentPreviewPhotoId();
const selected = pid ? isPhotoSelected(pid) : true;
__pvSelectBtn.classList.toggle("is-selected", !!selected);
__pvSelectBtn.classList.toggle("is-unselected", !selected);
}
function scrollSelectedThumbIntoView(){
if (!thumbRowEl) return;
const el = thumbRowEl.querySelector(`[data-thumb-idx="${currentIndex}"]`);
if (!el) return;
try { el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); } catch (e) { el.scrollIntoView(true); }
}
function updateThumbOverflowUI(){
if (!thumbRowEl) return;
const hasOverflow = thumbRowEl.scrollWidth > (thumbRowEl.clientWidth + 2);
thumbRowEl.classList.toggle("is-overflow", hasOverflow);
if (thumbLeftBtn) { const atLeft = thumbRowEl.scrollLeft <= 2; thumbLeftBtn.classList.toggle("is-disabled", !hasOverflow || atLeft); }
if (thumbRightBtn) { const maxLeft = thumbRowEl.scrollWidth - thumbRowEl.clientWidth; const atRight = thumbRowEl.scrollLeft >= (maxLeft - 2); thumbRightBtn.classList.toggle("is-disabled", !hasOverflow || atRight); }
}
function renderCartPreviewUI() {
if (!currentImgEl || !thumbRowEl) return;
if (cartItems.length === 0) {
const keepLeft = thumbLeftBtn; const keepRight = thumbRightBtn;
thumbRowEl.innerHTML = "";
if (keepLeft) thumbRowEl.appendChild(keepLeft);
if (keepRight) thumbRowEl.appendChild(keepRight);
setCurrentPreview(""); try { updatePreviewBadgesUI(); } catch (e) {}
updateThumbOverflowUI();
return;
}
if (currentIndex >= cartItems.length) currentIndex = 0;
const currentItem = cartItems[currentIndex];
if (currentItem && currentItem.preview_url) {
const safeSrc = currentItem.preview_url.startsWith("http") ? currentItem.preview_url : "https:" + currentItem.preview_url;
setCurrentPreview(safeSrc); try { updatePreviewBadgesUI(); } catch (e) {}
}
const keepLeft = thumbLeftBtn; const keepRight = thumbRightBtn;
thumbRowEl.innerHTML = "";
cartItems.forEach((item, idx) => {
const thumbBox = document.createElement("div");
const isSelected = (idx === currentIndex);
thumbBox.setAttribute("data-thumb-idx", String(idx));
thumbBox.className = "sh-cart-thumb" + (isSelected ? " is-active" : "");
const img = document.createElement("div");
img.className = "sh-cart-thumb-img";
const bgUrl = item.preview_url.startsWith("http") ? item.preview_url : "https:" + item.preview_url;
img.style.backgroundImage = `url(${bgUrl})`;
thumbBox.appendChild(img);
thumbBox.addEventListener("click", () => { currentIndex = idx; renderCartPreviewUI(); try { mountPreviewBadges(); } catch (e) {} try { updatePreviewBadgesUI(); } catch (e2) {} });
thumbRowEl.appendChild(thumbBox);
});
if (keepLeft) thumbRowEl.appendChild(keepLeft);
if (keepRight) thumbRowEl.appendChild(keepRight);
try { mountPreviewBadges(); } catch (e) {}
try { updatePreviewBadgesUI(); } catch (e2) {}
setTimeout(() => { scrollSelectedThumbIntoView(); updateThumbOverflowUI(); }, 0);
}
function pad2(n) { return String(n).padStart(2, "0"); }
function getEventCodeFromItem(item) {
if (item && item.event_code) return String(item.event_code);
const fn = item && item.fileName ? String(item.fileName) : "";
const parts = fn.split("/").filter(Boolean);
if (parts.length >= 3) return parts[2];
return "UNKNOWN";
}
function getBibFromItem(item){
if(item && (item.bib !== undefined && item.bib !== null)) return String(item.bib);
if(item && (item.bib_number !== undefined && item.bib_number !== null)) return String(item.bib_number);
return "UNKNOWN";
}
function getEventDisplayNameFromItem(item, eventCode) {
if (item && item.event_display_name) return String(item.event_display_name);
if (cartData && cartData.event_meta && cartData.event_meta.event_display_name) return String(cartData.event_meta.event_display_name);
return eventCode || "UNKNOWN";
}
function calcEventAmountByCount(count) { return (count >= PACKAGE_THRESHOLD) ? PACKAGE_PRICE : (count * UNIT_PRICE); }
function buildEventGroups(items) {
const map = new Map();
(items || []).forEach((it) => {
const eventCode = getEventCodeFromItem(it);
const eventId = String((it && (it.event_id || it.eventId || it.event_code)) || eventCode || "UNKNOWN");
const bib = String(getBibFromItem(it) || "UNKNOWN");
const name = getEventDisplayNameFromItem(it, eventCode);
const key = `${eventId}__${bib}`;
if (!map.has(key)) map.set(key, { key, event_code: eventCode, event_id: eventId, bib, event_display_name: name, items: [] });
map.get(key).items.push(it);
});
return Array.from(map.values());
}
const BUBBLE_DATA_ORIGIN = (BUBBLE_API_ORIGIN || "").replace("/api/1.1/wf", "/api/1.1/obj");
async function hydrateGroupDisplayNames(groups) {
if (!Array.isArray(groups) || groups.length === 0) return;
if (!BUBBLE_DATA_ORIGIN || !BUBBLE_DATA_ORIGIN.includes("/api/1.1/obj")) return;
const need = []; const seen = new Set();
groups.forEach((g) => {
const missing = !g.event_display_name || String(g.event_display_name).trim() === "" || g.event_display_name === "UNKNOWN";
const eventId = g.event_id || g.event_code;
if (!missing) return; if (!eventId) return; if (seen.has(eventId)) return;
seen.add(eventId); need.push({ g, eventId });
});
if (need.length === 0) return;
const fetchOne = async (eventId) => {
const constraints = encodeURIComponent(JSON.stringify([{ key: "event_code", constraint_type: "equals", value: String(eventId) }]));
const url = `${BUBBLE_DATA_ORIGIN}/event?constraints=${constraints}`;
const r = await fetch(url, { method: "GET" });
if (!r.ok) return null;
const j = await r.json().catch(() => null);
const res = j && j.response && Array.isArray(j.response.results) ? j.response.results : [];
return res[0] || null;
};
const results = await Promise.allSettled(need.map((x) => fetchOne(x.eventId)));
results.forEach((r, idx) => {
if (!r || r.status !== "fulfilled") return;
const data = r.value; if (!data) return;
const name = data.event_display_name || data.display_name || data.name; if (!name) return;
const target = need[idx].g; target.event_display_name = String(name);
try {
const raw = localStorage.getItem("shout_cart_data");
const parsed = raw ? JSON.parse(raw) : null;
if (parsed && Array.isArray(parsed.items)) {
parsed.items.forEach((it) => {
const itEventId = it.event_id || it.eventId || it.event_code;
if (String(itEventId || "") === String(need[idx].eventId)) it.event_display_name = String(name);
});
if (parsed.event_meta) parsed.event_meta.event_display_name = parsed.event_meta.event_display_name || String(name);
localStorage.setItem("shout_cart_data", JSON.stringify(parsed));
}
} catch (e) {}
});
}
function hideLegacySingleEventUI() {
const hideUp = (el) => { if (!el) return; el.style.display = "none"; const wrap = el.closest && el.closest(".preview-wrapper, .nav-wrapper, .cart-wrapper, .list-wrapper"); if (wrap) wrap.style.display = "none"; };
hideUp(currentImgEl); hideUp(thumbRowEl);
if (prevBtn) prevBtn.style.display = "none";
if (nextBtn) nextBtn.style.display = "none";
hideUp(container);
}
function buildSectionPreviewDOM() {
const wrap = document.createElement("div"); wrap.className = "cart-preview";
const current = document.createElement("div"); current.className = "cart-preview-current";
let prev = document.createElement("button"); prev.type = "button"; prev.className = "cart-preview-btn cart-preview-prev"; prev.textContent = "이전";
let next = document.createElement("button"); next.type = "button"; next.className = "cart-preview-btn cart-preview-next"; next.textContent = "다음";
wrap.classList.add("sh-cart-preview-host");
const csWrap = window.getComputedStyle(wrap);
if (csWrap.position === "static") wrap.style.position = "relative";
const prevOverlay = document.createElement("button"); prevOverlay.type = "button"; prevOverlay.className = "sh-cart-nav-btn is-prev"; prevOverlay.innerHTML = "‹";
const nextOverlay = document.createElement("button"); nextOverlay.type = "button"; nextOverlay.className = "sh-cart-nav-btn is-next"; nextOverlay.innerHTML = "›";
prevOverlay.style.opacity = "1"; prevOverlay.style.pointerEvents = "auto"; nextOverlay.style.opacity = "1"; nextOverlay.style.pointerEvents = "auto";
wrap.appendChild(prevOverlay); wrap.appendChild(nextOverlay);
prev = prevOverlay; next = nextOverlay;
const thumbsWrap = document.createElement("div"); thumbsWrap.className = "cart-preview-thumbs-wrap";
const thumbs = document.createElement("div"); thumbs.className = "cart-preview-thumbs";
thumbsWrap.appendChild(thumbs); wrap.appendChild(current); wrap.appendChild(thumbsWrap);
return { wrap, current, thumbs, prev, next };
}
function normalizeUrl(url){if(!url)return"";const s=String(url);if(s.startsWith("http"))return s;if(s.startsWith("//"))return"https:"+s;return s;}
function bindSectionPreview(mountEl, items) {
if (!mountEl) return; const list = Array.isArray(items) ? items : [];
const ui = buildSectionPreviewDOM(); mountEl.innerHTML = ""; mountEl.appendChild(ui.wrap);
const __gk = (list && list[0]) ? getGroupKey(list[0]) : "";
let idx = 0;
if (__gk && list.length) {
const saved = __secPreviewIdxByGroupKey.get(__gk);
if (Number.isFinite(saved)) idx = Math.max(0, Math.min(list.length - 1, saved));
}
let __secDel = null;
let __secSel = null;
function getSecPid() {
const it = list[idx];
return it && it._id ? String(it._id) : "";
}
function mountSectionBadges() {
if (__secDel && __secSel) return;
try { ui.wrap.classList.add("sh-cart-preview-host"); } catch (e) {}
__secDel = document.createElement("button");
__secDel.type = "button";
__secDel.className = "sh-pv-badge is-delete";
__secDel.setAttribute("aria-label", "사진 삭제");
__secDel.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
__secSel = document.createElement("button");
__secSel.type = "button";
__secSel.className = "sh-pv-badge is-select";
__secSel.setAttribute("aria-label", "결제 대상 선택/해제");
__secSel.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
__secDel.addEventListener("click", (e) => {
e.preventDefault(); e.stopPropagation();
const pid = getSecPid();
if (!pid) return;
removeItemByPhotoId(pid);
});
__secSel.addEventListener("click", (e) => {
e.preventDefault(); e.stopPropagation();
const pid = getSecPid();
if (!pid) return;
toggleSelectedId(pid);
try { renderMultiEventAccordion(); } catch (e2) {}
try { updateSectionBadgesUI(); } catch (e3) {}
});
ui.wrap.appendChild(__secDel);
ui.wrap.appendChild(__secSel);
updateSectionBadgesUI();
}
function updateSectionBadgesUI() {
if (!__secSel) return;
const pid = getSecPid();
const selected = pid ? isPhotoSelected(pid) : true;
__secSel.classList.toggle("is-selected", !!selected);
__secSel.classList.toggle("is-unselected", !selected);
}
function renderThumbs() {
ui.thumbs.innerHTML = "";
list.forEach((it, i) => {
const t = document.createElement("div"); t.className = "cart-thumb" + (i === idx ? " is-active" : "");
const u = normalizeUrl(it && it.preview_url); if (u) t.style.backgroundImage = `url("${u}")`;
const pid = it && it._id ? String(it._id) : "";
t.addEventListener("click", () => { idx = i; renderCurrent();
if (__gk) __secPreviewIdxByGroupKey.set(__gk, idx);
try { mountSectionBadges(); } catch (e) {}
try { updateSectionBadgesUI(); } catch (e2) {}
}); ui.thumbs.appendChild(t);
});
}
function renderCurrent() {
const it = list[idx]; const u = normalizeUrl(it && it.preview_url);
ui.current.style.backgroundImage = u ? `url("${u}")` : "none";
Array.from(ui.thumbs.children).forEach((node, i) => { node.classList.toggle("is-active", i === idx); });
if (__gk) __secPreviewIdxByGroupKey.set(__gk, idx);
try { updateSectionBadgesUI(); } catch (e) {}
ui.prev.disabled = (idx <= 0); ui.next.disabled = (idx >= list.length - 1);
}
function setupPerEventThumbNav() {
const thumbRowEl = ui.thumbs; if (!thumbRowEl) return;
const thumbsWrap = ui.wrap && ui.wrap.querySelector(".cart-preview-thumbs-wrap"); if (!thumbsWrap) return;
let leftBtn = thumbsWrap.querySelector(".sh-thumb-nav-btn.is-left"); let rightBtn = thumbsWrap.querySelector(".sh-thumb-nav-btn.is-right");
const cs = window.getComputedStyle(thumbsWrap); if (cs.position === "static") thumbsWrap.style.position = "relative";
if (!leftBtn) { leftBtn = document.createElement("button"); leftBtn.type = "button"; leftBtn.className = "sh-thumb-nav-btn is-left"; leftBtn.textContent = "‹"; thumbsWrap.appendChild(leftBtn); }
if (!rightBtn) { rightBtn = document.createElement("button"); rightBtn.type = "button"; rightBtn.className = "sh-thumb-nav-btn is-right"; rightBtn.textContent = "›"; thumbsWrap.appendChild(rightBtn); }
const update = () => {
const max = thumbRowEl.scrollWidth - thumbRowEl.clientWidth; const hasOverflow = max > 2;
thumbsWrap.classList.toggle("is-overflow", hasOverflow);
if (!hasOverflow) { leftBtn.disabled = true; rightBtn.disabled = true; return; }
const x = thumbRowEl.scrollLeft; leftBtn.disabled = x <= 1; rightBtn.disabled = x >= (max - 1);
};
const step = () => Math.max(140, Math.floor(thumbRowEl.clientWidth * 0.7));
leftBtn.onclick = () => { thumbRowEl.scrollBy({ left: -step(), behavior: "smooth" }); setTimeout(update, 180); };
rightBtn.onclick = () => { thumbRowEl.scrollBy({ left: step(), behavior: "smooth" }); setTimeout(update, 180); };
if (!thumbRowEl.dataset.thumbNavBound) { thumbRowEl.dataset.thumbNavBound = "1"; thumbRowEl.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update); }
requestAnimationFrame(() => requestAnimationFrame(update)); setTimeout(update, 120);
}
ui.prev.addEventListener("click", () => { if (idx <= 0) return; idx -= 1; renderCurrent(); if (__gk) __secPreviewIdxByGroupKey.set(__gk, idx); });
ui.next.addEventListener("click", () => { if (idx >= list.length - 1) return; idx += 1; renderCurrent(); if (__gk) __secPreviewIdxByGroupKey.set(__gk, idx); });
renderThumbs(); renderCurrent(); mountSectionBadges(); setupPerEventThumbNav();
}
async function renderMultiEventAccordion() {
const __mySeq = ++__shout_cart_render_seq;
eventListEl = document.getElementById("cart-event-list"); eventTemplateEl = document.getElementById("cart-event-template");
if (!eventListEl || !eventTemplateEl) return false;
eventTemplateEl.style.display = "none"; hideLegacySingleEventUI();
Array.from(eventListEl.children).forEach((ch) => { if (ch === eventTemplateEl) return; ch.remove(); });
const groups = buildEventGroups(cartItems); await hydrateGroupDisplayNames(groups);
if (__mySeq !== __shout_cart_render_seq) return false;
Array.from(eventListEl.children).forEach((ch) => { if (ch === eventTemplateEl) return; ch.remove(); });
if (groups.length === 0) { if (priceText) priceText.innerText = formatKRW(0); updateFooterMeta(groups); return true; }
const __selectedIds = getSelectedIds();
const __selectedSet = new Set(__selectedIds);
let grandTotal = 0;
groups.forEach((g, i) => {
const section = eventTemplateEl.cloneNode(true); section.classList.remove("cart-event-template");
const idx2 = pad2(i + 1); section.id = `cart-event-section-${idx2}`; section.style.display = ""; section.classList.add("cart-event-section"); section.setAttribute("data-event-code", String(g.event_code || ""));
const header = section.querySelector(".cart-event-header"); const body = section.querySelector(".cart-event-body");
if (header) header.id = `cart-event-header-${idx2}`; if (body) body.id = `cart-event-body-${idx2}`;
const idxEl = section.querySelector(".cart-event-index"); const titleEl = section.querySelector(".cart-event-title"); const subtotalEl = section.querySelector(".cart-event-subtotal");
if (idxEl) { idxEl.id = `cart-event-index-${idx2}`; idxEl.textContent = `${idx2} / Marathon`; }
if (titleEl) { titleEl.id = `cart-event-title-${idx2}`; titleEl.textContent = g.event_display_name || "UNKNOWN"; }
const __allItems = Array.isArray(g.items) ? g.items : [];
const count = __allItems.reduce((n, it) => n + (__selectedSet.has(getItemId(it)) ? 1 : 0), 0);
const countEl = section.querySelector("#cart-event-count"); if (countEl) countEl.textContent = `${count}장`;
const pckEl = section.querySelector("#cart-event-pck-price"); if (pckEl) pckEl.style.display = (count >= PACKAGE_THRESHOLD) ? "block" : "none";
const subtotal = calcEventAmountByCount(count); grandTotal += subtotal;
if (subtotalEl) { subtotalEl.id = `cart-event-subtotal-${idx2}`; subtotalEl.textContent = "₩ " + Number(subtotal).toLocaleString("ko-KR"); }
if (body) body.style.display = "none";
const mount = section.querySelector(".cart-event-preview-mount"); if (mount) { mount.id = `cart-event-preview-mount-${idx2}`; bindSectionPreview(mount, g.items); }
function setOpen(open) { if (!body) return; section.classList.toggle("is-open", !!open); body.style.display = open ? "block" : "none"; }
if (groups.length === 1) setOpen(true);
if (header) header.style.pointerEvents = "auto";
section.addEventListener("click", (ev) => { const h = ev.target && ev.target.closest ? ev.target.closest(".cart-event-header") : null; if (!h) return; const isOpen = section.classList.contains("is-open"); setOpen(!isOpen); }, true);
eventListEl.appendChild(section);
});
if (priceText) priceText.innerText = formatKRW(grandTotal); updateFooterMeta(groups); return true;
}
function renderCartList() {
if (!container) return;
if (cartItems.length === 0) {
container.innerHTML = "<div style='padding:40px; text-align:center; color:#888;'>장바구니가 비어있습니다.</div>";
if (priceText) priceText.innerText = formatKRW(0); updateFooterMeta(null); return;
}
container.innerHTML = "";
cartItems.forEach((item, index) => {
const itemDiv = document.createElement("div");
itemDiv.className = "sh-cart-event-row";
const safeSrc = item.preview_url.startsWith("http") ? item.preview_url : "https:" + item.preview_url;
itemDiv.innerHTML = `<div style="display:flex; alignItems:center; gap:15px;"><img src="${safeSrc}" style="width:80px; height:80px; object-fit:cover; border-radius:4px; background:#f0f0f0;"><div><div style="font-weight:bold; font-size:14px;">${item.fileName || "사진"}</div><div style="font-size:12px; color:#666;">5,000원</div></div></div><button class="remove-btn" data-index="${index}" style="background:none; border:1px solid #ddd; padding:5px 10px; border-radius:4px; font-size:12px; cursor:pointer; color:#555;">삭제</button>`;
container.appendChild(itemDiv);
});
document.querySelectorAll(".remove-btn").forEach(btn => { btn.addEventListener("click", function() { removeItem(this.getAttribute("data-index")); }); });
const localGroups = buildEventGroups(cartItems);
const __selectedIds2 = getSelectedIds();
const __selectedSet2 = new Set(__selectedIds2);
const total = localGroups.length > 0
? localGroups.reduce((sum, g) => {
const arr = Array.isArray(g.items) ? g.items : [];
const c = arr.reduce((n, it) => n + (__selectedSet2.has(getItemId(it)) ? 1 : 0), 0);
return sum + calcEventAmountByCount(c);
}, 0)
: calcAmountByCount(__selectedIds2.length);
if (priceText) priceText.innerText = formatKRW(total); updateFooterMeta(localGroups); if (checkoutBtn) checkoutBtn.innerText = "결제하기";
}
function rerenderCartUI() {
Promise.resolve(renderMultiEventAccordion()).then((didMulti) => { if (didMulti) return; renderCartList(); renderCartPreviewUI(); try { bindPreviewNav(); } catch (e) {} try { bindThumbUx(); } catch (e) {} setTimeout(() => { try { updateThumbOverflowUI(); } catch (e) {} }, 0); });
}
function removeItemByPhotoId(photoId) {
const pid = String(photoId || ""); if (!pid) return; const idx = cartItems.findIndex((it) => it && String(it._id || "") === pid); if (idx < 0) return; removeItem(idx);
}
function removeItem(index) {
const removed = cartItems[index]; const removedId = removed && removed._id ? String(removed._id) : "";
if (removedId && window.ShoutCart && typeof window.ShoutCart.remove === "function") {
try { window.ShoutCart.remove(removedId); cartItems = (window.ShoutCart.getItems && window.ShoutCart.getItems()) || []; cartData = { items: cartItems }; ensureSelectedIds({ save: false }); } catch (e) {}
} else {
cartItems.splice(index, 1); cartData.items = cartItems; removeFromSelectedIds(removedId, { save: false }); ensureSelectedIds({ save: false }); localStorage.setItem("shout_cart_data", JSON.stringify(cartData));
}
if (currentIndex >= cartItems.length) currentIndex = Math.max(0, cartItems.length - 1);
rerenderCartUI(); scheduleCartSync("remove_item");
}
function bindPreviewNav(){
if (__SHOUT_CART_PREVIEW_NAV_BOUND) return; __SHOUT_CART_PREVIEW_NAV_BOUND = true; if (!prevBtn || !nextBtn) return;
prevBtn.addEventListener("click", () => { setIndex(currentIndex - 1); renderCartPreviewUI(); });
nextBtn.addEventListener("click", () => { setIndex(currentIndex + 1); renderCartPreviewUI(); });
window.addEventListener("keydown", (e) => {
const tag = (document.activeElement && encourageTag(document.activeElement.tagName) || "").toLowerCase();
if (tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable) return;
if (e.key === "ArrowLeft") { setIndex(currentIndex - 1); renderCartPreviewUI(); } else if (e.key === "ArrowRight") { setIndex(currentIndex + 1); renderCartPreviewUI(); }
});
}
let __SHOUT_CART_PREVIEW_SWIPE_BOUND = false;
function __shout_getActivePreviewHost() {
const list = Array.from(document.querySelectorAll(".cart-preview-current")); if (list.length === 0) return null; const vis = list.find(el => el.offsetParent !== null) || list[0]; return vis;
}
function __shout_setActivePreviewBg(url) {
const host = __shout_getActivePreviewHost(); if (!host) return; if (!url) { host.style.backgroundImage = ""; return; } host.style.backgroundImage = `url("${url}")`;
}
function bindPreviewSwipeIOS() {
if (__SHOUT_CART_PREVIEW_SWIPE_BOUND) return; __SHOUT_CART_PREVIEW_SWIPE_BOUND = true;
let host = __shout_getActivePreviewHost(); if (!host) return;
let __HOST_BG_INLINE_BEFORE = { bgImage: "", bgColor: "" }; let __HOST_BG_COMPUTED_BEFORE = { bgImage: "", bgColor: "" }; let __HOST_BG_HIDDEN = false;
function hideHostBg() { if (__HOST_BG_HIDDEN) return; __HOST_BG_HIDDEN = true; host.style.backgroundImage = "none"; host.style.backgroundColor = __HOST_BG_COMPUTED_BEFORE.bgColor || "#000"; }
function restoreHostBg() {
if (!__HOST_BG_HIDDEN) return; __HOST_BG_HIDDEN = false; host.style.backgroundColor = ""; host.style.backgroundImage = "";
try { const item = cartItems[currentIndex]; setCurrentPreview(item && item.preview_url ? item.preview_url : ""); } catch (e) {}
}
const SWIPE_WRAP_ID = "sh-cart-swipe-wrap"; const SWIPE_TRACK_ID = "sh-cart-swipe-track"; const PANEL_PREV_ID = "sh-cart-swipe-prev"; const PANEL_CUR_ID  = "sh-cart-swipe-cur"; const PANEL_NEXT_ID = "sh-cart-swipe-next";
let wrap = document.getElementById(SWIPE_WRAP_ID); let track, pPrev, pCur, pNext;
function ensureSwipeDom() {
wrap = document.getElementById(SWIPE_WRAP_ID);
if (!wrap) { wrap = document.createElement("div"); wrap.id = SWIPE_WRAP_ID; wrap.className = "sh-cart-swipe-wrap"; host.appendChild(wrap); }
try { const cs = getComputedStyle(host); wrap.style.background = cs.backgroundColor || "transparent"; } catch(_) {}
track = document.getElementById(SWIPE_TRACK_ID);
if (!track) { track = document.createElement("div"); track.id = SWIPE_TRACK_ID; track.className = "sh-cart-swipe-track"; wrap.appendChild(track); }
pPrev = document.getElementById(PANEL_PREV_ID); if (!pPrev) { pPrev = document.createElement("div"); pPrev.id = PANEL_PREV_ID; }
pCur  = document.getElementById(PANEL_CUR_ID); if (!pCur)  { pCur  = document.createElement("div"); pCur.id  = PANEL_CUR_ID; }
pNext = document.getElementById(PANEL_NEXT_ID); if (!pNext) { pNext = document.createElement("div"); pNext.id = PANEL_NEXT_ID; }
[pPrev, pCur, pNext].forEach((el) => { el.classList.add("sh-cart-swipe-panel"); });
if (pPrev.parentElement !== track) track.appendChild(pPrev); if (pCur.parentElement  !== track) track.appendChild(pCur); if (pNext.parentElement !== track) track.appendChild(pNext);
}
function applySwipeSizes() {
if (!wrap || !track || !pPrev || !pCur || !pNext) return; const w = getViewportW(); if (!w) return;
track.style.width = (w * 3) + "px"; [pPrev, pCur, pNext].forEach((el) => { el.style.width = w + "px"; el.style.minWidth = w + "px"; el.style.flex = "0 0 " + w + "px"; }); snapToCenterIdle();
}
window.addEventListener("resize", applySwipeSizes); window.addEventListener("orientationchange", applySwipeSizes);
function toHttps(url){if(!url)return"";const s=String(url);if(s.startsWith("http"))return url;if(s.startsWith("//"))return"https:"+url;return"https://"+url;}
function preloadPanels(idx) {
if (!cartItems || cartItems.length === 0) return; const len = cartItems.length; const cur  = (idx + len) % len; const prev = (cur - 1 + len) % len; const next = (cur + 1) % len;
const curSrc  = toHttps(cartItems[cur]?.preview_url || ""); const prevSrc = toHttps(cartItems[prev]?.preview_url || ""); const nextSrc = toHttps(cartItems[next]?.preview_url || "");
pCur.style.backgroundImage  = curSrc  ? `url("${curSrc}")`  : "none"; pPrev.style.backgroundImage = prevSrc ? `url("${prevSrc}")` : "none"; pNext.style.backgroundImage = nextSrc ? `url("${nextSrc}")` : "none";
}
function getViewportW() { const cs = getComputedStyle(wrap); const pl = parseFloat(cs.paddingLeft) || 0; const pr = parseFloat(cs.paddingRight) || 0; return Math.max(0, (wrap.clientWidth || 0) - pl - pr); }
const ANIM_MS = 220; const THRESHOLD_RATIO = 0.18; const TAP_SLOP = 8; const MAX_Y = 90;
function setTrackPx(px, withAnim) { if (withAnim) track.style.transition = `transform ${ANIM_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`; else track.style.transition = "none"; track.style.transform = `translate3d(${px}px, 0, 0)`; }
function snapToCenterIdle() { const w = getViewportW(); setTrackPx(-w, false); }
function hideOverlay() { if (!wrap) return; wrap.style.display = "none"; restoreHostBg(); snapToCenterIdle(); }
let startX = 0; let startY = 0; let dx = 0; let dy = 0; let dragging = false; let animating = false; let axisLocked = null;
host.addEventListener("touchstart", (ev) => {
if (animating) return; if (!cartItems || cartItems.length === 0) return; const t = ev.touches && ev.touches[0]; if (!t) return;
ensureSwipeDom(); preloadPanels(currentIndex); host = __shout_getActivePreviewHost(); if (!host) { dragging = false; return; }
__HOST_BG_INLINE_BEFORE = { bgImage: host.style.backgroundImage || "", bgColor: host.style.backgroundColor || "" };
__HOST_BG_COMPUTED_BEFORE = (() => { try { const cs = getComputedStyle(host); return { bgImage: cs.backgroundImage || "", bgColor: cs.backgroundColor || "" }; } catch (e) { return { bgImage: "", bgColor: "" }; } })();
hideHostBg(); wrap.style.display = "block"; applySwipeSizes(); snapToCenterIdle();
startX = t.clientX; startY = t.clientY; dx = 0; dy = 0; axisLocked = null; dragging = true; const w = getViewportW(); setTrackPx(-w, false);
}, { passive: true });
host.addEventListener("touchmove", (ev) => {
if (!dragging) return; const t = ev.touches && ev.touches[0]; if (!t) return; dx = t.clientX - startX; dy = t.clientY - startY;
if (!axisLocked) axisLocked = (Math.abs(dx) > Math.abs(dy)) ? "x" : "y";
if (axisLocked === "y") { if (Math.abs(dy) > MAX_Y && Math.abs(dy) > Math.abs(dx)) { dragging = false; animating = true; hideOverlay(); setTimeout(() => { animating = false; }, ANIM_MS + 40); } return; }
ev.preventDefault(); const w = getViewportW(); setTrackPx(-w + dx, false);
}, { passive: false });
host.addEventListener("touchend", () => {
if (!dragging) return; dragging = false; if (!cartItems || cartItems.length === 0) { hideOverlay(); return; }
const w = getViewportW(); const threshold = w * THRESHOLD_RATIO;
if (Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP) { animating = true; setTrackPx(-w, true); setTimeout(() => { animating = false; hideOverlay(); }, ANIM_MS + 30); return; }
if (Math.abs(dx) < threshold) { animating = true; setTrackPx(-w, true); setTimeout(() => { animating = false; hideOverlay(); }, ANIM_MS + 40); return; }
if (dx < 0) { animating = true; setTrackPx(-w - w, true); setTimeout(() => { animating = false; setIndex(currentIndex + 1); renderCartPreviewUI(); hideOverlay(); }, ANIM_MS + 40); } else { animating = true; setTrackPx(-w + w, true); setTimeout(() => { animating = false; setIndex(currentIndex - 1); renderCartPreviewUI(); hideOverlay(); }, ANIM_MS + 40); }
}, { passive: true });
}
function encourageTag(t){ return t || ""; }
let __SHOUT_CART_THUMB_UX_BOUND = false;
function bindThumbUx(){
if (__SHOUT_CART_THUMB_UX_BOUND) return; __SHOUT_CART_THUMB_UX_BOUND = true; if (!thumbRowEl) return;
if (thumbLeftBtn) { thumbLeftBtn.addEventListener("click", () => { thumbRowEl.scrollBy({ left: -THUMB_SCROLL_STEP, behavior: "smooth" }); }); }
if (thumbRightBtn) { thumbRightBtn.addEventListener("click", () => { thumbRowEl.scrollBy({ left: THUMB_SCROLL_STEP, behavior: "smooth" }); }); }
thumbRowEl.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); thumbRowEl.scrollLeft += e.deltaY; } }, { passive: false });
let isDown = false; let startX = 0; let startScrollLeft = 0; let moved = false;
thumbRowEl.addEventListener("mousedown", (e) => { const target = e.target; if (target && target.closest && target.closest(".sh-thumb-nav-btn")) return; isDown = true; moved = false; thumbRowEl.classList.add("is-dragging"); startX = e.pageX; startScrollLeft = thumbRowEl.scrollLeft; });
window.addEventListener("mousemove", (e) => { if (!isDown) return; const dx = e.pageX - startX; if (Math.abs(dx) > 3) moved = true; thumbRowEl.scrollLeft = startScrollLeft - dx; });
window.addEventListener("mouseup", () => { if (!isDown) return; isDown = false; thumbRowEl.classList.remove("is-dragging"); });
thumbRowEl.addEventListener("click", (e) => { if (!moved) return; e.preventDefault(); e.stopPropagation(); moved = false; }, true);
thumbRowEl.addEventListener("scroll", () => { updateThumbOverflowUI(); }); window.addEventListener("resize", () => { updateThumbOverflowUI(); });
}
async function init() {
if (window.__shout_cart_init_ran) return; window.__shout_cart_init_ran = true; ensureCartUi(); loadCartFromStorage();
window.addEventListener("shout_cart_changed", function(e){ try{ loadCartFromStorage(); renderMultiEventAccordion(); renderCartPreviewUI(); renderCartList(); }catch(err){} });
const __didMulti = await renderMultiEventAccordion(); bindPreviewSwipeIOS();
if (!__didMulti) { renderCartPreviewUI(); renderCartList(); bindPreviewNav(); bindPreviewSwipeIOS(); bindThumbUx(); setTimeout(updateThumbOverflowUI, 0); }
if (checkoutBtn) checkoutBtn.onclick = callStartPayment;
document.querySelectorAll(".cart-preview-nav").forEach(el => el.remove());
const intent = sessionStorage.getItem(AUTH_INTENT_KEY);
if (intent) {
const data = JSON.parse(intent);
if (data.after === "start_payment" && localStorage.getItem("shout_users_id")) {
sessionStorage.removeItem(AUTH_INTENT_KEY); const needSync = sessionStorage.getItem("shout_cart_sync_needed") === "true";
if (needSync) { sessionStorage.removeItem("shout_cart_sync_needed"); syncCartNow("after_login_return"); }
setTimeout(startPayment, 300);
}
}
}
window.addEventListener("pageshow", init); init();
if (agreeCheckbox && checkoutBtn) {
agreeCheckbox.addEventListener("change", function () {
checkoutLocked = !this.checked;
if (this.checked) {
this.classList.remove("is-attn");}
});
}
});
</script>