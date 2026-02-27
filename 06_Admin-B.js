<script>
/**
 * Shout-out Admin · Events (Safe Layout Version)
 * - 다른 페이지에 영향을 주지 않는 독립 스타일 적용
 * - 조회, 검색, 생성, 수정(상태/공개), 삭제 기능 유지
 *
 * [변경 메모]
 * - 기존에 initUI() 안에서 <style>을 동적으로 주입하던 코드를 제거함.
 * - 해당 스타일은 HEAD로 이동하여 중복 제거/통합 처리함.
 */

(function(){

  const $ = (s, root=document) => root.querySelector(s);
  const escapeHtml = (s) => String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const nowISO = () => new Date(new Date().getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);

  const BUBBLE_API_BASE = "https://plp-62309.bubbleapps.io/version-test"; 
  const API_CREATE_EVENT = "/api/1.1/wf/auto-create-event";
  const API_DATA_EVENT = "/api/1.1/obj/event";
  const API_AUTH_LOGIN = "/api/1.1/wf/auth-kakao-login"; // ✅ 관리자 가드용(서버 재검증)

  let allEvents = [];

  function initUI(){
    // [주의] 기존의 동적 style 주입은 HEAD로 이동했음 (중복/충돌 방지)

    const mount = document.createElement("div");
    mount.className = "sh-admin-wrap";
    mount.innerHTML = `
      <h1 class="sh-admin-title">Admin · Events</h1>
      
      <div class="sh-card">
        <div class="sh-row">
          <div class="sh-col"><label class="sh-label">대회 날짜</label><input class="sh-input" type="date" id="sh_event_date"></div>
          <div class="sh-col"><label class="sh-label">디스플레이 네임</label><input class="sh-input" type="text" id="sh_display_name"></div>
          <div class="sh-col"><label class="sh-label">event_code</label><input class="sh-input" type="text" id="sh_event_code"></div>
        </div>
        <div class="sh-divider"></div>
        <div class="sh-row">
          <div class="sh-col"><label class="sh-label">노출 시작</label><input class="sh-input" type="datetime-local" id="sh_publish_at"></div>
          <div class="sh-col">
            <label class="sh-label">노출 여부</label>
            <select class="sh-select" id="sh_is_public"><option value="true">공개</option><option value="false">비공개</option></select>
          </div>
          <div class="sh-col">
            <label class="sh-label">상태</label>
            <select class="sh-select" id="sh_status"><option value="ready">ready</option><option value="disabled">disabled</option></select>
          </div>
        </div>
        <button class="sh-btn primary" id="sh_btn_create_event">신규 대회 생성</button>
      </div>

      <div style="margin-bottom:15px; display:flex; gap:10px; align-items:center;">
        <input class="sh-input" style="flex:1" type="text" id="sh_search" placeholder="이름 또는 코드로 검색...">
        <button class="sh-btn-sm" id="sh_btn_refresh" style="padding: 8px;">새로고침</button>
        <span class="sh-chip" id="sh_count">0건</span>
      </div>

      <table class="sh-table">
        <thead>
          <tr>
            <th>날짜</th>
            <th>디스플레이 / 코드</th>
            <th>상태</th>
            <th>공개여부</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody id="sh_tbody"></tbody>
      </table>
    `;
    
    // 기존 컨텐츠 뒤에 자연스럽게 배치 (prepend 대신 상황에 맞춰 appendChild도 가능)
    document.body.prepend(mount);
    $("#sh_publish_at").value = nowISO();

    bindEvents();
    fetchData();
  }

  // 데이터 로드
  async function fetchData() {
    $("#sh_tbody").innerHTML = "<tr><td colspan='5' style='text-align:center;'>로드 중...</td></tr>";
    try {
      const res = await fetch(BUBBLE_API_BASE + API_DATA_EVENT);
      const data = await res.json();
      allEvents = data.response.results || [];
      render(allEvents);
    } catch(e) { $("#sh_tbody").innerHTML = "<tr><td colspan='5' style='color:red;'>로드 실패</td></tr>"; }
  }

  // 목록 렌더링
  function render(list) {
    $("#sh_count").textContent = list.length + "건";
    $("#sh_tbody").innerHTML = list.map(ev => `
      <tr>
        <td>${escapeHtml((ev.event_date || "").slice(0,10))}</td>
        <td>
          <strong>${escapeHtml(ev.event_display_name || ev.display_name)}</strong><br>
          <small style="color:#999">${escapeHtml(ev.event_code)}</small>
        </td>
        <td>
          <button class="sh-btn-sm" onclick="toggleStatus('${ev._id}', '${ev.state || ev.status}')">
            ${escapeHtml(ev.state || ev.status)}
          </button>
        </td>
        <td>
          <button class="sh-btn-sm ${ev.is_public ? 'pub' : 'priv'}" onclick="togglePublic('${ev._id}', ${ev.is_public})">
            ${ev.is_public ? "공개" : "비공개"}
          </button>
        </td>
        <td>
          <button class="sh-btn-sm danger" onclick="deleteEvent('${ev._id}')">삭제</button>
        </td>
      </tr>
    `).join("");
  }

  // --- [액션 기능들] ---
  window.deleteEvent = async function(id) {
    if(!confirm("정말 이 대회를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, { method: "DELETE" });
      if(res.ok) fetchData(); else alert("권한이 없습니다.");
    } catch(e) { alert("삭제 오류"); }
  };

  window.togglePublic = async function(id, current) {
    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !current })
      });
      if(res.ok) fetchData();
    } catch(e) { alert("수정 실패"); }
  };

  window.toggleStatus = async function(id, current) {
    const nextStatus = current === 'ready' ? 'disabled' : 'ready';
    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: nextStatus, status: nextStatus })
      });
      if(res.ok) fetchData();
    } catch(e) { alert("수정 실패"); }
  };

  function bindEvents(){
    $("#sh_search").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = allEvents.filter(ev => 
        (ev.event_display_name || "").toLowerCase().includes(q) || (ev.event_code || "").toLowerCase().includes(q)
      );
      render(filtered);
    });
    $("#sh_btn_refresh").addEventListener("click", fetchData);

    $("#sh_btn_create_event").addEventListener("click", async function(){
      this.disabled = true;
      try {
        const payload = {
          event_display_name: $("#sh_display_name").value.trim(),
          event_code: $("#sh_event_code").value.trim(),
          event_date: new Date($("#sh_event_date").value + "T00:00:00").toISOString(),
          publish_at: new Date($("#sh_publish_at").value).toISOString(),
          is_public: $("#sh_is_public").value === "true",
          state: $("#sh_status").value
        };
        const res = await fetch(BUBBLE_API_BASE + API_CREATE_EVENT, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if(res.ok) { alert("생성 성공"); fetchData(); }
      } catch(err){ alert("오류 발생"); }
      this.disabled = false;
    });
  }

  // ✅ Admin Guard: 서버(Bubble)에서 is_admin 재검증 후에만 initUI 실행
  async function guardAdmin(){
    const accessToken = sessionStorage.getItem("shout_access_token");

    // 토큰 없으면 로그인으로
    if (!accessToken) {
      alert("로그인이 필요합니다.");
      location.href = "/login";
      return false;
    }

    try {
      const res = await fetch(BUBBLE_API_BASE + API_AUTH_LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken })
      });

      const data = await res.json().catch(() => ({}));
      const payload = data && (data.response || data);

      // is_admin 판정 (boolean / string 모두 방어)
      const isAdmin =
        payload &&
        (payload.is_admin === true || payload.is_admin === "true");

      // users_id 있으면 동기화(선택)
      const usersId = payload && (payload.users_id || payload.usersId || payload.user_id);
      if (usersId) localStorage.setItem("shout_users_id", usersId);

      if (!isAdmin) {
        // 흔적 정리
        localStorage.removeItem("shout_is_admin");
        sessionStorage.removeItem("shout_access_token");

        alert("관리자 권한이 없습니다.");
        location.href = "/";
        return false;
      }

      // UI용 플래그(선택)
      localStorage.setItem("shout_is_admin", "true");
      return true;

    } catch (err) {
      console.error("[Admin] guardAdmin error:", err);
      alert("관리자 인증 중 오류가 발생했습니다.");
      location.href = "/";
      return false;
    }
  }

  async function bootAdmin(){
    const ok = await guardAdmin();
    if (ok) initUI();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootAdmin);
  else bootAdmin();

})();
</script>
