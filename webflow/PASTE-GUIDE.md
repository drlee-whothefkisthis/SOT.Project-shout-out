# Webflow 붙여넣기 코드 — v1.0.0

새 소유자: `project01-SOT`. 아래 코드는 해당 입력칸의 **기존 전체 내용을 교체**합니다. 추가로 덧붙이지 마세요.
사이트 공통 Head/Footer를 먼저 교체하고, 페이지별 Head/Body를 교체한 뒤 한 번에 Publish합니다. SDK 태그, 순서, 어드민 `defer`를 그대로 유지하세요.
기능 변경 없이 코드 위치와 파일명·버전 주소를 정리했습니다. Bubble 배포는 필요하지 않습니다. 현재 운영 설정은 아직 교체하지 않았습니다.

## 사이트 공통 — Site Settings → Custom code

### Head code

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/00-Global-Head.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/00-Global.css">
```

### Footer code

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/00-Global.js"></script>
```

## Home — /index

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/01-Main.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/01-Main.js"></script>
```

## Gallery — /gallery

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/02-Gallery.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/02-Gallery.js"></script>
```

## Cart — /cart

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/03-Cart.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/03-Cart.js"></script>
```

## Checkout — /checkout

### Inside `<head>`

```html
<script src="https://js.tosspayments.com/v2/standard"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/03-Checkout.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/03-Checkout.js"></script>
```

## Mypage — /mypage

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/04-MyPage.css">
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/04-MyPage-Head.js"></script>
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/04-MyPage.js"></script>
```

## Login — /login

### Inside `<head>`

```html
<script src="https://developers.kakao.com/sdk/js/kakao.js"></script>

```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/05-Login.js"></script>
```

## Admin — /admin

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/06-Admin.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/06-Admin.js" defer></script>
```

## PhotoLog — /event-photographer-log

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/07-PhotoLog.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/07-PhotoLog.js"></script>
```

## Payment Success — /payments-results/success

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/08-Payment.css">
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/08-Payment-Loader.js"></script>
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/08-Payment.js"></script>
```

## FAQ — /menu/faq

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/09-FAQ.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/09-FAQ.js"></script>
```

## Contact — /menu/contact

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/10-Contact.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/10-Contact.js"></script>
```

## AdminGate — /admingate

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/06-AdminGate.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/06-AdminGate.js"></script>
```

## GeneralLog — /general-shooting-log

### Inside `<head>`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/07-GeneralLog.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/07-GeneralLog.js"></script>
```

## Cart Copy — /archive/cart-copy

### Inside `<head>`

```html
<script src="https://js.tosspayments.com/v1/payment"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/90-CartArchive.css">
```

### Before `</body>`

```html
<script src="https://cdn.jsdelivr.net/gh/project01-SOT/SOT.Project-shout-out@v1.0.0/90-CartArchive.js"></script>
```

## Payment Fail — /payments-results/fail

### Inside `<head>`

비워 둡니다.

### Before `</body>`

비워 둡니다.

## About — /menu/about

### Inside `<head>`

비워 둡니다.

### Before `</body>`

비워 둡니다.

## Policy — /menu/terms-of-service-copy

### Inside `<head>`

비워 둡니다.

### Before `</body>`

비워 둡니다.

## Terms-of-service — /terms-of-service

### Inside `<head>`

비워 둡니다.

### Before `</body>`

비워 둡니다.

## 보관·Embed·유틸리티 페이지

- Cart Copy는 보관 페이지입니다. 위 90-CartArchive 코드도 Git에서 관리하지만 보관 상태를 유지합니다.
- Archive/Untitled는 운영 재사용 대상이 아닙니다. 페이지 Head/Body는 비어 있으며, 내부 예전 Weglot Embed는 원문을 Git에 보존했습니다. 이번에 활성화하거나 교체하지 마세요.
- 운영 페이지의 SVG 등 정적 Embed는 자바스크립트 로직으로 옮기지 않습니다. `webflow/embeds/`에 원문·위치를 기록했습니다.
- 404 / Search 유틸리티 페이지는 공통 코드만 적용하며 추가 페이지 코드는 없습니다.
- Webflow가 생성하는 HTML·CSS·JS는 `webflow/originals/export/` 스냅샷으로 보존했습니다. Designer 레이아웃을 변경하면 다시 Export해 이 스냅샷을 갱신해야 합니다.

## 배포 후 확인

- 모든 새 CDN 요청이 200이며 JS/CSS 오류가 없는지 확인.
- PC/모바일 장바구니 → 결제 시 로그인 먼저, 복귀 후 동의 유지.
- 마이페이지 최신 구매 대회 기본 선택 및 모바일 메뉴 안에만 LOGOUT 표시.
- 결제 성공 페이지 로딩 표시 → 구매 내역 이동, 관리자 진입 및 모바일 레이아웃.
- 실제 결제 승인·다운로드 검증은 사용자 로그인/결제 상태에서 확인. 이 정리 작업 중 실제 결제는 수행하지 않았습니다.

## 되돌리기

`webflow/originals/global-*.html` 및 `webflow/originals/pages/`의 해당 원문으로 복구하고 Publish합니다. 이전 SHA 주소는 그대로 보존됩니다.
