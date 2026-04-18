<div align="center">

# ClaudeCog

### A cognitive layer for code. Powered by Claude.

**ClaudeCog doesn't write code better than you. It makes you think better about the code you already have.**

[![npm version](https://img.shields.io/npm/v/claudecog?color=7B68EE&label=npm)](https://www.npmjs.com/package/claudecog)
[![License: MIT](https://img.shields.io/badge/License-MIT-FF6B35.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-10B981.svg)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-F59E0B.svg)](#contributing)

```
   ________                __      ______           
  / ____/ /___ ___  ______/ /__   / ____/___  ____ _
 / /   / / __ `/ / / / __  / _ \ / /   / __ \/ __ `/
/ /___/ / /_/ / /_/ / /_/ /  __// /___/ /_/ / /_/ / 
\____/_/\__,_/\__,_/\__,_/\___/ \____/\____/\__, /  
                                           /____/   
```

</div>

---

## What is ClaudeCog?

Most AI tools for code do one of three things: **generate code, complete a function, answer a question.**

ClaudeCog does something different:

> **It models your entire system before it acts.**

You point it at a messy repo. ClaudeCog reads it as a **living system** — not a pile of files — and gives you three things:

- a **map** of how the pieces actually fit together
- a **senior-engineer walkthrough** of any file
- a **prioritized list of real risks** (not lint nits)

It's the layer between "I have code" and "I understand my code."

---

## Quick start

You don't have to install anything.

```bash
cd your-project
npx claudecog map
```

That's it. The first time you run it, ClaudeCog will guide you through a 30-second setup (it auto-detects [Claude Code](https://www.anthropic.com/claude-code) if you have it; otherwise it asks for an Anthropic API key).

Prefer to install globally?

```bash
npm install -g claudecog
claudecog map
# or use the short alias
cog map
```

---

## The three commands

### `claudecog map`

Builds a system model of your repo and opens an **interactive graph** in your browser.

```bash
claudecog map
```

You get:

- a one-paragraph plain-English description of what your system actually is
- 5–12 logical **modules** (not files — modules), color-coded by layer
- the **relationships** between them
- a draggable, zoomable D3 graph you can explore

> Use it for: onboarding, refactor planning, "wait, what does this repo even do?"

### `claudecog explain <file>`

A senior engineer pairing with you for ten minutes on a single file.

```bash
claudecog explain src/auth/middleware.ts
```

You get a Markdown-rendered walkthrough with five sections:

1. **What this file is for** — the problem it solves in the system
2. **Mental model** — the abstractions you need in your head before reading
3. **Walkthrough** — narrative, focused on intent, not syntax
4. **Surprises and gotchas** — implicit contracts, hidden coupling, sharp edges
5. **How I would change it** — opinionated, concrete suggestions

No file argument? You get an interactive picker of the most important files.

> Use it for: legacy code, code review prep, learning a new repo.

### `claudecog risks`

A focused risk review. Skips lint-level nits. Looks for things that will actually hurt you.

```bash
claudecog risks
```

You get a prioritized list (highest severity first) covering:

- **security** — secrets, injection, auth gaps
- **reliability** — error handling, retries, blocking I/O on hot paths
- **data** — integrity, consistency
- **coupling** — silent dependencies that will hurt future refactors
- **onboarding** — undocumented assumptions, magic constants
- **dependencies** — abandoned, vulnerable, mis-pinned
- **testing** — _where_ the lack of tests will bite (not "add more tests")
- **performance** — traps that show up under load
- **architecture** — debt that will compound

Each risk has a clear **why it matters** and a concrete **suggested fix**.

> Use it for: pre-production audits, due diligence, deciding what to refactor first.

---

## Philosophy

ClaudeCog treats code as a **cognitive system**, not text.

It builds an internal representation of your software and operates on that representation. That's why one `map` run gives you more clarity than a hundred autocompletes.

The bet:

> The next leap in dev tools isn't writing more code, faster.
> It's understanding the code we already have, deeper.

---

## How it works

```
┌──────────────────┐
│  your repo       │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  scanner                               │
│  walks files, respects .gitignore,     │
│  builds a structural snapshot          │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  Claude (your backend)                 │
│  models the system, writes structured  │
│  JSON, returns rich analysis           │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  renderers                             │
│  · interactive D3 graph (HTML)         │
│  · markdown in your terminal           │
│  · prioritized risk boxes              │
└────────────────────────────────────────┘
```

All output is cached locally in `.claudecog/` inside your project. Add `--refresh` to any command to force a re-analysis.

---

## Configuration

ClaudeCog stores its config at `~/.claudecog/config.json` (mode `0600`).

```bash
claudecog setup          # (re)run the wizard
claudecog setup --reset  # delete and start over
claudecog config         # show current settings
```

You can choose between two backends:

| Backend | When to pick it |
| --- | --- |
| **Claude Code CLI** | You already have `claude` installed. Free under your subscription. Auto-detected. |
| **Anthropic API** | Pay-per-use. Set `ANTHROPIC_API_KEY` or paste it in the wizard. |

Want to skip a file or directory? Add a `.claudecogignore` to your repo. It uses the same syntax as `.gitignore`.

---

## FAQ

**Do I need to know how to code?**
You need to be _curious_ about code. ClaudeCog runs against any repo on your machine — your own, an open-source project you want to understand, your team's monolith, whatever.

**Does it send my whole codebase to Claude?**
No. It sends a structural snapshot (file tree, language stats, manifests, a handful of high-signal files). You can inspect exactly what gets sent by reading [`src/commands/`](src/commands/).

**Will it modify my code?**
Never. ClaudeCog is read-only against your repo. It only writes to `.claudecog/` (cache) inside the project and to `~/.claudecog/config.json` (settings).

**Does it work on huge repos?**
Yes. It samples intelligently rather than dumping everything into the context window. Performance is bounded by Claude's response time, not your repo size.

**Why "Cog"?**
Cognitive engine. Also: every cog turns the next one. That's how we want your code to feel.

---

## Contributing

ClaudeCog is open source and built in public. The codebase is intentionally small and readable — clone it, run `claudecog explain` on it, and you'll know it in 20 minutes.

```bash
git clone https://github.com/felipepreseti/claudecog
cd claudecog
npm install
npm run build
node dist/cli.js map
```

PRs welcome for:

- new commands (`cog test-plan`, `cog onboard`, `cog adrs`, …)
- new renderers (Mermaid export, PDF reports, Notion sync)
- better prompts (the prompts are in [`src/commands/`](src/commands/) — easy to iterate on)
- language-specific scanners (current scanner is generic)

---

## License

MIT © ClaudeCog contributors

---

<div align="center">

**ClaudeCog doesn't write code better than you.**
**It makes you think better about the code you already have.**

</div>
