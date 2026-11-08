const DEFAULTS = { enabled: true, target: "en", mode: "below" };
const $ = id => document.getElementById(id);
chrome.storage.sync.get(DEFAULTS, s => {
  $("enabled").checked = s.enabled; $("target").value = s.target; $("mode").value = s.mode;
});
$("enabled").onchange = e => chrome.storage.sync.set({ enabled: e.target.checked });
$("target").onchange = e => chrome.storage.sync.set({ target: e.target.value });
$("mode").onchange = e => chrome.storage.sync.set({ mode: e.target.value });
$("retry").onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: "retranslate" }, () => void chrome.runtime.lastError);
    window.close();
  });
};
