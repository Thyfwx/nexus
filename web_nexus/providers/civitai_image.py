"""Civitai image generation — primary tier when API key is set.

Civitai's hosted generator runs on Pony Diffusion XL and other NSFW-tuned SDXL models
that handle compound explicit scenes far better than FLUX-dev. Free tier gives every
user ~25 "buzz" per day = roughly 5-8 generations/day for free.

Setup steps for Xavier:
  1. Sign up / log in at https://civitai.com
  2. Go to https://civitai.com/user/account → API Keys → "Add API key"
  3. Copy the generated key (starts with characters, looks like a long token)
  4. Paste into .env as: CIVITAI_API_KEY="paste_token_here"
  5. Restart Nexus backend
  6. Routing automatically activates: Civitai is tried first; on quota exhaustion or
     error, falls back to Replicate FLUX-dev (your $15 budget). Free chain remains
     as the final fallback for guests / non-explicit prompts.

Cost reality:
  - Civitai is FREE for ~5-8 images/day per signed-in Civitai-account user (their tier).
    BUT this is YOUR Civitai account being charged in buzz, not per-user.
    So if 10 of YOUR users hit it in a day, your daily 25 buzz gets eaten in minutes.
  - When YOUR daily buzz runs out, Civitai returns insufficient-buzz error → we fall
    back to Replicate aisha-flux-dev ($0.025/img from your $15 budget).
  - Net effect: first ~5-8 explicit images each day are free; rest hit Replicate.

Model URNs (Civitai's identifier format) for popular NSFW SDXL models:
  - Pony Diffusion V6 XL:   urn:air:sdxl:checkpoint:civitai:257749@290640
  - Realistic Vision V6.0:  urn:air:sd1:checkpoint:civitai:4201@245598
  - epiCRealism XL:         urn:air:sdxl:checkpoint:civitai:277058@312014
Set CIVITAI_MODEL_URN env var to override the default; Pony XL is best for compound NSFW.
"""
import base64
import os
import time
import requests as req_lib

from ._keys import get_key


# Civitai's generation API has been in beta and the endpoint has moved.
# We try multiple known endpoints in order — first one that returns 200/201/202 wins.
CIVITAI_ENDPOINTS = [
    "https://orchestration.civitai.com/v2/consumer/jobs",   # legacy (returned 404 for many users)
    "https://orchestration.civitai.com/v1/consumer/jobs",   # v1 fallback
    "https://api.civitai.com/v1/generation/create",          # newer API path
]
CIVITAI_BASE = CIVITAI_ENDPOINTS[0]   # back-compat default for direct calls

# DEFAULT MODEL — Pony Diffusion V6 XL.
# Override via CIVITAI_MODEL_URN env var with any of these (all NSFW-capable on Civitai):
#
#   urn:air:sdxl:checkpoint:civitai:257749@290640  →  Pony Diffusion V6 XL  (default; great compound NSFW)
#   urn:air:sdxl:checkpoint:civitai:288584@324619  →  Realistic Vision V6.0 XL  (photoreal, less explicit)
#   urn:air:sdxl:checkpoint:civitai:139562@344487  →  RealVisXL V4.0  (cinematic photoreal)
#   urn:air:sdxl:checkpoint:civitai:101055@128078  →  SDXL 1.0 base  (vanilla, mild NSFW)
#   urn:air:sdxl:checkpoint:civitai:541798@749158  →  Pony Realism v22  (photoreal pony, BEST compound NSFW)
#   urn:air:sdxl:checkpoint:civitai:277058@312014  →  epiCRealism XL Pure Evolution  (photoreal NSFW)
#   urn:air:sdxl:checkpoint:civitai:1188071@1340064 → Lustify SDXL  (explicit-trained photoreal, popular)
#
# To find more URNs:
#   1. Go to civitai.com/models → pick an NSFW SDXL checkpoint
#   2. On the model page, click the "API" or "..." menu → "Generate URN"
#   3. Or use the format urn:air:sdxl:checkpoint:civitai:<MODEL_ID>@<VERSION_ID>
#      where MODEL_ID is in the model URL and VERSION_ID is in the version dropdown
DEFAULT_MODEL_URN = "urn:air:sdxl:checkpoint:civitai:257749@290640"  # Pony Diffusion V6 XL


