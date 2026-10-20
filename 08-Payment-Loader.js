
(function () {
  'use strict';



  function inject(){
    var loader = document.createElement('div');
    loader.className = 'loader';
    loader.innerHTML =
      '<span><span></span><span></span><span></span><span></span></span>' +
      '<div class="base"><span></span></div>' +
      '<div class="face"></div>';

    var longfazers = document.createElement('div');
    longfazers.className = 'longfazers';
    longfazers.innerHTML = '<span></span><span></span><span></span><span></span>';

    var hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML =
      '<div class="km" id="kmText">0.000km / 42.195km</div>' +
      '<div class="bar-wrap"><div class="bar" id="bar"></div></div>';

    document.body.appendChild(loader);
    document.body.appendChild(longfazers);
    document.body.appendChild(hud);

    var TOTAL = 42.195;
    var DURATION = 6200;
    var kmText = hud.querySelector('#kmText');
    var bar = hud.querySelector('#bar');
    var start = performance.now();

    function tick(t){
      var p = ((t - start) % DURATION) / DURATION;
      kmText.textContent = (TOTAL * p).toFixed(3) + 'km / 42.195km';
      bar.style.width = (p * 100).toFixed(2) + '%';
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
