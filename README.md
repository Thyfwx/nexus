# Nexus

Nexus is an AI terminal that runs in your browser, with four chat modes, browser games, image generation and per game leaderboards.

Live at [thyfwxit.com/nexus](https://thyfwxit.com/nexus).

## What you can do

- Chat in one of four modes: Nexus (general), Coder (programming), Education (learning) and Unfiltered (18+). Each mode keeps its own chat history.
- Play eight games from the terminal with `play <game>`: Wordle, Snake, Pong, Invaders, Flappy, Breakout, Minesweeper (`mines`) and Mancala.
- Ask for an image in plain words, like "draw a cyberpunk city", or use "image of: ...".
- Check your scores on the leaderboard page.
- Run a speed test and a typing test from their own pages, and view device diagnostics from the maintenance hub.
- Export a conversation as Markdown with `export`, or wipe it with `forget`.

Type `help` in the terminal for the full command list. You can sign in with Google or continue as a guest.

## How it's built

The frontend is plain HTML, CSS and JavaScript with no build step. It lives in `web_nexus/static/` and is served by Cloudflare Pages (see `wrangler.toml`).

The backend is a single Cloudflare Worker in `worker/src/index.js`. It serves `api.thyfwxit.com`, keeps leaderboards, handles and bans in Cloudflare KV, and calls Groq, Google Gemini, Hugging Face, Replicate and Pollinations. A GitHub Actions workflow deploys the Worker on every push to `main`.

## Running your own copy

1. Run `npm install` to get `wrangler` and TypeScript.
2. Create your own KV namespace and put its id in `worker/wrangler.toml`.
3. Add your own provider keys and Google sign in settings to the Worker as secrets. The names it reads are in `worker/src/index.js`.
4. Change the route and domain in `worker/wrangler.toml` to your own.

These steps haven't been tested as a clean setup, and the repo has no automated tests.

## Limits

- The Worker needs a Cloudflare account and your own API keys for each AI provider. Without them, chat and image generation won't work.
- The code points at my domain and my KV namespace. Don't deploy it as is.

## License

MIT, see [LICENSE](LICENSE). The license covers the code. Please don't reuse the Nexus or thyfwxit names or my contact details as the identity of your own project. Security reports go through [SECURITY.md](SECURITY.md).

Site: [thyfwxit.com](https://thyfwxit.com)
