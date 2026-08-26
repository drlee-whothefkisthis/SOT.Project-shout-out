(function () {
function onReady(fn) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
        fn();
    }
}

onReady(async function () {
    console.log("[System] 결제 성공 페이지 진입");

    const BUBBLE_CONFIRM_API = "https://plp-62309.bubbleapps.io/api/1.1/wf/confirm_payment";
    const CHECKOUT_CONTEXT_KEY = "shout_checkout_context";
    const usersId = localStorage.getItem("shout_users_id");
    const accessToken = sessionStorage.getItem("shout_access_token") || "";
    const MY_PAGE_PATH = "/mypage";

    const urlParams = new URLSearchParams(window.location.search);
    const paymentKey =       urlParams.get("paymentKey");
    const orderId = urlParams.get("orderId");
    const amount = urlParams.get("amount");
    const sessionId = urlParams.get("session_id") || sessionStorage.getItem("sot_session_id") || "";
    const statusMsg = document.getElementById("status-message");

    function readCheckoutContext() {
        try {
            const raw =
                sessionStorage.getItem(CHECKOUT_CONTEXT_KEY) ||
                localStorage.getItem(CHECKOUT_CONTEXT_KEY) ||
                "";
            return raw ? (JSON.parse(raw) || {}) : {};
        } catch (e) {
            console.warn("[Payment Success] checkout context parse failed", e);
            return {};
        }
    }

    function getShoutTrackingContext(checkoutContext) {
        if (!window.ShoutTracking || typeof window.ShoutTracking.getTrackingContext !== "function") return null;

        try {
            return window.ShoutTracking.getTrackingContext({
                local_user: checkoutContext && checkoutContext.local_user
            });
        } catch (e) {
            console.warn("[Payment Success] tracking context failed", e);
            return null;
        }
    }

    if (!paymentKey || !orderId || !amount) {
        alert("잘못된 접근입니다.");
        return;
    }

    if (!usersId || !accessToken) {
        if (statusMsg) statusMsg.innerText = "결제 승인을 위해 다시 로그인해주세요.";
        try {
            sessionStorage.setItem("shout_auth_intent", JSON.stringify({
                after: "payment_confirm",
                return_to: window.location.href,
                fallback_to: window.location.origin + MY_PAGE_PATH,
                created_at: Date.now()
            }));
        } catch (e) {
            console.warn("[Payment Success] auth intent store failed", e);
        }
        window.location.href = "/login";
        return;
    }

    await processPaymentConfirm();

    async function processPaymentConfirm() {
        if(statusMsg) statusMsg.innerText = "결제를 최종 승인하고 있습니다...";

        function normalizeBibMetaEntries(entries, defaults) {
            const list = Array.isArray(entries) ? entries : [];
            const fallback = defaults || {};
            const seededList = list.length ? list : (
                fallback.event_code || fallback.identifier_value || fallback.primary_identifier_value
                    ? [fallback]
                    : []
            );
            return seededList.map((row) => {
                const source = row || {};
                const identifierType = String(source.identifier_type || source.primary_identifier_type || "").trim();
                const identifierValue = String(source.identifier_value || source.primary_identifier_value || "").trim();
                const bib = String(source.bib || "").trim();
                const ocrBib = String(
                    source.ocr_bib ||
                    (identifierType === "bib" ? (identifierValue || bib) : "") ||
                    ""
                ).trim();
                const ocrName = String(
                    source.ocr_name ||
                    (identifierType === "name" ? identifierValue : "") ||
                    ""
                ).trim();
                return {
                    event_code: String(source.event_code || fallback.event_code || "").trim(),
                    identifier_type: identifierType,
                    identifier_value: identifierValue,
                    bib: bib || ocrBib,
                    ocr_bib: ocrBib,
                    ocr_name: ocrName,
                    searched_query: String(source.searched_query || identifierValue || ocrBib || ocrName || "").trim(),
                    count: Number(source.count || 0) || 0
                };
            });
        }

        const storedCart = localStorage.getItem('shout_cart_data');
        const storedCheckoutContext = sessionStorage.getItem(CHECKOUT_CONTEXT_KEY) || localStorage.getItem(CHECKOUT_CONTEXT_KEY);
        let photoIdsArray = [];
        let storedCartMeta = {};
        let bibMetaJson = "[]";
        let hasCheckoutContext = false;
        let checkoutContext = {};

        if (storedCheckoutContext) {
            try {
                const parsed = JSON.parse(storedCheckoutContext);
                checkoutContext = parsed || {};
                hasCheckoutContext = true;
                photoIdsArray = Array.isArray(parsed.photo_ids) ? parsed.photo_ids : [];
                bibMetaJson = JSON.stringify(normalizeBibMetaEntries(parsed.bib_meta || parsed.groups || [], parsed));
                storedCartMeta = {
                    searched_query: parsed.searched_query || parsed.primary_identifier_value || ""
                };
            } catch (e) {
                console.error("체크아웃 컨텍스트 파싱 에러", e);
            }
        }

        if (!hasCheckoutContext && storedCart) {
            try {
                const parsed = JSON.parse(storedCart);
                const items = parsed.items || [];
                const firstIdentifiedItem = items.find(item => item && (item.identifier_value || item.search_value || item.bib || item.ocr_name)) || {};
                photoIdsArray = items.map(item => item._id || item.fileName);
                bibMetaJson = JSON.stringify(normalizeBibMetaEntries(parsed.bib_meta || parsed.groups || [], parsed));
                storedCartMeta = {
                    searched_query: parsed.searched_query || firstIdentifiedItem.searched_query || firstIdentifiedItem.identifier_value || firstIdentifiedItem.search_value || firstIdentifiedItem.bib || ""
                };
            } catch (e) { console.error("장바구니 파싱 에러", e); }
        }

        const tracking = getShoutTrackingContext(checkoutContext);
        const trackedSessionId = String((tracking && tracking.session_id) || sessionId || "").trim();
        const firstGroup = Array.isArray(checkoutContext.groups) && checkoutContext.groups.length
            ? checkoutContext.groups[0]
            : {};
        const payloadEventCode = String(
            checkoutContext.event_code ||
            firstGroup.event_code ||
            ""
        ).trim();
        const payloadIdentifierType = String(
            checkoutContext.identifier_type ||
            checkoutContext.primary_identifier_type ||
            firstGroup.identifier_type ||
            ""
        ).trim();
        const payloadIdentifierValue = String(
            checkoutContext.identifier_value ||
            checkoutContext.primary_identifier_value ||
            firstGroup.identifier_value ||
            ""
        ).trim();
        const payloadOcrBib = String(
            checkoutContext.ocr_bib ||
            firstGroup.ocr_bib ||
            firstGroup.bib ||
            (payloadIdentifierType === "bib" ? payloadIdentifierValue : "") ||
            ""
        ).trim();
        const payloadOcrName = String(
            checkoutContext.ocr_name ||
            firstGroup.ocr_name ||
            (payloadIdentifierType === "name" ? payloadIdentifierValue : "") ||
            ""
        ).trim();
        const payloadSearchedQuery = String(
            checkoutContext.searched_query ||
            firstGroup.searched_query ||
            storedCartMeta.searched_query ||
            payloadIdentifierValue ||
            payloadOcrBib ||
            payloadOcrName ||
            ""
        ).trim();

        const payload = {
            "paymentKey": paymentKey,
            "orderId": orderId,
            "amount": Number(amount),
            "photo_ids": photoIdsArray,
            "photo_ids_json": JSON.stringify(photoIdsArray),
            "bib_meta_json": bibMetaJson,
            "event_code": payloadEventCode,
            "identifier_type": payloadIdentifierType,
            "identifier_value": payloadIdentifierValue,
            "ocr_bib": payloadOcrBib,
            "ocr_name": payloadOcrName,
            "searched_query": payloadSearchedQuery,
            "session_id": trackedSessionId,
            "users_id": usersId,
            "access_token": accessToken,
            "local_user": String((tracking && tracking.local_user) || checkoutContext.local_user || "").trim(),
            "session_key": String((tracking && tracking.ses_k) || urlParams.get("sk") || urlParams.get("ses_k") || checkoutContext.session_key || checkoutContext.ses_k || "").trim(),
            "utm_source": String((tracking && tracking.utm_s) || urlParams.get("utm_s") || urlParams.get("utm_source") || checkoutContext.utm_source || checkoutContext.utm_s || "").trim(),
            "utm_campaign": String((tracking && tracking.utm_campaign) || urlParams.get("utm_c") || urlParams.get("utm_campaign") || checkoutContext.utm_campaign || checkoutContext.utm_c || "").trim()
        };

        try {
            const response = await fetch(BUBBLE_CONFIRM_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                if(statusMsg) statusMsg.innerText = "구매가 완료되었습니다!";
                localStorage.removeItem('shout_cart_data');

                alert("결제가 성공적으로 완료되었습니다.");
                window.location.href = MY_PAGE_PATH;
            } else {
                throw new Error("API 응답 오류");
            }
        } catch (error) {
            console.error(error);
            if(statusMsg) statusMsg.innerText = "승인 중 오류가 발생했습니다. 고객센터에 문의해주세요.";
            alert("결제 승인 실패. 관리자에게 문의하세요.");
        }
    }
});
})();