# Single-word anatomy slang → explicit Pony XL prompt with body part spelled out.
# Pony defaults to "breasts" for any vague NSFW request because that's most of its training
# data. Spelling out the specific anatomy forces it to render what was actually asked for.
_ANATOMY_EXPANSIONS = {
    # Grok's aggressive Pony-tag-heavy prompt — uses Pony's known steering tags
    # (pussy_focus, presenting_pussy, lower_body_only, cropped_below_navel) plus
    # in-positive exclusions (no upper body, no torso, no breasts) which Pony
    # often respects better than negative-prompt exclusions.
    "pussy":   "1girl, solo, completely naked woman, lower_body_only, cropped_below_navel, pussy_focus, presenting_pussy, spread_pussy, legs_spread_wide, knees_up, explicit close-up view, detailed pussy, anatomically_correct_pussy, visible clit, detailed labia minora, detailed labia majora, pink wet vagina, glistening arousal, pussy juice, dripping wet, macro genital focus, intimate macro framing, fully exposed vulva, no upper body, no torso, no breasts, no chest, no face, no head, extreme close-up on genitalia, anatomically detailed female genitalia, natural skin texture, realistic pubic mound, detailed skin pores",
    "vagina":  "1girl, solo, completely naked woman, lower_body_only, cropped_below_navel, pussy_focus, presenting_pussy, spread_pussy, legs_spread_wide, knees_up, explicit close-up view, detailed pussy, anatomically_correct_pussy, visible clit, detailed labia minora, detailed labia majora, pink wet vagina, glistening arousal, pussy juice, dripping wet, macro genital focus, intimate macro framing, fully exposed vulva, no upper body, no torso, no breasts, no chest, no face, no head, extreme close-up on genitalia, anatomically detailed female genitalia, natural skin texture, realistic pubic mound, detailed skin pores",
    "vulva":   "1girl, solo, completely naked woman, lower_body_only, cropped_below_navel, pussy_focus, presenting_pussy, spread_pussy, legs_spread_wide, knees_up, explicit close-up view, detailed vulva, anatomically_correct_pussy, visible clit, detailed labia minora, detailed labia majora, pink wet vagina, glistening arousal, macro genital focus, intimate macro framing, fully exposed vulva, no upper body, no torso, no breasts, no chest, no face, no head, extreme close-up on genitalia",
    "snatch":  "1girl, solo, completely naked woman, lower_body_only, cropped_below_navel, pussy_focus, presenting_pussy, spread_pussy, legs_spread_wide, knees_up, explicit close-up view, detailed pussy, anatomically_correct_pussy, visible clit, detailed labia minora, detailed labia majora, pink wet vagina, glistening arousal, pussy juice, dripping wet, macro genital focus, intimate macro framing, fully exposed vulva, no upper body, no torso, no breasts, no chest, no face, no head",
    "clit":    "extreme macro close-up of a bare exposed clitoris and surrounding labia, anatomically detailed adult female genitalia, fully nude, intimate framing",
    "titties": "intimate close-up of massive bare exposed natural breasts, hard erect nipples and pink areolae fully visible, completely topless adult woman, no bra, glistening skin texture, chest crop only, no face",
    "tits":    "intimate close-up of massive bare exposed natural breasts, hard erect nipples and pink areolae fully visible, completely topless adult woman, no bra, glistening skin texture, chest crop only, no face",
    "boobs":   "intimate close-up of massive bare exposed natural breasts, hard erect nipples and pink areolae fully visible, completely topless adult woman, no bra, glistening skin texture, chest crop only, no face",
    "breasts": "intimate close-up of bare exposed natural breasts, hard erect nipples and pink areolae visible, completely topless adult woman, no bra",
    "nipples": "extreme macro close-up of bare exposed nipples and pink areolae, no clothing, no fabric covering, intimate framing",
    "ass":     "intimate close-up shot of bare exposed adult buttocks viewed from behind, fully nude lower body, no underwear, rear crop only, anatomically detailed",
    "butt":    "intimate close-up shot of bare exposed adult buttocks viewed from behind, fully nude lower body, no underwear, rear crop only, anatomically detailed",
    # Male anatomy — Pony XL needs aggressive male-anatomy tags + explicit "no female anatomy"
    # in positive because Pony's training data is heavily female-biased.
    "cock":    "1boy, solo, completely naked man, lower_body_only, cropped_below_navel, penis_focus, presenting_penis, erect_penis, penis, large_penis, veined_penis, glans, visible_glans_head, foreskin, scrotum, testicles, balls, anatomically_correct_penis, fully nude lower body, no breasts, no vagina, no pussy, no female anatomy, no upper body, no torso, no face, no head, extreme close-up on male genitalia, anatomically detailed male genitals, intimate macro framing, this is a human male penis",
    "dick":    "1boy, solo, completely naked man, lower_body_only, cropped_below_navel, penis_focus, presenting_penis, erect_penis, penis, large_penis, veined_penis, glans, visible_glans_head, foreskin, scrotum, testicles, balls, anatomically_correct_penis, fully nude lower body, no breasts, no vagina, no pussy, no female anatomy, no upper body, no torso, no face, no head, extreme close-up on male genitalia, anatomically detailed male genitals, intimate macro framing, this is a human male penis",
    "penis":   "1boy, solo, completely naked man, lower_body_only, cropped_below_navel, penis_focus, presenting_penis, erect_penis, penis, large_penis, veined_penis, glans, visible_glans_head, scrotum, testicles, anatomically_correct_penis, fully nude lower body, no breasts, no vagina, no female anatomy, no upper body, no torso, no face, intimate macro framing",
    "balls":   "1boy, solo, completely naked man, scrotum_focus, testicles, balls, anatomically_correct, fully nude lower body, no breasts, no female anatomy, no upper body, no torso, no face, intimate macro framing",
    "nude":    "fully nude adult woman, completely naked head to toe, exposed bare breasts and visible vulva with labia, no clothing whatsoever, anatomically detailed",
    "naked":   "fully nude adult woman, completely naked head to toe, exposed bare breasts and visible vulva with labia, no clothing whatsoever, anatomically detailed",
}


