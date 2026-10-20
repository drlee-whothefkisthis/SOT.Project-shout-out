// BEGIN SHOUT AUTH SHARED
(function () {
  "use strict";
  if (window.ShoutAuth) return;
  const KEY = "shout_auth";
  const MAX_AGE_MS = 2 * 60 * 60 * 1000;
  const LEGACY_LOCAL = ["shout_users_id", "shout_kakao_id", "shout_is_admin"];
  let redirecting = false;

  function clearCredentials() {
    localStorage.removeItem(KEY);
    LEGACY_LOCAL.forEach(key => localStorage.removeItem(key));
    sessionStorage.removeItem("shout_access_token");
  }

  function read() {
    let state;
    try { state = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
    const now = Date.now();
    if (!state || state.version !== 1 || !state.user_id || !state.access_token ||
        !Number.isFinite(state.issued_at) || !Number.isFinite(state.expires_at) ||
        state.issued_at > now || state.expires_at <= now ||
        state.expires_at - state.issued_at > MAX_AGE_MS) {
      sessionStorage.removeItem("shout_access_token");
      return null;
    }
    // Compatibility aliases are written from the complete canonical record only.
    localStorage.setItem("shout_users_id", state.user_id);
    localStorage.setItem("shout_kakao_id", state.kakao_id || "");
    localStorage.setItem("shout_is_admin", String(state.is_admin === true));
    sessionStorage.setItem("shout_access_token", state.access_token);
    return state;
  }

  function save(payload, auth) {
    const userId = String(payload && (payload.users_id || payload.usersID || payload.user_id) || "").trim();
    const token = String(payload && payload.access_token || "").trim();
    const submittedToken = String(auth && auth.access_token || "").trim();
    const issuedAt = Number(auth && auth.issued_at);
    const expiresIn = Number(auth && auth.expires_in);
    if (!userId || !token || token !== submittedToken || !Number.isFinite(issuedAt)) {
      throw new Error("Incomplete login response");
    }
    const lifetime = Number.isFinite(expiresIn) && expiresIn > 0 ? Math.min(expiresIn * 1000, MAX_AGE_MS) : MAX_AGE_MS;
    const state = {
      version: 1,
      user_id: userId,
      kakao_id: String(payload.kakao_id || ""),
      access_token: token,
      is_admin: payload.is_admin === true || payload.is_admin === "true",
      issued_at: issuedAt,
      expires_at: issuedAt + lifetime
    };
    if (state.expires_at <= Date.now()) throw new Error("Login token expired before completion");
    localStorage.setItem(KEY, JSON.stringify(state));
    read();
    return state;
  }

  function requireLogin(after, returnTo, fallbackTo) {
    if (redirecting) return;
    redirecting = true;
    let previous = null;
    try { previous = JSON.parse(sessionStorage.getItem("shout_auth_intent") || "null"); } catch (_) {}
    const intent = previous && previous.after === after ? previous : {};
    sessionStorage.setItem("shout_auth_intent", JSON.stringify(Object.assign({}, intent, {
      after,
      return_to: returnTo || window.location.href,
      fallback_to: fallbackTo || "/",
      created_at: Date.now()
    })));
    window.location.href = "/login";
  }

  function isAuthFailure(status, data) {
    const text = JSON.stringify(data || {});
    return status === 401 || /ACCESS_TOKEN_EXPIRED|AUTH_EXPIRED|AUTH_INVALID|this access token is already expired|"code"\s*:\s*-401/i.test(text);
  }

  function logout() {
    clearCredentials();
    sessionStorage.removeItem("shout_auth_intent");
    sessionStorage.removeItem("shout_checkout_context");
    sessionStorage.removeItem("shout_checkout_entry");
    localStorage.removeItem("shout_checkout_context");
    localStorage.removeItem("shout_cart_sync_needed");
    if (window.Kakao && window.Kakao.Auth && typeof window.Kakao.Auth.setAccessToken === "function") {
      try { window.Kakao.Auth.setAccessToken(null); } catch (_) {}
    }
    window.location.href = "/";
  }

  window.ShoutAuth = {
    key: KEY, maxAgeMs: MAX_AGE_MS, read, save, clearCredentials, requireLogin, isAuthFailure, logout,
    // Identity alone is permitted for payment. It does not grant purchase/admin access.
    getUserId() { return String(localStorage.getItem("shout_users_id") || "").trim(); },
    getAccessToken() { const state = read(); return state ? state.access_token : ""; },
    getAdminToken() {
      const state = read();
      if (!state) {
        requireLogin("admin", window.location.href, "/admin");
        throw new Error("ADMIN_AUTH_REQUIRED");
      }
      return state.access_token;
    }
  };
  window.addEventListener("storage", function (event) {
    if (event.key !== KEY) return;
    const path = window.location.pathname || "";
    if (path === "/mypage" || path === "/admin") window.location.reload();
  });
})();
// END SHOUT AUTH SHARED
(function () {
function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

onReady(function () {
  console.log("[Shout-out] /login loaded.");

  const AUTH_INTENT_KEY = "shout_auth_intent";
  const AUTH_INTENT_TTL_MS = 60 * 60 * 1000;
  const KAKAO_JS_KEY = "605dc0a603b0aa18966898cc91b9ca9b";
  const BUBBLE_URL = "https://plp-62309.bubbleapps.io/api/1.1/wf/auth-kakao-login";

  const loginBtn = document.getElementById("btn-kakao-login");

  function shNotify(message, type) {
    if (typeof window.shToast === "function") {
      window.shToast(message, { type: type || "info", duration: 2000 });
      return;
    }
    alert(message);
  }

  function setBtnLoading(isLoading) {
    if (!loginBtn) return;
    loginBtn.disabled = !!isLoading;
    loginBtn.style.opacity = isLoading ? "0.6" : "1";
    loginBtn.style.cursor = isLoading ? "not-allowed" : "pointer";
  }

  function getIntent() {
    const raw = sessionStorage.getItem(AUTH_INTENT_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function isIntentFresh(intent) {
    if (!intent || !intent.created_at) return true;
    const createdAt = Number(intent.created_at);
    if (!Number.isFinite(createdAt)) return false;
    return Date.now() - createdAt <= AUTH_INTENT_TTL_MS;
  }

  function safeSameOriginUrl(value, fallbackPath) {
    try {
      if (!value) return window.location.origin + fallbackPath;
      const url = new URL(String(value), window.location.origin);
      if (url.origin !== window.location.origin) return window.location.origin + fallbackPath;
      return url.pathname + url.search + url.hash;
    } catch (e) {
      return window.location.origin + fallbackPath;
    }
  }

  function isAdminIntent(intent) {
    return intent && (intent.after === "admin" || intent.type === "admin");
  }

  function shouldPreserveIntent(intent) {
    return intent && isIntentFresh(intent) && (
      intent.after === "start_payment" ||
      intent.after === "checkout_payment" ||
      isAdminIntent(intent)
    );
  }

  function resolveReturnTo(intent) {
    if (!intent || !isIntentFresh(intent)) {
      return safeSameOriginUrl(null, "/");
    }

    const fallback = safeSameOriginUrl(intent.fallback_to, isAdminIntent(intent) ? "/admin" : "/");
    return safeSameOriginUrl(intent.return_to || intent.returnTo, fallback.replace(window.location.origin, ""));
  }

  function goReturnTo() {
    const intent = getIntent();
    const target = resolveReturnTo(intent);
    if (!shouldPreserveIntent(intent)) {
      sessionStorage.removeItem(AUTH_INTENT_KEY);
    }
    console.log("[Shout-out] return_to =", target);
    window.location.href = target;
  }

  function ensureKakaoInit() {
    if (!window.Kakao) {
      shNotify("카카오 SDK 로드 실패. 새로고침 후 다시 시도해주세요.", "error");
      return false;
    }
    if (!Kakao.isInitialized()) {
      Kakao.init(KAKAO_JS_KEY);
    }
    return true;
  }


  function proceedBubbleLogin(auth) {
    const accessToken = auth.access_token;
    fetch(BUBBLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken })
    })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("[Bubble] status", res.status, data);
        setBtnLoading(false);
        shNotify("로그인 서버 처리 중 오류가 발생했습니다. (status " + res.status + ")", "error");
        return;
      }

      const payload = data && (data.response || data);

      const usersId =
        (payload && (payload.users_id || payload.usersID || payload.user_id)) || null;

      if (!usersId) {
        console.error("[Bubble] users_id 누락:", data);
        setBtnLoading(false);
        shNotify("로그인 처리 중 오류가 발생했습니다. (User ID Missing)", "error");
        return;
      }

      // Validate the whole response before replacing the previous account record.
      window.ShoutAuth.save(payload, auth);

      goReturnTo();
    })
    .catch(err => {
      console.error("[Bubble] 통신 에러:", err);
      setBtnLoading(false);
      shNotify("서버 통신 중 오류가 발생했습니다.", "error");
    });
  }

  function startKakaoLogin() {
    if (!ensureKakaoInit()) return;

    setBtnLoading(true);

    Kakao.Auth.login({
      success: function (authObj) {
        const accessToken = authObj && authObj.access_token;
        if (!accessToken) {
          setBtnLoading(false);
          shNotify("카카오 인증 토큰을 가져오지 못했습니다.", "error");
          return;
        }

        proceedBubbleLogin({
          access_token: accessToken,
          expires_in: authObj.expires_in,
          issued_at: Date.now()
        });
      },
      fail: function (err) {
        console.error("[Kakao] 로그인 실패/취소:", err);
        setBtnLoading(false);

        shNotify("로그인이 취소되었거나 실패했습니다.", "info");
      }
    });
  }

  if (!loginBtn) {
    console.warn("[Shout-out] btn-kakao-login 버튼이 없습니다. (ID 확인)");
    return;
  }

  loginBtn.addEventListener("click", function (e) {
    e.preventDefault();
    if (loginBtn.disabled) return;
    startKakaoLogin();
  });
});
})();
