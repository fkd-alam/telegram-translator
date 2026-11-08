// Translation runs here so the page's CORS rules don't block it.
// Primary: Microsoft Edge translator (batched, generous limits). Fallback: Google.
const cache = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- Microsoft (Edge) ----------
let msToken = null, msTokenAt = 0;
async function getMsToken(force) {
  if (!force && msToken && Date.now() - msTokenAt < 8 * 60 * 1000) return msToken;
  const res = await fetch("https://edge.microsoft.com/translate/auth");
  if (!res.ok) throw new Error("ms auth HTTP " + res.status);
  msToken = (await res.text()).trim();
  msTokenAt = Date.now();
  return msToken;
}
const msLang = t => ({ "zh-CN": "zh-Hans", "zh-TW": "zh-Hant", "pt": "pt-br" }[t] || t);
const normSrc = s => ({ "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", "yue": "zh-TW", "lzh": "zh-TW" }[s] || s);

async function viaMicrosoft(texts, target, retry = true) {
  const token = await getMsToken(!retry);
  const res = await fetch("https://api-edge.cognitiveservices.azure.com/translate?api-version=3.0&to=" + encodeURIComponent(msLang(target)), {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(texts.map(t => ({ Text: t })))
  });
  if (res.status === 401 && retry) return viaMicrosoft(texts, target, false);
  if (!res.ok) throw new Error("ms HTTP " + res.status);
  const data = await res.json();
  return data.map(d => ({
    translated: d.translations && d.translations[0] ? d.translations[0].text : "",
    source: normSrc(d.detectedLanguage ? d.detectedLanguage.language : "auto")
  }));
}

// ---------- Google (fallback, one text per request) ----------
async function viaGoogle(text, target) {
  const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=" +
    encodeURIComponent(target) + "&q=" + encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error("google HTTP " + res.status);
  const data = await res.json(); // throws on the HTML "sorry" page when rate-limited
  return { translated: (data[0] || []).map(p => p[0]).join(""), source: data[2] || "auto" };
}

// ---------- Batching queue ----------
let pending = [];       // {text, target, resolve, reject}
let timer = null;
let msCooldownUntil = 0;

function enqueue(text, target) {
  const key = target + "|" + text;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return new Promise((resolve, reject) => {
    pending.push({ text, target, key, resolve, reject });
    if (!timer) timer = setTimeout(flush, 120);
  });
}

async function flush() {
  timer = null;
  const jobs = pending; pending = [];
  const byTarget = {};
  for (const j of jobs) (byTarget[j.target] = byTarget[j.target] || []).push(j);
  for (const target in byTarget) {
    const list = byTarget[target];
    for (let i = 0; i < list.length; i += 40) {
      const chunk = list.slice(i, i + 40);
      await runChunk(chunk, target);
    }
  }
}

async function runChunk(chunk, target) {
  // Dedupe texts inside the chunk.
  const uniq = [...new Set(chunk.map(j => j.text))];
  let results = null, lastErr = null;
  if (Date.now() > msCooldownUntil) {
    for (let attempt = 0; attempt < 2 && !results; attempt++) {
      try { results = await viaMicrosoft(uniq, target); }
      catch (e) { lastErr = e; await sleep(500 * (attempt + 1)); }
    }
    if (!results) msCooldownUntil = Date.now() + 30000;
  }
  const map = new Map();
  if (results) uniq.forEach((t, i) => map.set(t, results[i]));
  else {
    for (const t of uniq) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try { map.set(t, await viaGoogle(t, target)); break; }
        catch (e) { lastErr = e; await sleep(700 * (attempt + 1)); }
      }
      await sleep(150);
    }
  }
  for (const j of chunk) {
    const r = map.get(j.text);
    if (r && r.translated) {
      if (cache.size > 5000) cache.clear();
      cache.set(j.key, r);
      j.resolve(r);
    } else j.reject(String(lastErr || "no result"));
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "translate") {
    enqueue(msg.text, msg.target)
      .then(r => sendResponse({ ok: true, ...r }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});
