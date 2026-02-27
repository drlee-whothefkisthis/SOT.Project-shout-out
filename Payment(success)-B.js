<script>
document.addEventListener("DOMContentLoaded", async function () {
    console.log("[System] 결제 성공 페이지 진입");

    // 1. 설정
    const BUBBLE_CONFIRM_API = "https://plp-62309.bubbleapps.io/version-test/api/1.1/wf/confirm_payment";
    const usersId = localStorage.getItem("shout_users_id"); // 로그인된 유저 ID
    const MY_PAGE_PATH = "/mypage"; // 마이페이지 경로 (Webflow 설정에 맞게 수정)

    // 2. URL 파라미터 파싱 (Toss가 보내준 값들)
    const urlParams = new URLSearchParams(window.location.search);
    const paymentKey =       urlParams.get("paymentKey");
    const orderId = urlParams.get("orderId");
    const amount = urlParams.get("amount");

    const statusMsg = document.getElementById("status-message"); // 화면에 메시지 띄울 요소 ID (없으면 생략 가능)

    // 3. 필수 정보 없으면 중단
    if (!paymentKey || !orderId || !amount) {
        alert("잘못된 접근입니다.");
        return;
    }

    // 4. 결제 승인 요청 실행
    await processPaymentConfirm();

    async function processPaymentConfirm() {
        if(statusMsg) statusMsg.innerText = "결제를 최종 승인하고 있습니다...";

        // 장바구니에서 Photo ID 꺼내기
        const storedCart = localStorage.getItem('shout_cart_data'); 
        let photoIdsArray = [];
        if (storedCart) {
            try {
                const parsed = JSON.parse(storedCart);
                // _id가 있으면 쓰고, 없으면 fileName이라도 보냄
                photoIdsArray = (parsed.items || []).map(item => item._id || item.fileName);
            } catch (e) { console.error("장바구니 파싱 에러", e); }
        }

        const payload = {
            "paymentKey": paymentKey, // 백엔드 스크린샷 4번 파라미터명 (소문자 k 주의)
            "orderId": orderId,
            "amount": Number(amount),
            "photo_ids": photoIdsArray,
            "users_id": usersId
        };

        try {
            const response = await fetch(BUBBLE_CONFIRM_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // 성공 시 처리
                if(statusMsg) statusMsg.innerText = "구매가 완료되었습니다!";
                localStorage.removeItem('shout_cart_data'); // 장바구니 비우기
                
                alert("결제가 성공적으로 완료되었습니다.");
                // 마이페이지로 이동
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
</script>