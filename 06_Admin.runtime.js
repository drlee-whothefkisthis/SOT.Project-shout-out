(function loadShoutoutAdmin() {
  "use strict";

  var current = document.currentScript;
  if (!current || !current.src) return;

  var runtimeUrl = current.src;
  var bodyUrl = runtimeUrl.replace(/06_Admin\.runtime\.js(?:\?.*)?$/, "06_Admin-B.js");
  var headUrl = runtimeUrl.replace(/06_Admin\.runtime\.js(?:\?.*)?$/, "06_Admin-H.js");
  var styleId = "sot-admin-mobile-layout-v1";
  var bodyId = "sot-admin-body-runtime";

  function loadResponsiveStyle() {
    if (document.getElementById(styleId)) return Promise.resolve();

    return fetch(headUrl)
      .then(function (response) {
        if (!response.ok) throw new Error("Admin responsive style request failed: " + response.status);
        return response.text();
      })
      .then(function (source) {
        var parsed = new DOMParser().parseFromString(source, "text/html");
        var responsiveStyle = parsed.getElementById(styleId);
        if (!responsiveStyle || document.getElementById(styleId)) return;
        document.head.appendChild(responsiveStyle.cloneNode(true));
      })
      .catch(function (error) {
        console.error("[SOT Admin] Responsive styles could not be loaded.", error);
      });
  }

  function loadAdminBody() {
    if (document.getElementById(bodyId)) return;

    var bodyScript = document.createElement("script");
    bodyScript.id = bodyId;
    bodyScript.src = bodyUrl;
    bodyScript.async = false;
    document.body.appendChild(bodyScript);
  }

  loadResponsiveStyle().then(loadAdminBody);
})();
