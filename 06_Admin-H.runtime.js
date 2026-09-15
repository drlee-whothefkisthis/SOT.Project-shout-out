(function loadAdminMobileStyles() {
  "use strict";

  var STYLE_ID = "sot-admin-mobile-layout-v1";
  if (document.getElementById(STYLE_ID)) return;

  var script = document.currentScript;
  if (!script || !script.src) return;

  var sourceUrl = script.src.replace(/06_Admin-H\.runtime\.js(?:\?.*)?$/, "06_Admin-H.js");

  fetch(sourceUrl)
    .then(function (response) {
      if (!response.ok) throw new Error("Admin mobile style request failed: " + response.status);
      return response.text();
    })
    .then(function (source) {
      var parsed = new DOMParser().parseFromString(source, "text/html");
      var mobileStyle = parsed.getElementById(STYLE_ID);
      if (!mobileStyle || document.getElementById(STYLE_ID)) return;

      document.head.appendChild(mobileStyle.cloneNode(true));
    })
    .catch(function (error) {
      console.error("[SOT Admin] Mobile styles could not be loaded.", error);
    });
})();
