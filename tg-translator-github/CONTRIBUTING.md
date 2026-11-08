# Contributing

## How to contribute

1. Fork the repo, create a branch: `git checkout -b fix/selector-web-k`
2. Make your change — no build step, just edit the files.
3. Test it: Load unpacked in Chrome, open https://web.telegram.org, check a Chinese / Russian / Arabic group.
4. Check syntax: `node --check content.js && node --check background.js && node --check popup.js`
5. Open a Pull Request with:
   - What changed and why
   - Which Telegram Web version you tested (`/a/` or `/k/`)
   - A screenshot if the UI changed

## Rules

- No API keys, tokens, passwords, or personal data in code or commits.
- No new permissions in `manifest.json` without explaining why in the PR.
- Keep the extension free — no paywalls, counters, or sign-ups.
- Keep translations bilingual by default; don't hide the original without a way to see it.
