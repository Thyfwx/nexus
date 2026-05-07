"""Replicate image generation — paid endpoint with NSFW-capable models.

When REPLICATE_API_KEY is set in .env, the unfiltered image route prefers Replicate
over Pollinations/Horde because the explicit-anatomy quality is dramatically better.

Model selection (in priority order):
  1. REPLICATE_NSFW_MODEL env var if set (any Replicate model path, optionally version-pinned)
  2. aisha-ai-official/nsfw-flux-dev (default — FLUX-based, NSFW-trained, fast on short prompts)
  3. lucataco/realistic-vision-v5.1 (fallback if primary errors)

Model-path format:
  - "owner/name"                                            → uses /v1/models/{owner}/{name}/predictions (latest version)
  - "owner/name:abc123def..."                               → uses /v1/predictions with version field

Schema is auto-detected:
  - "flux" in model name → FLUX schema (no negative prompt, lower guidance, aspect_ratio)
  - everything else      → SD/SDXL schema (negative prompt, guidance 7-9, width/height)
"""
import base64
import os
import time
import requests as req_lib

from ._keys import get_key


# Default model — `black-forest-labs/flux-schnell`, the cheapest high-quality
# SFW model on Replicate (~$0.003/image). $15 = ~5,000 images. SFW-only.
# Owner can swap via `REPLICATE_SFW_MODEL` env var in DevPanel API editor.
# Other low-cost SFW alternatives:
#   - `bytedance/sdxl-lightning-4step`     ~$0.0007/img — fastest, lower quality
#   - `stability-ai/sdxl`                  ~$0.0017/img — official SDXL
#   - `lucataco/realistic-vision-v5.1`     ~$0.001/img — photoreal SD 1.5
DEFAULT_SFW_MODEL = "black-forest-labs/flux-schnell"
FALLBACK_MODEL    = "stability-ai/sdxl"

# Read these at CALL time (not import time) so DevPanel model swaps take effect
# immediately without a backend restart. Module-level os.getenv() only fires once
# when the file is first imported and cached forever.
def _current_primary_model() -> str:
    # Honor both the new env name and the legacy NSFW one (in case .env still has it)
    return (os.getenv("REPLICATE_SFW_MODEL", "").strip()
            or os.getenv("REPLICATE_NSFW_MODEL", "").strip()
            or DEFAULT_SFW_MODEL)

def _current_fallback_model() -> str:
    return FALLBACK_MODEL

# Kept for backwards-compat (anything that imported these names still gets a value)
REPLICATE_PRIMARY_MODEL  = DEFAULT_SFW_MODEL
REPLICATE_FALLBACK_MODEL = FALLBACK_MODEL
DEFAULT_NSFW_MODEL = DEFAULT_SFW_MODEL  # legacy alias, points to SFW now


def _is_flux_model(model: str) -> bool:
    return "flux" in model.lower()

def _is_pony_model(model: str) -> bool:
    """Pony Diffusion XL needs SDXL-style input + Pony-specific quality tags
    (`score_9, score_8_up, score_7_up, source_real, rating_explicit`) which act as
    quality gates. Without those tags Pony XL produces mediocre output."""
    m = model.lower()
    return "pony" in m


# FLUX-optimized prompts. FLUX uses natural language and gets confused by SD's
# parenthesis-weight syntax. Each prompt is ONE focused natural sentence with the
# anatomy spelled out cleanly, no keyword soup.
#
# The two flagship templates (FEMALE / MALE) are the ones Xavier validated as
# producing reliable photoreal explicit output on aisha-ai-official/nsfw-flux-dev.
# Treat them as canonical — short anatomy slang words map to one of them.

_FLUX_FEMALE_FULL_NUDE = (
    "photo-realistic close-up of a beautiful woman, completely nude, bare breast and "
    "straight spread pussy clearly visible, detailed skin, warm dim lighting, realistic"
)
_FLUX_MALE_FULL_NUDE = (
    "photo-realistic intimate close-up photograph of an adult man's erect penis, "
    "fully erect circumcised penis pointing forward at the camera, prominent veined "
    "shaft and visible glans head, scrotum and testicles visible below, anatomically "
    "detailed adult male genitalia, completely nude lower body, no clothing, no underwear, "
    "groin and pelvis crop only, no breasts, no female anatomy, no woman in frame, "
    "this is an adult human male erect penis photograph, realistic skin texture, "
    "warm dim lighting, raw 8k photograph, sharp focus, professional adult photography"
)

