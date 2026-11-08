# Telegram Web Auto Translator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![Version](https://img.shields.io/badge/version-1.2.0-green.svg)](CHANGELOG.md)

Auto-translate Telegram Web messages **as they arrive** — no Telegram Premium, no account, no sign-up, no message limit.

Built because Telegram's whole-chat translation is Premium-only, and the Chrome Web Store alternatives cap you at 50 free messages and then ask for Premium.

> **Translated — shown under the original**
> The card verification passed and the GPU can really run.

## Features

- **Automatic** — new messages are translated within ~1 second, as you scroll. No clicking per message.
- **Bilingual by default** — translation appears under the original, so you can always see both. Switch to *Replace* mode in the popup to show English only (hover to see the original).
- **19 target languages** — English, Hindi, Urdu, Arabic, Russian, Chinese, Spanish, French, German, Portuguese, Turkish, Persian, Indonesian, Japanese, Korean, Bengali, Tamil, Telugu, Vietnamese, Ukrainian.
- **Works on Telegram Web A (`/a/`) and Web K (`/k/`)** — message text and link previews.
- **Smart** — skips messages already in your target language, skips URLs, skips timestamps / reactions / replies, caches translations, batches requests, retries failed ones.
- **Free translation engines, no API key** — Microsoft Edge Translator first (batched, up to 40 texts per request), Google Translate as fallback.
- **No server, no tracking** — everything runs in your browser. No account, no analytics.

## Install (for anyone, 2 minutes)

### Option A — From a GitHub Release (easiest for users)

1. Go to [**Releases**](https://github.com/fkd-alam/tg-translator/releases) and download `tg-translator-v1.2.0.zip`
2. Unzip it
3. In Chrome / Edge / Brave, go to `chrome://extensions`
4. Turn on **Developer mode** (top right)
5. Click **Load unpacked** and pick the unzipped `tg-translator` folder
6. Open https://web.telegram.org, log in with QR, open any chat — translations appear automatically

### Option B — From source

```bash
git clone https://github.com/fkd-alam/tg-translator.git
cd tg-translator
# then Load unpacked this folder in chrome://extensions, as above
```

## Usage

- Click the extension icon in Chrome to:
  - Turn auto-translate on / off
  - Change target language
  - Switch *Show under original* / *Replace original*
  - **Re-translate this chat** — clears the cache and re-translates everything visible
- Click a blue translation box to hide it (in *below* mode).

## How it works

| File | What it does |
|---|---|
| `manifest.json` | Manifest V3. Permissions: `storage` only. Host permissions for Telegram Web + the two translate endpoints only. |
| `content.js` | Watches Telegram Web with a `MutationObserver` + scroll / timer sweeps. Finds message text (`.text-content`, `.bubble .message`, link previews), strips timestamps / reactions / replies, sends non-target-language text to the background worker. |
| `background.js` | Translation worker. Batches up to 40 texts per Microsoft Edge request, caches up to 5,000 translations, falls back to Google Translate one-by-one if Microsoft fails / rate-limits. |
| `popup.html` / `popup.js` | Settings popup. Saved in `chrome.storage.sync`. |
| `content.css` | Blue translation box under each message. |

Translation flow:

```
Telegram Web message → content.js (detect + strip) → background.js
  → Microsoft Edge Translator (primary, batched)
  → Google Translate (fallback)
  → blue box under the original message
```

## Privacy

- Messages are sent to Microsoft / Google Translate to be translated — the same as pasting them into translate.google.com / Bing Translator.
- Nothing is stored on a server. The only storage is your settings + an in-memory translation cache in the extension.
- No Telegram login, password, token, or API key is used or collected. The extension never sees your Telegram credentials.
- Don't use it for highly sensitive chats.

## Limitations

- **Telegram Web only** (`web.telegram.org`). Chrome extensions can't run inside the native Telegram Mac / Windows / mobile apps.
- Translation quality = Microsoft / Google Translate quality. Slang, crypto jargon, and mixed-language messages ("感覺 easy hit") can be imperfect.
- The Microsoft Edge and Google `gtx` endpoints are free, unofficial endpoints — they can change, rate-limit, or break. If that happens, translations fail gracefully (original message is left untouched) and the extension needs an update.
- Images / voice messages are not translated (no text to translate).

## Development

No build step. Edit the files, then in `chrome://extensions` click **Reload** on the extension.

```bash
# Check syntax
node --check content.js && node --check background.js && node --check popup.js
python3 -m json.tool manifest.json > /dev/null && echo "manifest OK"
```

## Contributing

Pull requests welcome — especially:

- New Telegram Web selectors when Telegram changes its DOM
- New translation engines / fallbacks
- New target languages
- Bug reports: include your Telegram Web version (`/a/` or `/k/`), the message that didn't translate, and any error in the extension's console

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Disclaimer

Not affiliated with, endorsed by, or connected to Telegram, Microsoft, or Google. Telegram is a trademark of Telegram FZ-LLC. This is a community tool that uses publicly available free translation endpoints.

## License

[MIT](LICENSE) — free to use, modify, and share, for personal or commercial use.