def _expand_short_prompt(prompt: str) -> str:
    """If the user gave a short single-word slang request, replace it with an
    anatomy-specific natural-language expansion. Long prompts pass through unchanged."""
    p = prompt.strip().lower()
    for filler in ("show me ", "give me ", "i want ", "i wanna see ", "let me see ",
                   "generate ", "make me ", "draw ", "a ", "an ", "some ", "the "):
        if p.startswith(filler):
            p = p[len(filler):]
    p = p.rstrip(" .,!?")
    if p in _ANATOMY_EXPANSIONS:
        return _ANATOMY_EXPANSIONS[p]
    return prompt


def text_to_image_civitai(prompt: str, negative_prompt: str = "", timeout: int = 120) -> dict:
    """Submit a job to Civitai, poll until done, return the rendered image as base64.
    Raises RuntimeError on missing API key, quota exhaustion, or timeout — the caller
    in hf_image.py catches and falls back to Replicate.
    """
    api_key = get_key("CIVITAI_API_KEY") or os.getenv("CIVITAI_API_KEY")
    if not api_key:
        raise RuntimeError("CIVITAI_API_KEY not set")

    model_urn = os.getenv("CIVITAI_MODEL_URN") or DEFAULT_MODEL_URN

    # Expand single-word slang ("pussy", "tits") into anatomy-specific natural language
    # BEFORE building the Pony prompt — otherwise Pony defaults to whatever's most common
    # in its training data (usually breasts) regardless of what the user actually asked for.
    expanded = _expand_short_prompt(prompt)
    print(f"[CIVITAI EXPAND] {prompt!r} → {expanded[:120]!r}…")

    # Pony XL needs its quality-gate tags or output is mediocre. Front-load them.
    pony_prompt = (
        "score_9, score_8_up, score_7_up, source_real, rating_explicit, "
        "BREAK photorealistic photograph, raw NSFW photo, "
        + expanded
        + ", fully nude, completely naked, no clothing, anatomically detailed, "
        "natural skin texture, professional adult photography, 8k"
    )
    # Pick negative prompt based on what was requested. If user asked for MALE anatomy,
    # suppress female anatomy in negative (and vice versa). Pony's training is heavily
    # female-biased so even with male prompts it'll render female unless we punish it.
    is_male_request = any(w in prompt.lower() for w in ["cock", "dick", "penis", "balls", "scrotum", "1boy", "naked man"])

    if is_male_request:
        # Male anatomy requested — heavily punish FEMALE anatomy in negative
        pony_neg = (
            "score_6, score_5, score_4, source_anime, source_cartoon, source_furry, source_3d, "
            "(1girl:1.8), (woman:1.7), (female:1.7), (breasts:1.8), (nipples:1.75), "
            "(pussy:1.7), (vagina:1.7), (vulva:1.7), (labia:1.6), "
            "(cleavage:1.6), (chest:1.5), (long hair:1.4), "
            "(face:1.6), (head:1.5), (long shot:1.5), (wide shot:1.5), (full body:1.5), "
            "clothed, dressed, underwear, briefs, boxers, pants, shirt, "
            "(blurry:1.4), deformed, bad anatomy, extra limbs, mutated hands, "
            "low quality, lowres, jpeg artifacts, watermark, signature, text, "
            "censored, mosaic, bar censor, "
            "underage, child, minor, teenager, loli, shota"
        )
    else:
        # Female anatomy requested (or generic) — heavy weights on breasts/torso/face
        # so Pony has nowhere to default to when asked for vulva.
        pony_neg = (
            "score_6, score_5, score_4, source_anime, source_cartoon, source_furry, source_3d, "
            "(breasts:1.8), (nipples:1.75), (big breasts:1.7), (medium breasts:1.6), "
            "(cleavage:1.6), (chest:1.7), (torso:1.7), (upper body:1.65), (full body:1.6), "
            "(face:1.7), (head:1.6), (eyes:1.5), (mouth:1.5), "
            "(long shot:1.5), (wide shot:1.5), "
            "(1boy:1.6), (man:1.5), (male:1.5), (penis:1.4), "
            "clothed, dressed, bra, underwear, lingerie, bikini, swimsuit, shirt, pants, "
            "(blurry:1.4), deformed, bad anatomy, extra limbs, mutated hands, "
            "low quality, lowres, jpeg artifacts, watermark, signature, text, "
            "censored, mosaic, bar censor, "
            "underage, child, minor, teenager, loli, shota"
        )
    if negative_prompt:
        pony_neg = pony_neg + ", " + negative_prompt

    body = {
        "$type": "textToImage",
        "model": model_urn,
        "params": {
            "prompt": pony_prompt,
            "negativePrompt": pony_neg,
            "scheduler": "EulerA",
            "steps": 25,
            "cfgScale": 7,
            "width": 832,
            "height": 1216,
            "clipSkip": 2,
            "seed": -1,    # random
        },
        "quantity": 1,
        "priority": "low",  # use cheaper queue
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # Try each known endpoint until one accepts the request. Civitai's API has moved
    # multiple times during beta. First one that returns 200/201/202 is the live URL.
    print(f"[CIVITAI] submitting job · model={model_urn} :: {prompt[:60]!r}")
    r = None
    last_status = None
    last_body = ""
    for endpoint in CIVITAI_ENDPOINTS:
        try:
            r = req_lib.post(endpoint, json=body, headers=headers, timeout=20)
            last_status = r.status_code
            last_body = r.text[:300]
            print(f"[CIVITAI] {endpoint} → HTTP {r.status_code}")
            if r.status_code in (200, 201, 202):
                break
            if r.status_code == 402 or "buzz" in r.text.lower():
                raise RuntimeError("Civitai daily buzz exhausted — falling back to Replicate")
        except Exception as e:
            if "buzz" in str(e).lower():
                raise
            print(f"[CIVITAI] {endpoint} → exception: {e}")
            continue
    if not r or r.status_code not in (200, 201, 202):
        raise RuntimeError(
            f"Civitai submit failed {last_status} on all known endpoints. "
            f"Likely cause: your Civitai account doesn't have generation API access enabled, "
            f"OR Civitai changed their API URL again. Body snippet: {last_body!r}"
        )

    job = r.json()
    job_id = (job.get("jobs") or [{}])[0].get("jobId") or job.get("token")
    if not job_id:
        raise RuntimeError(f"Civitai returned no job ID: {str(job)[:200]}")

    # Poll for completion
    poll_url = f"{CIVITAI_BASE}/{job_id}"
    deadline = time.time() + timeout
    img_url = None
    while time.time() < deadline:
        time.sleep(3)
        pr = req_lib.get(poll_url, headers=headers, timeout=15)
        if not pr.ok:
            continue
        pdata = pr.json()
        # Output structure varies; try common paths
        jobs = pdata.get("jobs") or []
        if jobs:
            j = jobs[0]
            if j.get("result", {}).get("blobUrl"):
                img_url = j["result"]["blobUrl"]
                break
            if j.get("status") in ("Succeeded", "succeeded") and j.get("result"):
                img_url = j["result"].get("blobUrl") or (j["result"].get("blobUrlMap") or {}).get("0")
                if img_url: break
            if j.get("status") in ("Failed", "failed", "Canceled", "canceled"):
                raise RuntimeError(f"Civitai job failed: {j.get('error') or 'unknown'}")

    if not img_url:
        raise RuntimeError("Civitai job timed out before image was ready")

    # Download the rendered image
    ir = req_lib.get(img_url, timeout=30)
    if not ir.ok:
        raise RuntimeError(f"Civitai image fetch {ir.status_code}")
    return {
        "image_b64": base64.b64encode(ir.content).decode("utf-8"),
        "source": "civitai:pony-xl",
    }