_FLUX_NSFW_REPLACEMENTS = {
    # Female anatomy slang → female full-nude template
    "titties":  _FLUX_FEMALE_FULL_NUDE,
    "tits":     _FLUX_FEMALE_FULL_NUDE,
    "boobs":    _FLUX_FEMALE_FULL_NUDE,
    "breasts":  _FLUX_FEMALE_FULL_NUDE,
    "nipples":  _FLUX_FEMALE_FULL_NUDE,
    "pussy":    _FLUX_FEMALE_FULL_NUDE,
    "vagina":   _FLUX_FEMALE_FULL_NUDE,
    "vulva":    _FLUX_FEMALE_FULL_NUDE,
    "snatch":   _FLUX_FEMALE_FULL_NUDE,
    "clit":     _FLUX_FEMALE_FULL_NUDE,
    "ass":      _FLUX_FEMALE_FULL_NUDE,
    "butt":     _FLUX_FEMALE_FULL_NUDE,
    # Male anatomy slang → male full-nude template
    "cock":     _FLUX_MALE_FULL_NUDE,
    "dick":     _FLUX_MALE_FULL_NUDE,
    "penis":    _FLUX_MALE_FULL_NUDE,
    "balls":    _FLUX_MALE_FULL_NUDE,
    # Generic nude — defaults to female (most common request)
    "nude":     _FLUX_FEMALE_FULL_NUDE,
    "naked":    _FLUX_FEMALE_FULL_NUDE,
    "nudes":    _FLUX_FEMALE_FULL_NUDE,
    # Explicit context
    "porn":     _FLUX_FEMALE_FULL_NUDE,
    "sex":      "photo-realistic explicit adult scene, two completely nude bodies intertwined, anatomically detailed, warm dim lighting, realistic",
}


_MALE_HINTS   = {"man", "men", "guy", "boy", "male", "dude"}
_FEMALE_HINTS = {"woman", "women", "girl", "lady", "female", "chick", "babe"}


