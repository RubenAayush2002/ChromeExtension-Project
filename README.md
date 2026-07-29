# Personal Home Base

A Chrome extension that replaces your new tab page with a calm personal dashboard, plus a set of browser-wide tools for tabs, bookmarks, reading, and focus.

## What it does

- **New tab page:** live greeting & clock, a "Search the web" bar with instant open-tab/history suggestions as you type, a "Today's Focus" line, a "Today's Tasks" list, customizable background (gradients, your own photos/videos, a curated art pack, or animated scenery that matches the current weather), a weather corner, and a strip of recently closed tabs.
- **Toolbar popup:** tidy tabs into color-coded groups, close duplicate tabs (even with different tracking links), save/reopen named sets of tabs, get nudged when you have too many tabs open.
- **Bookmarks panel:** always-reachable, searchable, drag-to-reorder, auto-labelled, stays in sync with Chrome's own bookmarks.
- **Read Later & Reading View:** save pages for later with a short preview, and get a clean, distraction-free reading mode for articles.
- **Edge tab:** a small helper docked to the side of every page for quick actions without leaving it.
- **Focus Mode:** hides everything but your one focus for the day and blocks distracting sites, with a 5-minute pass if you genuinely need through.

## The two rules that shape everything

1. **Everything works fully and for free, with no sign-up.** There's an optional "smart layer" (uses your own free Groq API key) that quietly makes a handful of features better — same buttons, smarter results underneath — never a separate set of AI-only buttons for these upgrades.
2. **Privacy is absolute.** No accounts, no logins, no tracking, no analytics. All your data — tasks, focus, bookmarks, saved tabs, API keys — stays on your machine. The only network calls this extension ever makes are a weather lookup and, only if you turn it on, calls to Groq.

## Status

Spec is locked in. Not yet built. See `CLAUDE.md` for the full, detailed specification (architecture, feature-by-feature behavior, data model, permissions, and build phasing) — that file is written to be handed directly to Claude Code as build context.

## Suggested build order

1. Core new tab page (no AI)
2. Browser-wide tools (tab tidy, dedupe, saved sets, bookmarks panel, read later, reading view)
3. Edge tab + Focus Mode
4. Smart layer (Groq) on top of everything above
