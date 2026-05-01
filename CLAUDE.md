# CLAUDE.md — Nexus AI Terminal repo

This is the source-of-truth repo for the Nexus terminal that deploys to `https://thyfwxit.com/nexus/`.
The mirror at `~/Documents/Domain_Project/thyfwxit/nexus/` is synced from here by `sync.sh`.

## SECURITY MANDATE — CRITICAL
- **NEVER USE `git add .` or commit blindly.** A previous AI leaked a Cloudflare API Token, Discord Webhook, and Google Client Secrets via a blanket `git add`.
- **ALWAYS** review `git status` and `git diff` before committing.
- **NEVER** commit `.env`, `.env.cloudflare`, `secrets.js`, `.claude/`, `.gemini/`, or any file with tokens. All are in `.gitignore` — keep them there.

## Sandbox vs Main workflow

| Folder you see | Branch | Purpose |
|---|---|---|
| `~/Documents/Domain_Project/Nexus/` | `main` | Production. Locked. |
| `~/Documents/Domain_Project/Nexus-sandbox/` | `sandbox` | Where Claude edits. Reviewed before merge. |

Both folders share the same `.git` storage (git worktrees). Edits in `Nexus-sandbox/` go on `sandbox` automatically.

Workflow: edit in `Nexus-sandbox/` → review with `cd Nexus && git diff main..sandbox` → on approval, `git merge sandbox && git push origin main` → run `sync.sh` from `Domain_Project/` to deploy.

## Project layout

```
Nexus/                              ← repo root
├── nexus.py                        ← Spotify/Music macOS bridge (osascript bridge)
├── package-lock.json
└── web_nexus/
    ├── main.py                     ← Python backend (FastAPI/Flask) — reads .env for API keys
    ├── .env                        ← AI API keys — NEVER commit
    └── static/                     ← Frontend served at /nexus/
        ├── login.html              ← LOBBY (v5.2.6 LOCKED)
        ├── index.html              ← Terminal page (v5.2.6 LOCKED)
        ├── style.css               ← Visual styling (v5.2.6 LOCKED)
        ├── auth_core.js            ← Google OAuth + guest auth (v5.2.6 LOCKED)
        ├── nexus_globals.js        ← All window.* globals
        ├── nexus_brain.js          ← Boot orchestration
        ├── config_core.js          ← Models, mode prompts, MODES
        ├── modules/
        │   ├── speedtest_logic.js
        │   └── hardware_logic.js
        ├── uplink_core.js          ← Session telemetry
        ├── stats_core.js           ← CPU/MEM canvas monitor
        ├── audio_core.js           ← SoundManager (Web Audio API)
        ├── games_core.js           ← All 8 terminal games
        ├── ai_core.js              ← AI chat, image gen
        ├── commands_core.js        ← Command router
        ├── terminal.js             ← Boot, WebSocket, input — loads LAST
        └── secrets.js              ← Front-end secrets — NEVER commit
```

## LOBBY PROTECTION — v5.2.6 LOCKED

These four files are PERMANENTLY LOCKED:
- `web_nexus/static/login.html`
- `web_nexus/static/index.html`
- `web_nexus/static/style.css`
- `web_nexus/static/auth_core.js`

Do NOT edit, polish, or refactor unless explicitly told **"Modify the Lobby."**
Recovery point: `~/Documents/Domain_Project/docs/snapshots/lobby_v5.2.6/`.

## File ownership map — who owns what

### Layer 1 — Foundation (touch only when adding a new global / mode)
| File | Owns |
|------|------|
| `nexus_globals.js` | All `window.*` variables, URLs, WebSocket endpoints |
| `config_core.js` | AI models list, mode prompts, boot words, `MODES` object |
| `nexus_brain.js` | Startup orchestration, backend config sync |

### Layer 2 — Pages & Identity (LOBBY LOCKED — see above)

### Layer 3 — Terminal core
| File | Owns | Don't touch |
|---|---|---|
| `terminal.js` | Boot sequence, WebSocket, input listeners, history nav, `printToTerminal()`, `printTypewriter()` | Boot logic — break boot = nothing loads |
| `commands_core.js` | `handleCommand()` dispatcher | Don't add game logic — route only |

### Layer 4 — Features (one feature per file)
| File | Owns | Don't touch |
|---|---|---|
| `ai_core.js` | AI chat (`prompt_ai_proxy`), image gen, AI triggers | Don't add command routing |
| `games_core.js` | 8 games (Wordle, Snake, Pong, Flappy, Breakout, Invaders, Minesweeper, Breach Protocol) + Matrix saver, Typing test, `stopAllGames()` | Don't split without explicit order |
| `stats_core.js` | CPU/MEM monitor, `updateClientStats()`, `startMonitor()` | No WebSocket logic here |
| `audio_core.js` | `SoundManager` (Web Audio API) | Don't rename SoundManager |
| `uplink_core.js` | Session telemetry, geolocation, stealth mode | No AI logic here |