def _flux_clean_prompt(prompt: str) -> str:
    """For FLUX models: convert short anatomy slang into a clean natural-language prompt.
    Strips any SD weight syntax. PRESERVES user detail for compound prompts — only
    template-replaces when the prompt is essentially a single word (3 words or less).
    """
    import re
    p = prompt.strip().lower()
    # Strip filler so "show me titties" → "titties"
    for filler in ("show me ", "give me ", "i want ", "i wanna see ", "let me see ",
                   "generate ", "make me ", "draw ", "a ", "an ", "some ", "the "):
        if p.startswith(filler):
            p = p[len(filler):]
    p = p.rstrip(" .,!?")
    word_count = len(p.split())

    # 1) Truly short single-word request → use the engineered template
    if word_count <= 1 and p in _FLUX_NSFW_REPLACEMENTS:
        return _FLUX_NSFW_REPLACEMENTS[p]

    # 2) Two-word "nude man / naked guy" / "nude woman" — gender-routed template
    words = set(p.split())
    if word_count <= 3 and (words & {"nude", "naked", "topless", "bare"}):
        if words & _MALE_HINTS:   return _FLUX_MALE_FULL_NUDE
        if words & _FEMALE_HINTS: return _FLUX_FEMALE_FULL_NUDE
        return _FLUX_FEMALE_FULL_NUDE

    # 3) Compound / detailed prompt — PRESERVE user's wording. Strip SD weight syntax,
    #    then wrap with HEAVY explicit framing so FLUX produces actual nudity instead of
    #    defaulting to "woman in lingerie". The aisha NSFW-flux-dev model needs aggressive
    #    explicit cues; soft prompts get soft (clothed) results.
    cleaned = re.sub(r"\([^)]*?:\d*\.?\d+\)", "", prompt)
    cleaned = re.sub(r"\(+([^()]+?)\)+", r"\1", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.")
    return (
        f"raw uncensored explicit NSFW photograph, fully nude, completely naked, "
        f"no clothing, no bra, no underwear, no panties, exposed bare anatomy visible, "
        f"{cleaned}, "
        f"anatomically perfect detailed nude human body, glistening skin, "
        f"intimate macro framing, warm dim bedroom lighting, 8k raw photo, "
        f"professional adult photography, sharp focus, no censorship, no clothing whatsoever"
    )


def _build_input(model: str, prompt: str, negative_prompt: str) -> dict:
    """Returns the right input schema for FLUX vs Pony XL vs SD-style models."""
    if _is_flux_model(model):
        # FLUX: clean natural-language prompt, no negative prompt, low guidance
        clean = _flux_clean_prompt(prompt)
        return {
            "prompt": clean,
            "aspect_ratio": "2:3",
            "num_inference_steps": 28,
            "guidance": 3.5,
            "output_format": "png",
            "output_quality": 90,
            "num_outputs": 1,
        }

    if _is_pony_model(model):
        # Pony Diffusion XL — SDXL base + Pony-specific quality gates. The "score_9"-style
        # tags act as quality multipliers: without them Pony returns generic output.
        # `source_real` biases toward photoreal (vs anime); `rating_explicit` unlocks NSFW.
        pony_prompt = (
            "score_9, score_8_up, score_7_up, source_real, rating_explicit, "
            "BREAK photorealistic photograph, raw NSFW photo, "
            + prompt
            + ", fully nude, completely naked, no clothing whatsoever, anatomically detailed, "
            "natural skin texture, intimate close-up, professional adult photography, 8k, sharp focus"
        )
        pony_neg = (
            "score_6, score_5, score_4, source_anime, source_cartoon, source_furry, "
            "(clothed:1.5), (dressed:1.5), (bra:1.4), (underwear:1.4), (lingerie:1.3), "
            "(swimsuit:1.4), (bikini:1.5), shirt, dress, jeans, "
            "censored, mosaic, blurred, deformed, bad anatomy, extra fingers, "
            "low quality, lowres, jpeg artifacts, watermark, signature, text, "
            "underage, child, minor, teenager"
        )
        return {
            "prompt": pony_prompt,
            "negative_prompt": pony_neg,
            "width": 832,                # Pony XL native: 832×1216 portrait
            "height": 1216,
            "num_inference_steps": 25,
            "guidance_scale": 7.0,       # Pony likes 6-8
        }

    # Generic SD-style models (Realistic Vision etc.): front-load explicit weights, use negative prompt
    sd_prompt = (
        "((EXPLICIT NUDE)), ((completely nude)), ((no clothing)), ((no bra)), ((no panties)), "
        "((bare skin)), NSFW, "
        + prompt
        + ", (anatomically perfect:1.3), (symmetric breasts:1.3), (perfect anatomy:1.3), "
        "(detailed labia majora and labia minora:1.3), (visible clitoris:1.2), "
        "(natural anatomy:1.2), (real human anatomy reference:1.2)"
    )
    sd_neg = (negative_prompt or "") + (
        ", (full body shot:1.5), (standing pose:1.5), (wide angle:1.4), "
        "(distance shot:1.4), (full figure:1.4), (whole body:1.4), "
        "(asymmetric breasts:1.5), (lopsided breasts:1.5), "
        "(smooth crotch:1.6), (no genitals:1.6), (missing labia:1.5), "
        "(blank crotch:1.5), (genital imprint only:1.4), (barbie doll anatomy:1.6), "
        "(deformed hands:1.4), (extra fingers:1.4)"
    )
    return {
        "prompt": sd_prompt,
        "negative_prompt": sd_neg,
        "width": 512,
        "height": 768,
        "num_inference_steps": 22,
        "guidance_scale": 8.5,
    }


def _replicate_call(model: str, prompt: str, negative_prompt: str = "", timeout: int = 90) -> dict:
    """Single Replicate prediction. Handles both `owner/name` and `owner/name:version` formats.
    Uses `Prefer: wait=60` header for synchronous response.
    """
    api_key = get_key("REPLICATE_API_KEY") or os.getenv("REPLICATE_API_KEY")
    if not api_key:
        raise RuntimeError("REPLICATE_API_KEY not set")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "wait=60",
    }
    input_payload = _build_input(model, prompt, negative_prompt)

    # Version-pinned format → use /v1/predictions with the version field
    if ":" in model:
        owner_name, version = model.split(":", 1)
        url = "https://api.replicate.com/v1/predictions"
        body = {"version": version, "input": input_payload}
        log_label = f"{owner_name} (v {version[:8]})"
    else:
        url = f"https://api.replicate.com/v1/models/{model}/predictions"
        body = {"input": input_payload}
        log_label = model

    print(f"[REPLICATE] {log_label} :: {prompt[:60]!r}")
    r = req_lib.post(url, headers=headers, json=body, timeout=timeout)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Replicate {r.status_code}: {r.text[:200]}")

    data = r.json()
    status = data.get("status")
    # If still processing, poll
    if status not in ("succeeded", "failed", "canceled"):
        get_url = (data.get("urls") or {}).get("get")
        if get_url:
            deadline = time.time() + 60
            while time.time() < deadline:
                time.sleep(2)
                pr = req_lib.get(get_url, headers={"Authorization": f"Bearer {api_key}"}, timeout=15)
                if pr.ok:
                    pdata = pr.json()
                    if pdata.get("status") in ("succeeded", "failed", "canceled"):
                        data = pdata
                        break

    if data.get("status") != "succeeded":
        err = data.get("error") or data.get("status") or "unknown"
        raise RuntimeError(f"Replicate prediction failed: {err}")

    output = data.get("output")
    img_url = output[0] if isinstance(output, list) and output else output
    if not img_url or not isinstance(img_url, str):
        raise RuntimeError("Replicate returned no image URL")

    ir = req_lib.get(img_url, timeout=30)
    if not ir.ok:
        raise RuntimeError(f"Replicate image fetch {ir.status_code}")
    short_name = (model.split(":")[0]).split("/")[-1]
    return {
        "image_b64": base64.b64encode(ir.content).decode("utf-8"),
        "source": f"replicate:{short_name}",
    }


def text_to_image_replicate(prompt: str, negative_prompt: str = "", model_override: str = None) -> dict:
    """Try the primary Replicate model first; fall back to the secondary one if it fails.
    Reads the primary model name at CALL time so DevPanel swaps work without restart.
    `model_override` lets the caller pick a specific model (used for male/female split)."""
    primary = model_override or _current_primary_model()
    fallback = _current_fallback_model()
    print(f"[REPLICATE] primary={primary} fallback={fallback}")
    try:
        return _replicate_call(primary, prompt, negative_prompt)
    except Exception as e:
        print(f"[REPLICATE] primary failed: {e} — trying fallback {fallback}")
        return _replicate_call(fallback, prompt, negative_prompt)
