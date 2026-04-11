# SECURITY MANDATE - CRITICAL
- **NEVER USE `git add .` or commit blindly.** A previous AI completely leaked a Cloudflare API Token, Discord Webhook, and Google Client Secrets because it did a blanket `git add` and pushed.
- **ALWAYS** check `git status` and specifically review `git diff` before committing any files.
- **NEVER** commit `.env`, `secrets.js`, `.claude/`, or ANY file that could potentially contain secrets or API keys.
