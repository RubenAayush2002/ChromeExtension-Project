# Personal Home Base

A privacy-first Chrome extension that replaces your new tab page with a calm personal dashboard, and adds quality-of-life tools across the whole browser — tabs, bookmarks, reading, and focus.

Everything works fully, for free, with no account and no setup. An **optional AI layer** — powered by your own Groq API key — quietly upgrades a handful of features and unlocks three new ones.

> **Your data never leaves your machine.** No accounts, no logins, no analytics, no telemetry, no sync. The only network calls this extension ever makes are a weather lookup and, if you enable it, calls to Groq.

---

## ✨ The AI layer

The smart layer is **off by default**. Turn it on in Settings with a free [Groq API key](https://console.groq.com/keys), and there's a built-in walkthrough plus a **Test key** button to confirm it works before anything changes.

### Same buttons, smarter underneath

No parallel set of "AI buttons" — the features you already use just get better results.

| Feature | Without AI | With AI |
|---|---|---|
| **Paste a task list** | Splits on line breaks | Cleans up wording, merges fragments, drops junk lines |
| **Tidy tabs** | Groups by website | Groups by *topic* — "Flight booking", "Recipe research" — across different sites |
| **Bookmark labels** | Labelled by domain | Real topic labels — "Recipes", "Tax docs" |
| **Bookmark search** | Keyword matching | Natural language — *"that recipe site from last month"* |
| **Read Later preview** | First lines of the page | An actual short summary |

### Three AI-only features

These have no non-AI equivalent, so they're clearly gated rather than silently missing.

- **📖 Explain highlighted text** — select any confusing passage, get a plain-English explanation, with an *"explain even more simply"* follow-up.
- **🔍 Hold-Alt word lookup** — hold <kbd>Alt</kbd> and hover a word for a one-line meaning. Results are cached locally, so repeat lookups are instant and cost nothing.
- **💬 Ask across open tabs** — ask one question, get an answer synthesised from all your open tabs, with the source tabs cited.

### Built to degrade gracefully

If a call fails — bad key, offline, rate limit, timeout — the feature **quietly falls back to its simple version** and tells you what happened. It never breaks and never fails silently. The three AI-only features can't fall back, so they say plainly that they couldn't complete rather than doing nothing.

---

## 🏠 Everything else (no AI needed)

**New tab page** — live greeting and clock, a search bar with instant open-tab and history suggestions as you type, a Today's Focus line, a Today's Tasks list, a weather corner, recently closed tabs, and light/dark themes.

**Backgrounds** — gradient presets, bundled mood photos, your own uploaded images (resized automatically so they don't bloat storage), curated art that shifts with the time of day, or static scenery matched to the current weather.

**Toolbar popup** — tidy tabs into colour-coded groups, close duplicates (even when tracking parameters differ), save and reopen named tab sets, and get nudged when too many tabs pile up.

**Bookmarks panel** — searchable, drag-to-reorder, auto-labelled, and live-synced with Chrome's own bookmarks.

**Read Later & Reading View** — save pages with a preview, and read articles free of ads and clutter, with an estimated reading time.

**Edge tab** — a small helper docked to the side of every page for quick actions without leaving it.

**Focus Mode** — hides everything but your focus for the day, blocks distracting sites, and offers a 5-minute pass when you genuinely need through.

---

## 🔒 Privacy

Privacy here is architectural, not a policy promise:

- All data lives in `chrome.storage.local` and IndexedDB **on your device**. Nothing uses Chrome's sync.
- **No accounts, no logins, no analytics, no telemetry.**
- Your API keys are stored locally, masked in the UI after saving, and **never readable from a webpage** — all AI calls are made from the extension's background worker, never from page context.
- Only two external endpoints are ever contacted: `api.openweathermap.org` and, when enabled, `api.groq.com`. (The extension also requests `<all_urls>` access — needed to run the edge tab, reading view, and page extraction on the pages you visit. It reads those pages locally; it never sends them anywhere except to Groq when you explicitly use an AI feature.)

The trade-off is deliberate: since nothing syncs, your data exists only in this browser profile.

---

## 🚀 Getting started

```bash
git clone <repo-url>
cd SidekickExtension
npm install
npm run build
```

Then load it into Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder
4. Open a new tab — a short welcome sets your name and preferences

### Optional setup

- **Weather** — Settings → add a free [OpenWeatherMap](https://openweathermap.org/api) key and your city. Include a country code for ambiguous names (`Dublin,IE`).
- **AI layer** — Settings → Smart Layer → paste a free [Groq key](https://console.groq.com/keys) → **Test key** → toggle on.

---

## 🛠 Development

```bash
npm run dev        # watch build
npm test           # run the test suite
npm run typecheck  # type checking only
npm run build      # production build into dist/
```

**Stack:** TypeScript, Vite, Vitest. Manifest V3. No runtime dependencies.

**Architecture:** logic is kept pure and separated from Chrome APIs — `src/lib/` holds dependency-injected functions with no `chrome.*` globals, which is why the suite runs in plain Vitest with no browser. Surfaces (`newtab/`, `popup/`, `options/`, `bookmarks-panel/`, `content/`) are thin DOM wiring on top, and the background worker owns all network calls.

AI providers sit behind a single `AiProvider` interface, so adding another is a new implementation file rather than a refactor.

---

## 📋 Project status

All four build phases are complete: the new tab page, browser-wide tools, edge tab and Focus Mode, and the AI layer. 309 tests passing.

Known gaps: no export/import backup yet, and Groq is the only AI provider currently shipped.

The full specification — architecture, feature-by-feature behaviour, data model, and permissions — lives in [`CLAUDE.md`](CLAUDE.md).
