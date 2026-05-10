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
| Frontend | Vanilla JS, CSS variables, WebSocket, HTML5 Canvas |
| Backend | Python + FastAPI on Render |
| AI providers | Groq, Google Gemini, Hugging Face, Replicate, Pollinations |
| Auth | Google OAuth + JWT session cookies |
| Hosting | Cloudflare Pages (frontend), Render (backend) |
| Domain | api.thyfwxit.com (same-site cookies, no 3rd-party blocking) |

## Built by

Xavier Scott (THYFWX) with Claude.

- Site: [thyfwxit.com](https://thyfwxit.com)
- Email: xavier@thyfwxit.com
- Tip jar: [buymeacoffee.com/thyfwx](https://buymeacoffee.com/thyfwx)
