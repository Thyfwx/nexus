# Nexus AI Terminal

AI terminal with 4 chat modes, 8 browser games, image generation, leaderboards, and live diagnostics.

**Live:** [thyfwxit.com/nexus](https://thyfwxit.com/nexus)

## What's in it

- **4 AI chat modes** — Nexus (general), Coder (programming), Education (learning), Unfiltered (18+ casual)
- **8 games** — Wordle, Snake, Pong, Flappy, Breakout, Invaders, Minesweeper, Breach Protocol
- **Image generation** — Replicate Flux + Pollinations fallback, SFW only
- **Leaderboards** — per-game high scores with custom handles
- **16 AI tools** — translate, summarize, weather, currency, charts, and more
- **Speed test** — real bandwidth measurement against the Nexus backend
- **Maintenance hub** — live device diagnostics (CPU, RAM, network, battery, display)

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla JS, CSS variables, HTML5 Canvas |
| Backend | Cloudflare Worker (JavaScript), ~48 endpoints |
| Storage | Cloudflare KV (leaderboards, handles, bans) |
| AI providers | Groq, Google Gemini, Hugging Face, Replicate, Pollinations |
| Auth | Google OAuth + JWT session cookies |
| Hosting | Cloudflare Pages (frontend) + Cloudflare Workers (backend) |
| Domain | api.thyfwxit.com (same-site cookies, no 3rd-party blocking) |

## Built by

Xavier Scott (THYFWX) with Claude.

- Site: [thyfwxit.com](https://thyfwxit.com)
- Email: xavier@thyfwxit.com
- Tip jar: [buymeacoffee.com/thyfwx](https://buymeacoffee.com/thyfwx)

## Using this code

This repo is MIT licensed. Fork it, learn from it, lift patterns into your own
projects, use it as a starting point for something of your own.

Two things the license does not cover:

- **The names.** Do not reuse "Xavier Scott," "THYFWX," "thyfwxit," or "Nexus"
  as your own project's identity. Those refer to me and to this site.
- **The brand.** Strip my name, my domain, and my contact details before you
  deploy your version somewhere else.

The code is yours to learn from. The identity is not. If you build something
on top of this, send me a link. I want to see it.
