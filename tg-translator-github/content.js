(() => {
  const DEFAULTS = { enabled: true, target: "en", mode: "below" };
  let settings = { ...DEFAULTS };

  // Message text + link-preview text, for Telegram Web A (/a/) and Web K (/k/).
  const SELECTORS = [
    ".text-content",                                  // Web A message text
    ".WebPage-text", ".WebPage .text",                // Web A link preview
    ".bubble .message",                               // Web K message text
    ".webpage-description", ".web-description",       // Web K link preview
    ".translatable-message"
  ].join(",");
  const PREVIEW = ".WebPage-text, .WebPage .text, .webpage-description, .web-description";
  // Parts of a bubble that are not message text.
  const STRIP = ".tgx-translation, .time, .time-inner, .MessageMeta, .reactions, .Reactions, .message-reactions, .reply, .EmbeddedMessage, .name, .peer-title, .webpage, .WebPage";
  const SKIP_INSIDE = ".EmbeddedMessage, .reply, .chatlist, #LeftColumn, .ChatList, .sidebar-left, .tgx-translation, [contenteditable]";

  const cache = new Map();      // "target|text" -> {translated, source}
  const inflight = new Map();   // key -> Promise
  const failedUntil = new Map();// key -> timestamp for retry

  const getText = el => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(STRIP).forEach(n => n.remove());
    clone.querySelectorAll("img[alt]").forEach(i => i.replaceWith(i.alt)); // emoji
    return (clone.innerText || clone.textContent || "").trim();
  };

  const isUseful = t => t.length >= 2 && /\p{L}/u.test(t) && !/^(https?:\/\/|www\.)\S+$/i.test(t);
  const sameLang = (src, tgt) => (src || "").toLowerCase().split("-")[0] === tgt.toLowerCase().split("-")[0];
  const fails = new Map(); // text -> count

  function request(text) {
    const key = settings.target + "|" + text;
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (inflight.has(key)) return inflight.get(key);
    if ((failedUntil.get(key) || 0) > Date.now()) return Promise.reject("backoff");
    const p = new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "translate", text, target: settings.target }, res => {
        inflight.delete(key);
        if (chrome.runtime.lastError || !res || !res.ok) {
          failedUntil.set(key, Date.now() + 4000);
          return reject(res ? res.error : "no response");
        }
        const r = { translated: res.translated, source: res.source };
        cache.set(key, r);
        resolve(r);
      });
    });
    inflight.set(key, p);
    return p;
  }

  function render(el, text, r) {
    el.querySelectorAll(":scope > .tgx-translation").forEach(n => n.remove());
    el.classList.remove("tgx-replaced");
    const norm = x => x.replace(/\s+/g, " ").trim().toLowerCase();
    if (!r.translated || norm(r.translated) === norm(text)) return;
    // Skip only when it's really already in the target language (mixed text like "感覺easy hit" still translates).
    if (sameLang(r.source, settings.target) && !/[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(text)) return;
    const box = document.createElement("div");
    box.className = "tgx-translation";
    box.textContent = r.translated;
    box.title = "Translated from " + r.source + (settings.mode === "replace" ? "\nOriginal: " + text : "");
    if (settings.mode === "replace") {
      el.style.setProperty("--tgx-fs", getComputedStyle(el).fontSize);
      el.classList.add("tgx-replaced");
    }
    el.appendChild(box);
  }

  function handle(el) {
    if (el.closest(SKIP_INSIDE)) return;
    const isPreview = el.matches(PREVIEW);
    if (!isPreview && el.parentElement && el.parentElement.closest(SELECTORS)) return; // nested match
    const text = getText(el);
    if (!isUseful(text)) return;
    const hasBox = !!el.querySelector(":scope > .tgx-translation:not(.tgx-error)");
    const sig = settings.target + "|" + settings.mode + "|" + text;
    if (el.dataset.tgxSig === sig && (hasBox || el.dataset.tgxNone === "1")) return; // up to date
    el.dataset.tgxSig = sig;
    delete el.dataset.tgxNone;
    request(text).then(r => {
      if (el.dataset.tgxSig !== sig) return;            // element was reused meanwhile
      render(el, text, r);
      if (!el.querySelector(":scope > .tgx-translation")) el.dataset.tgxNone = "1";
      fails.delete(text);
    }).catch(err => {
      delete el.dataset.tgxSig;                         // retry on next sweep
      const n = (fails.get(text) || 0) + 1; fails.set(text, n);
      if (n >= 3 && !el.querySelector(":scope > .tgx-translation")) {
        const box = document.createElement("div");
        box.className = "tgx-translation tgx-error";
        box.textContent = "Translation failed, retrying…";
        box.title = String(err);
        el.appendChild(box);
      }
    });
  }

  // Sweep everything near the viewport. Runs on DOM changes, scroll, and on a timer,
  // so re-rendered, recycled, or previously failed messages get picked up again.
  let scheduled = false;
  function sweep() {
    scheduled = false;
    if (!settings.enabled) return;
    const vh = window.innerHeight;
    document.querySelectorAll(SELECTORS).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.bottom < -400 || r.top > vh + 400) return;
      handle(el);
    });
  }
  const schedule = () => { if (!scheduled) { scheduled = true; setTimeout(sweep, 250); } };

  function clearAll() {
    document.querySelectorAll(".tgx-translation").forEach(n => n.remove());
    document.querySelectorAll(".tgx-replaced").forEach(n => n.classList.remove("tgx-replaced"));
    document.querySelectorAll("[data-tgx-sig]").forEach(n => { delete n.dataset.tgxSig; delete n.dataset.tgxNone; });
  }

  new MutationObserver(muts => {
    if (muts.some(m => !(m.target.closest && m.target.closest(".tgx-translation")))) schedule();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener("scroll", schedule, true);
  window.addEventListener("resize", schedule);
  setInterval(schedule, 2000);

  chrome.storage.sync.get(DEFAULTS, s => { settings = s; schedule(); });
  chrome.storage.onChanged.addListener(changes => {
    for (const k in changes) settings[k] = changes[k].newValue;
    clearAll();
    schedule();
  });
  chrome.runtime.onMessage.addListener(msg => {
    if (msg && msg.type === "retranslate") { cache.clear(); failedUntil.clear(); clearAll(); schedule(); }
  });
})();
