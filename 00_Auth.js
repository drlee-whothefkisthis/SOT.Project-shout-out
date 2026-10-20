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
