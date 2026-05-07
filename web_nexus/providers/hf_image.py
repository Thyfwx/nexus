"""SFW image generation — Pollinations Flux primary, with Turbo / DreamShaper / HF SDXL fallbacks.

NSFW image gen was retired 2026-05-06 (Phase 1 cleanup). Unfiltered chat behavior
in the LLM is preserved separately — see registry.py / chat path."""
import requests as req_lib
import base64
import os
import time
import uuid
from ._keys import get_key


def _pollinations_once(prompt: str, model: str, safe: bool, timeout: int = 90,
                        width: int = 512, height: int = 768) -> dict:
    """Single Pollinations request with built-in 429-retry + backoff.
    Pollinations rate-limits to ~1 concurrent request per IP. When you fire fast,
    the 2nd request gets 429 with "request already queued max". Auto-retry with
    exponential backoff resolves this transparently most of the time."""
    seed = uuid.uuid4().int % 1000000
    # If POLLINATIONS_TOKEN is set in .env, append it — gives priority queue access
    # (no rate limits, faster gen). Free to register at auth.pollinations.ai.
    token_part = ""
    pollinations_token = os.getenv("POLLINATIONS_TOKEN", "").strip()
    if pollinations_token:
        token_part = f"&token={req_lib.utils.quote(pollinations_token)}"
    url = (
        f"https://image.pollinations.ai/prompt/{req_lib.utils.quote(prompt)}"
        f"?nologo=true&seed={seed}&model={model}"
        f"&width={width}&height={height}"
        f"{'' if safe else '&safe=false'}"
        f"{token_part}"
    )
    print(f"[POLLINATIONS] model={model} safe={safe} {width}x{height} :: {prompt[:60]!r}")
    # Tighter backoff: 0s, 4s, 10s. Total worst-case wait dropped from 26s → 14s.
    # POLLINATIONS_TOKEN bypasses rate limits entirely, so users with a token rarely
    # hit retry at all. Without a token, free queue is best-effort.
    delays = [0, 4, 10]
    last_status, last_body = None, ""
    retry_count = 0
    for attempt, delay in enumerate(delays):
        if delay > 0:
            time.sleep(delay)
            retry_count += 1
        resp = req_lib.get(url, timeout=timeout)
        last_status = resp.status_code
        if resp.status_code == 200:
            # Single-line summary instead of one log per retry — only mentions retries
            # if any actually fired, so successful first-attempt requests stay quiet.
            if retry_count:
                print(f"[POLLINATIONS] succeeded after {retry_count} retry(ies)")
            comfy_fail = os.environ.pop("_LAST_COMFYUI_FAIL", "")
            src = f"pollinations:{model}" + (f" (comfy failed: {comfy_fail})" if comfy_fail else "")
            return {"image_b64": base64.b64encode(resp.content).decode("utf-8"), "source": src}
        last_body = (resp.text or "")[:200].replace("\n", " ")
        # Only retry on 429. For other 4xx/5xx, fail fast.
        if resp.status_code != 429:
            break
    # Single failure line at the end — replaces the per-attempt "rate-limited, waiting Xs" spam.
    print(f"[POLLINATIONS] FAILED after {retry_count + 1} attempt(s) :: HTTP {last_status}")
    raise RuntimeError(f"Pollinations {last_status} :: {last_body}")




def _pollinations(prompt: str, model: str = "flux", safe: bool = True) -> dict:
    """Pollinations SFW with model-rotation fallback on 429 / timeout / 5xx.
    Chain: <requested model> → turbo → dreamshaper → flux. The `safe` parameter
    is kept for signature compat with older callers but is always forced True
    (NSFW image gen retired 2026-05-06).
    """
    chain = [model] + [m for m in ("turbo", "dreamshaper", "flux") if m != model]
    last_err = None
    for i, m in enumerate(chain):
        try:
            return _pollinations_once(prompt, m, True, timeout=60 if i == 0 else 90)
        except Exception as e:
            last_err = e
            msg = str(e).lower()
            print(f"[POLLINATIONS] {m} failed: {e}")
            if "429" in msg or "timed out" in msg or "timeout" in msg or "503" in msg:
                time.sleep(1.5)
                continue
            continue
    raise RuntimeError(f"All Pollinations models failed (last: {last_err})")