### Layer 5 — Modules
| File | Owns |
|---|---|
| `modules/speedtest_logic.js` | Speed test UI, calls WS speedtest command |
| `modules/hardware_logic.js` | Maintenance hub, calls `/api/diagnostics` |

### Files kept but NOT loaded — do not edit, do not load
`terminal_reconstruction.js`, `intel_core.js`, `diag_core.js`, `diagnostic_core.js`, `sound_core.js`, `playground_core.js`, `thyfwxit_status.js` (belongs to thyfwxit portfolio, not Nexus).

## Script load order — DO NOT CHANGE

```html
<script src="nexus_globals.js?v=5.3.0"></script>
<script src="nexus_brain.js?v=5.3.0"></script>
<script src="config_core.js?v=5.3.0"></script>
<script src="modules/speedtest_logic.js?v=5.3.0"></script>
<script src="modules/hardware_logic.js?v=5.3.0"></script>
<script src="uplink_core.js?v=5.3.0"></script>
<script src="stats_core.js?v=5.3.0"></script>
<script src="audio_core.js?v=5.3.0"></script>
<script src="games_core.js?v=5.3.0"></script>
<script src="auth_core.js?v=5.3.0"></script>
<script src="ai_core.js?v=5.3.0"></script>
<script src="commands_core.js?v=5.3.0"></script>
<script src="terminal.js?v=5.3.0"></script>
```

When adding a new module → place it BEFORE `commands_core.js`.
When editing any file → bump the `?v=` cache buster.

## Dependency law — trace before editing

- `terminal.js` depends on: `nexus_globals.js`, `config_core.js`, `auth_core.js`
- `commands_core.js` depends on: `ai_core.js` (`prompt_ai_proxy`), `games_core.js` (`startWordle` etc), `terminal.js` (`printToTerminal`)
- `games_core.js` depends on: `nexus_globals.js` (`window.guiContainer`, `window.output`), `terminal.js` (`printToTerminal`)
- `ai_core.js` depends on: `nexus_globals.js` (`window.API_BASE`, `window.currentMode`, `window.termWs`), `terminal.js` (`printTypewriter`, `printToTerminal`)

Adding a function to the wrong file (game logic in `terminal.js`, AI logic in `commands_core.js`) breaks the architecture.

## Known incidents — do not repeat

### games_core.js (commit 545d3f4)
Gemini prepended orphaned closing braces (`});`, `}, 400);`) to line 1 while adding Breach Protocol. Caused a SyntaxError on line 1 → entire terminal crashed. **Rule:** add new games as complete self-contained functions. Never prepend partial fragments.

### Script tag mismatch
Gemini left `index.html` loading only 2 scripts at v4.0.77 while the source had 13 modules at v5.3.0. **Rule:** when editing `web_nexus/static/index.html`, run `sync.sh` (after review) so the thyfwxit mirror at `~/Documents/Domain_Project/thyfwxit/nexus/index.html` matches exactly.

## Visual / UI rules
- Font: **'Fira Code'** monospace ONLY, locked via `!important`. Never override.
- Profile Card: Always Compact (32px), side-by-side buttons.
- Mode accent colors live in `nexus_globals.js` → `window.MODE_COLORS`. Don't invent new ones.
- Dark Mode enforced. Subtle glassmorphism. Micro-animations.

## Verification protocol
- Edited a `_core.js` file → grep new function/variable names across other `_core.js` files to confirm no global collision.
- Edited `index.html` → verify load order still matches the table above.
- Edited `terminal.js` → run `node --check terminal.js` before claiming done.
- Edited `auth_core.js` or `uplink_core.js` → flag for security review.
- Never say "this should work." Say "I verified X by Y" or "I cannot verify Z — please test."

## Deployment

```bash
# Run from ~/Documents/Domain_Project/ — NEVER blindly:
./sync.sh
```

`sync.sh` validates `terminal.js` syntax → pushes Nexus → deploys to Cloudflare Pages → mirrors static files into the thyfwxit repo → pushes thyfwxit → deploys thyfwxit.com. Always wait for explicit approval before running. If a deploy fails, revert to the previous commit immediately.

Manual Nexus-only deploy:
```bash
cd ~/Documents/Domain_Project/Nexus
npx wrangler pages deploy web_nexus/static --project-name nexus-terminal
```
