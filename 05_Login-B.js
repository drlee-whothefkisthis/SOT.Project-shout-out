<script>
document.addEventListener("DOMContentLoaded", function () {
  console.log("[Shout-out] /login loaded.");

  // ===== Config =====
  const AUTH_INTENT_KEY = "shout_auth_intent";
  const KAKAO_JS_KEY = "605dc0a603b0aa18966898cc91b9ca9b";
  const AGE_NOTICE_KEY = "shout_login_block_reason"; // 갤러리 안내 플래그 (UNDER14, AGE_REQUIRED)
  const BUBBLE_URL = "https://plp-62309.bubbleapps.io/version-test/api/1.1/wf/auth-kakao-login";

  // ✅ 여기 중요: /login 페이지의 카카오 버튼 ID
  const loginBtn = document.getElementById("btn-kakao-login");

  // ===== UX helpers =====
  function shNotify(message, type) {
    // 전역 토스트가 있으면 토스트 우선, 없으면 alert로 fallback
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

  // ===== Intent helpers =====
  function getIntent() {
    const raw = sessionStorage.getItem(AUTH_INTENT_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function getReturnTo() {
    const intent = getIntent();
    if (intent && intent.return_to) return intent.return_to;
    return window.location.origin + "/"; // fallback
  }


  function getFallbackTo() {
    const intent = getIntent();
    if (intent && intent.fallback_to) return intent.fallback_to;
    return window.location.origin + "/gallery";
  }

  function goReturnTo() {
    const target = getReturnTo();
    console.log("[Shout-out] return_to =", target);
    window.location.href = target;
  }

  // ===== Kakao init =====
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

  // ===== Login flow =====
  // ===== Bubble login (existing logic, wrapped as a function) =====
  function proceedBubbleLogin(accessToken) {
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
    
              // ✅ 로그인 상태 저장
              localStorage.setItem("shout_users_id", usersId);
              if (payload.kakao_id) localStorage.setItem("shout_kakao_id", payload.kakao_id);
    
              // 🔐 access_token은 세션 단위로만 유지
              if (payload.access_token) {
               sessionStorage.setItem("shout_access_token", payload.access_token);
              }
    
              if (typeof payload.is_admin !== "undefined") {
               localStorage.setItem("shout_is_admin", String(payload.is_admin));
              }
    
    
              // ✅ intent는 지우지 않음 (cart 자동결제 after 처리 목적)
              // 성공 시에만 return_to로 이동
              goReturnTo();
            })
            .catch(err => {
              console.error("[Bubble] 통신 에러:", err);
              setBtnLoading(false);
              shNotify("서버 통신 중 오류가 발생했습니다.", "error");
              // 실패 시 리다이렉트 ❌ (로그인 페이지 stay)
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

        
        // ===== AGE GATE (front-only) =====
        Kakao.API.request({
          url: "/v2/user/me",
          success: function (res) {
            try {
              const acc = (res && res.kakao_account) ? res.kakao_account : {};
              const birthyear = acc.birthyear;
              const birthday = acc.birthday;

              // 연령정보 미제공/미동의: 구매를 진행하지 않고 갤러리로 이동 (필수 동의 전제)
              if (!birthyear || !birthday) {
                Kakao.Auth.logout();
                if (Kakao.Auth && typeof Kakao.Auth.setAccessToken === "function") {
                  Kakao.Auth.setAccessToken(null);
                }
                sessionStorage.removeItem(AUTH_INTENT_KEY);
                sessionStorage.setItem(AGE_NOTICE_KEY, "AGE_REQUIRED");
                setBtnLoading(false);
                window.location.replace(getFallbackTo());
                return;
              }

              const yyyy = parseInt(birthyear, 10);
              const mm = parseInt(String(birthday).slice(0, 2), 10);
              const dd = parseInt(String(birthday).slice(2, 4), 10);

              const today = new Date();
              let age = today.getFullYear() - yyyy;
              const m = today.getMonth() + 1;
              const d = today.getDate();
              if (m < mm || (m === mm && d < dd)) age--;

              if (age < 14) {
                Kakao.Auth.logout();
                if (Kakao.Auth && typeof Kakao.Auth.setAccessToken === "function") {
                  Kakao.Auth.setAccessToken(null);
                }
                sessionStorage.removeItem(AUTH_INTENT_KEY);
                sessionStorage.setItem(AGE_NOTICE_KEY, "UNDER14");
                setBtnLoading(false);
                window.location.replace(getFallbackTo());
                return;
              }

              // 14세 이상: 기존 Bubble 로그인 진행
              proceedBubbleLogin(accessToken);
            } catch (e) {
              console.error("[AGE] parse error", e);
              // 파싱 오류 시에는 보수적으로 결제 차단이 맞지만, 운영 편의상 기존 로그인은 진행
              proceedBubbleLogin(accessToken);
            }
          },
          fail: function (err) {
            console.error("[AGE] request fail", err);
            // 네트워크/SDK 오류 시에는 기존 로그인 진행 (원하면 차단으로 변경 가능)
            proceedBubbleLogin(accessToken);
          }
        });
        return;

      },

      fail: function (err) {
        console.error("[Kakao] 로그인 실패/취소:", err);
        setBtnLoading(false);

        // ✅ 핵심 변경: 실패/취소 시 return_to로 자동복귀하지 않음 (로그인 페이지 stay)
        // 사용자는 버튼을 다시 눌러 재시도 가능
        shNotify("로그인이 취소되었거나 실패했습니다.", "info");
      }
    });
  }

  // ===== bind click =====
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
</script>