def text_to_image(prompt: str, model_id: str = "black-forest-labs/FLUX.1-schnell", mode: str = "nexus", is_google: bool = False, force_free: bool = False, origin_explicit: bool = None) -> dict:
    """Generate an image. Returns {"image_b64": str, "source": ...}.

    SFW-ONLY routing as of 2026-05-06. Routing tiers:
      1. GUESTS  → BLOCKED. Image gen requires a Google account.
      2. GOOGLE-SIGNED USERS  → Replicate Flux-schnell (paid SFW, ~$0.003/img · best quality)
      3. Replicate fails or no key  → Pollinations Flux (free SFW, decent quality)
      4. Pollinations fails  → Pollinations Turbo (free SFW, lower quality)
      5. Pollinations down entirely  → HF SDXL backup (only if HF_BACKUP_ENABLED=1)

    `force_free` (set on localhost requests unless FORCE_PAID_LOCAL=1) skips the
    paid Replicate tier so dev work doesn't burn budget.
    """
    print(f"[IMAGE GEN] mode={mode} is_google={is_google} force_free={force_free} prompt={prompt[:80]!r}")
    errs = []

    # GUEST GATE: image gen requires a Google account.
    if not is_google:
        raise RuntimeError("Image generation requires a Google account. Sign in to use it — guest mode does not include image gen.")

    # PRIMARY: Replicate Flux-schnell (paid SFW, $0.003/img, best quality).
    # Skipped if no API key, force_free is on (localhost dev), or REPLICATE_DISABLE=1.
    replicate_disabled = os.getenv("REPLICATE_DISABLE", "").strip() in {"1", "true", "yes"}
    if not replicate_disabled and not force_free and (get_key("REPLICATE_API_KEY") or os.getenv("REPLICATE_API_KEY")):
        try:
            from .replicate_image import text_to_image_replicate
            print(f"[ROUTING] Google user → Replicate (paid SFW)")
            return text_to_image_replicate(prompt, negative_prompt="nsfw, nudity, explicit content, low quality, blurry, watermark, signature")
        except Exception as e:
            errs.append(f"replicate: {e}")
            print(f"[REPLICATE FAIL] {str(e)[:140]} — falling to Pollinations")

    # FALLBACK 1: Pollinations Flux SFW (free, decent quality).
    free_override = os.getenv("POLLINATIONS_FREE_MODEL", "").strip()
    primary_free = free_override or "flux"
    try:
        return _pollinations(prompt, model=primary_free, safe=True)
    except Exception as e:
        errs.append(f"pollinations-{primary_free}: {e}")
        print(f"[POLLINATIONS PRIMARY FAIL] {e} — trying Turbo")

    # FALLBACK 2: Pollinations Turbo (smaller/faster).
    try:
        return _pollinations(prompt, model="turbo", safe=True)
    except Exception as e:
        errs.append(f"pollinations-turbo: {e}")
        print(f"[POLLINATIONS TURBO FAIL] {e} — trying HF SDXL backup")

    # HF FLUX kept ONLY as deep backup if Pollinations is fully down. Disabled by default.
    hf_key = get_key("HF_API_KEY") if os.getenv("HF_BACKUP_ENABLED", "0") == "1" else None
    if hf_key:
        try:
            print(f"[HF-IMAGE] {model_id} :: {prompt!r}")
            url = f"https://router.huggingface.co/hf-inference/models/{model_id}"
            resp = req_lib.post(
                url,
                headers={"Authorization": f"Bearer {hf_key}"},
                json={"inputs": prompt},
                timeout=60,
            )
            if resp.status_code == 200:
                return {"image_b64": base64.b64encode(resp.content).decode("utf-8"), "source": "hf"}
            print(f"[HF-IMAGE] {resp.status_code} {resp.text[:120]}")
        except Exception as e:
            print(f"[HF-IMAGE FAIL] {e}")

    try:
        return _pollinations(prompt, safe=True)
    except Exception as e:
        print(f"[POLLINATIONS FAIL] {e}")

    raise RuntimeError("All image-gen providers offline")


