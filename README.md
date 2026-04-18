# ClaudeCog

> A cognitive layer for code. Powered by Claude.

[Português](README.pt-BR.md) · **English** · [Español](README.es.md)

[![npm](https://img.shields.io/npm/v/claudecog?color=7B68EE&label=npm)](https://www.npmjs.com/package/claudecog)
[![License](https://img.shields.io/badge/License-MIT-FF6B35.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-10B981.svg)](package.json)

ClaudeCog reads your repo as a system, not a pile of files. It gives you three things:

- a map of how the pieces fit together
- a senior engineer walkthrough of any file
- a prioritized list of real risks (no lint nits)

## Quick start

```bash
cd your-project
npx claudecog map
```

The first run opens a 30 second wizard. It picks Claude Code automatically if you have it, otherwise it asks for an Anthropic API key.

## Commands

### `claudecog map`

Builds a model of the system and opens an interactive graph in your browser. You get a one paragraph summary of what the system does, 5 to 12 modules color coded by layer, and the relationships between them.

```bash
claudecog map
```

Use it for onboarding, refactor planning, or to answer "what does this repo even do".

### `claudecog explain <file>`

A senior engineer pairing with you for ten minutes on a single file. Output is rendered Markdown with five sections: what the file is for, the mental model, walkthrough, gotchas, and how to improve it.

```bash
claudecog explain src/auth/middleware.ts
```

Run without a file to get an interactive picker of the most important ones.

### `claudecog risks`

Focused risk review. Skips lint nits. Looks for things that hurt in production: security gaps, reliability hazards, silent coupling, dependency risks, performance traps, architectural debt. Each risk has a clear "why" and a concrete fix.

```bash
claudecog risks
```

## Install

You don't need to install anything. `npx claudecog` works on any machine with Node 18+.

If you run it often, install globally:

```bash
npm install -g claudecog
claudecog map
# the short alias also works
cog map
```

## Languages

The CLI is available in three languages: English, Português (Brasil), Español. It auto detects from your `$LANG` environment variable. To force a language:

```bash
claudecog map --lang pt
# or set it permanently in the wizard
claudecog setup --reset
```

You can also set `CLAUDECOG_LANG=pt` in your shell.

## Backends

ClaudeCog talks to Claude in one of two ways:

| Backend | When to pick it |
| --- | --- |
| Claude Code CLI | You already have `claude` installed. Auto detected. Free under your subscription. |
| Anthropic API | Pay per use. Set `ANTHROPIC_API_KEY` or paste it in the wizard. |

Config lives at `~/.claudecog/config.json` (`0600`). Cache lives at `.claudecog/` inside the project (gitignored).

## How it works

```
your repo
   │
   ▼
scanner       walks files, respects .gitignore
   │
   ▼
Claude        models the system, returns structured JSON
   │
   ▼
renderers     interactive D3 graph, terminal Markdown, risk boxes
```

To skip files, add a `.claudecogignore` to your repo. Same syntax as `.gitignore`.

To force a fresh analysis, add `--refresh` to any command.

## Contributing

The codebase is small (~3k lines) and readable. The fastest way to learn it is to clone it and run `claudecog explain` on it.

```bash
git clone https://github.com/felipepreseti/claudecog
cd claudecog
npm install
npm run build
node dist/cli.js map
```

PRs welcome for new commands, new renderers, prompt improvements, and language additions.

## License

MIT
