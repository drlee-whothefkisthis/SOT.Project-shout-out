window.__SHOUT_EVENT_MAP__ = null;

async function shLoadEventMap() {
  if (window.__SHOUT_EVENT_MAP__) return window.__SHOUT_EVENT_MAP__;

  const EVENT_API = "https://plp-62309.bubbleapps.io/api/1.1/obj/event";
  const res = await fetch(EVENT_API, { method: "GET" });
  const json = await res.json();

  const map = {};
  const results = json?.response?.results || [];
  results.forEach(ev => {
    const code = ev.event_code;
    const name = ev.event_display_name;
    if (code) map[code] = (name || "").trim() || code;
  });

  window.__SHOUT_EVENT_MAP__ = map;
  return map;
}
